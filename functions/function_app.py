"""Azure Functions benchmark worker.

Listens on the 'benchmark-jobs' queue. For each experiment ID:
1. Downloads the dataset from Blob Storage
2. Extracts text from all rows
3. Embeds all texts with Azure OpenAI (ada-002)
4. Returns embedding stats + placeholder relevance score (LLM judge coming in Sprint 2)
"""

import csv
import io
import json
import logging
import os
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import azure.functions as func
import numpy as np
from azure.cosmos import ContainerProxy, CosmosClient
from azure.storage.blob import BlobServiceClient
from openai import AzureOpenAI
from fastembed import TextEmbedding

app = func.FunctionApp()


# ── Configuration ────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Config:
    """All environment-based configuration in one place."""

    cosmos_conn: str = os.environ.get("AZURE_COSMOS_CONNECTION_STRING", "")
    cosmos_db: str = os.environ.get("AZURE_COSMOS_DATABASE", "embedbench")
    cosmos_container: str = os.environ.get("AZURE_COSMOS_CONTAINER", "experiments")
    storage_conn: str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
    storage_container: str = os.environ.get("AZURE_STORAGE_CONTAINER", "uploads")
    openai_endpoint: str = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    openai_key: str = os.environ.get("AZURE_OPENAI_API_KEY", "")
    embedding_model: str = os.environ.get(
        "AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-ada-002"
    )
    embedding_model_large: str = os.environ.get(
        "AZURE_OPENAI_EMBEDDING_LARGE_DEPLOYMENT", "text-embedding-3-large"
    )
    chat_model: str = os.environ.get("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o-mini")


CFG = Config()

# ── FASTEMBED and AZURE models ───────────────────────────────────────────────────
FASTEMBED_MODELS = {
    "all-MiniLM-L6-v2": "sentence-transformers/all-MiniLM-L6-v2",
    "bge-base-en-v1.5": "BAAI/bge-base-en-v1.5",
    "bge-small-en-v1.5": "BAAI/bge-small-en-v1.5",
}

AZURE_MODELS = {"text-embedding-ada-002", "text-embedding-3-large"}

# How many texts to evaluate (generate queries for) when the pool is large
EVAL_SUBSET_SIZE = 20
# Minimum pool size before we bother splitting eval vs pool
MIN_POOL_SPLIT_SIZE = 30

QUERY_GENERATION_PROMPT = """\
You are simulating a real user searching for information. You have NOT
read the document below — you only know the PROBLEM or NEED it solves.

Write a short, natural search query (5-15 words) that someone would type
into a search engine when they need the information in this document.

RULES:
1. Do NOT copy phrases, jargon, or proper nouns from the document.
2. Describe the user's SYMPTOM, GOAL, or QUESTION — not the document's
   content.
3. Use everyday language, as if you're explaining the problem to a friend.
4. The query must be specific enough that this document is the best answer,
   but phrased completely differently.

Examples:
- Document about "OAuth 2.0 PKCE flow for SPAs"
  BAD:  "OAuth 2.0 PKCE flow single page application"
  GOOD: "how to securely log in users from a javascript app without a backend"
- Document about "Kubernetes pod affinity and anti-affinity rules"
  BAD:  "Kubernetes pod affinity configuration"
  GOOD: "make sure my containers always run on different servers"

Output ONLY the query text, nothing else."""

JUDGE_SCORING_PROMPT = """\
You are a relevance judge. Given a search query and a document, rate how
relevant the document is to the query on a scale of 0 (completely
irrelevant) to 10 (perfectly relevant). Respond with JSON only:
{"score": <int>, "reason": "<brief reason>"}"""

ALL_MODEL_IDS: list[str] = [
    "text-embedding-ada-002",
    "text-embedding-3-large",
    "all-MiniLM-L6-v2",
    "bge-base-en-v1.5",
    "bge-small-en-v1.5",
]

# ── Azure client factories ───────────────────────────────────────────────────


def cosmos_container() -> ContainerProxy:
    client = CosmosClient.from_connection_string(CFG.cosmos_conn)
    return client.get_database_client(CFG.cosmos_db).get_container_client(
        CFG.cosmos_container
    )


def openai_client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=CFG.openai_endpoint,
        api_key=CFG.openai_key,
        api_version="2024-12-01-preview",
    )


def download_blob(blob_name: str) -> bytes:
    svc = BlobServiceClient.from_connection_string(CFG.storage_conn)
    return (
        svc.get_blob_client(container=CFG.storage_container, blob=blob_name)
        .download_blob()
        .readall()
    )


# ── Dataset parsing ──────────────────────────────────────────────────────────


def parse_dataset(raw: bytes, dataset_type: str) -> list[dict[str, Any]]:
    """Parse CSV or JSON bytes into a list of row dicts."""
    text = raw.decode("utf-8")

    if dataset_type == "json":
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            lists = [v for v in parsed.values() if isinstance(v, list)]
            return lists[0] if lists else [parsed]

    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


def extract_texts(rows: list[dict[str, Any]]) -> list[str]:
    """Pull the text content from each row.

    Looks for the first non-empty value across common column names.
    """
    text_keys = ["text", "content", "document", "body", "description"]
    texts: list[str] = []
    for row in rows:
        for key in text_keys:
            if key in row and row[key]:
                texts.append(str(row[key]))
                break
        else:
            # Fallback: concatenate all values
            texts.append(" ".join(str(v) for v in row.values() if v))
    return texts


# ── Embedding ────────────────────────────────────────────────────────────────


def embed_batch(
    client: AzureOpenAI, texts: list[str], model: str = "", batch_size: int = 16
) -> tuple[np.ndarray, int]:
    """Embed texts in batches, returns a (N, D) numpy array and total token count."""
    all_embeddings: list[list[float]] = []
    total_tokens = 0
    for i in range(0, len(texts), batch_size):
        batch = [t[:8000] for t in texts[i : i + batch_size]]
        resp = client.embeddings.create(model=model or CFG.embedding_model, input=batch)
        all_embeddings.extend(d.embedding for d in resp.data)
        if hasattr(resp, "usage") and resp.usage:
            total_tokens += getattr(resp.usage, "total_tokens", 0)
    return np.array(all_embeddings), total_tokens


def embed_batch_fastembed(texts: list[str], model_name: str) -> tuple[np.ndarray, int]:
    """Embed texts using opensource model via fastembed (ONIX Runtime)"""
    fastembed_id = FASTEMBED_MODELS.get(model_name)
    if not fastembed_id:
        raise ValueError(f"Unknown fastembed model: {model_name}")
    model = TextEmbedding(model_name=fastembed_id)
    embeddings = list(model.embed(texts))

    import tiktoken

    encoding = tiktoken.get_encoding("cl100k_base")
    total_tokens = sum(len(encoding.encode(t, disallowed_special=())) for t in texts)

    return np.array(embeddings), total_tokens


def run_benchmark(
    client: AzureOpenAI,
    pool_texts: list[str],
    eval_texts: list[str],
    eval_indices: list[int],
    queries: list[str],
    model_name: str = "",
) -> dict[str, Any]:
    """Embed the full pool, retrieve for eval queries, judge retrieved docs.

    Args:
        pool_texts: ALL texts in the corpus (the retrieval haystack).
        eval_texts: The subset of texts that have matching queries.
        eval_indices: Indices of eval_texts within pool_texts.
        queries: Synthetic queries (one per eval_text).
        model_name: Which embedding model to benchmark.

    Returns a dict with MRR, Recall@K, relevance, latency, etc.
    """
    model_name = model_name or CFG.embedding_model

    total_tokens = 0

    # Step 1: Embed the FULL pool
    start = datetime.now(UTC)
    if model_name in AZURE_MODELS:
        pool_embeddings, tokens = embed_batch(client, pool_texts, model=model_name)
        total_tokens += tokens
    elif model_name in FASTEMBED_MODELS:
        pool_embeddings, tokens = embed_batch_fastembed(pool_texts, model_name)
        total_tokens += tokens
    else:
        raise ValueError(f"Unknown model: {model_name}")
    latency_ms = (datetime.now(UTC) - start).total_seconds() * 1000

    n_pool, n_dims = pool_embeddings.shape

    # Step 2: Embed the queries with the SAME model
    if model_name in AZURE_MODELS:
        query_embeddings, q_tokens = embed_batch(client, queries, model=model_name)
    elif model_name in FASTEMBED_MODELS:
        query_embeddings, q_tokens = embed_batch_fastembed(queries, model_name)
    else:
        query_embeddings, q_tokens = embed_batch(client, queries)

    total_tokens += q_tokens

    # Apply pricing
    if model_name == "text-embedding-ada-002":
        cost_usd = (total_tokens / 1_000_000) * 0.10
    elif model_name == "text-embedding-3-large":
        cost_usd = (total_tokens / 1_000_000) * 0.13
    else:
        cost_usd = 0.0

    # Step 3: Compute retrieval metrics (MRR, Recall@K)
    correct_indices = np.array(eval_indices)
    retrieval = score_retrieval(
        pool_embeddings,
        query_embeddings,
        correct_indices,
    )

    # Step 4: LLM-judge on the ACTUALLY RETRIEVED top-1 docs (non-circular)
    top1_indices = retrieval["top1_indices"]
    retrieved_texts = [pool_texts[idx] for idx in top1_indices]
    judge_scores = score_relevance_llm(client, retrieved_texts, queries)
    avg_relevance = round(sum(s["score"] for s in judge_scores) / len(judge_scores), 2)

    return {
        "model": model_name,
        "num_texts": n_pool,
        "dimensions": int(n_dims),
        "latency_ms": round(latency_ms, 1),
        "relevance_score": avg_relevance,
        "retrieval_accuracy": retrieval["recall@1"],
        "mrr": retrieval["mrr"],
        "recall_at_1": retrieval["recall@1"],
        "recall_at_5": retrieval["recall@5"],
        "recall_at_10": retrieval["recall@10"],
        "pool_size": n_pool,
        "eval_size": len(queries),
        "judge_scores": judge_scores,
        "total_tokens": total_tokens,
        "cost_usd": float(round(cost_usd, 6)),
    }


# ── Cosmos DB status helpers ─────────────────────────────────────────────────


def update_status(
    container: ContainerProxy,
    experiment: dict[str, Any],
    status: str,
    **extra: Any,
) -> None:
    experiment["status"] = status
    experiment["updated_at"] = datetime.now(UTC).isoformat()
    experiment.update(extra)
    container.upsert_item(body=experiment)


# ── Queue trigger ────────────────────────────────────────────────────────────


@app.function_name(name="benchmark_job_listener")
@app.queue_trigger(
    arg_name="msg",
    queue_name="benchmark-jobs",
    connection="AZURE_STORAGE_CONNECTION_STRING",
)
def benchmark_job_listener(msg: func.QueueMessage) -> None:
    """Process a benchmark job from the queue."""
    experiment_id = msg.get_body().decode("utf-8").strip().strip('"')
    logging.info("Processing experiment %s", experiment_id)

    container = cosmos_container()
    experiment: dict[str, Any] = container.read_item(
        item=experiment_id, partition_key=experiment_id
    )

    try:
        update_status(container, experiment, "processing")

        raw = download_blob(experiment["blob_name"])
        rows = parse_dataset(raw, experiment.get("dataset_type", "csv"))
        pool_texts = extract_texts(rows)

        if not pool_texts:
            update_status(
                container, experiment, "failed", error="No text found in dataset"
            )
            return

        client = openai_client()

        # ── Split into retrieval pool vs evaluation subset ──
        if len(pool_texts) >= MIN_POOL_SPLIT_SIZE:
            eval_count = min(EVAL_SUBSET_SIZE, len(pool_texts) // 3)
            eval_indices = sorted(random.sample(range(len(pool_texts)), eval_count))
        else:
            # Small dataset — eval on everything (pool = eval)
            eval_indices = list(range(len(pool_texts)))

        eval_texts = [pool_texts[i] for i in eval_indices]
        logging.info("Pool size: %d, eval subset: %d", len(pool_texts), len(eval_texts))

        # Generate adversarial queries ONCE (they depend on text, not model)
        queries = generate_queries(client, eval_texts)

        # Run benchmark for each registered model
        ALL_MODELS = resolve_models(experiment)
        results_array: list[dict[str, Any]] = []

        for model_name in ALL_MODELS:
            logging.info("Benchmarking model: %s", model_name)
            try:
                result = run_benchmark(
                    client,
                    pool_texts,
                    eval_texts,
                    eval_indices,
                    queries,
                    model_name=model_name,
                )
                results_array.append(result)
                logging.info(
                    "  %s: %d dims, %.0fms, MRR=%.3f, R@5=%.3f, rel=%.1f",
                    model_name,
                    result["dimensions"],
                    result["latency_ms"],
                    result["mrr"],
                    result["recall_at_5"],
                    result["relevance_score"],
                )
            except Exception:
                logging.exception("  %s: failed, skipping", model_name)
                results_array.append(
                    {
                        "model": model_name,
                        "error": "Model benchmark failed",
                    }
                )
            # Write partial results after each model so frontend can show progress
            update_status(container, experiment, "processing", results=results_array)

        update_status(container, experiment, "completed", results=results_array)
        logging.info(
            "Experiment %s completed: %d models benchmarked",
            experiment_id,
            len(results_array),
        )

    except Exception:
        logging.exception("Experiment %s failed", experiment_id)
        try:
            update_status(container, experiment, "failed")
        except Exception:
            logging.exception("Could not update experiment status to failed")


# ── LLM Helpers ────────────────────────────────────────────────────────────


def _generate_single_query(client: AzureOpenAI, text: str) -> str:
    response = client.chat.completions.create(
        model=CFG.chat_model,
        messages=[
            {
                "role": "system",
                "content": QUERY_GENERATION_PROMPT,
            },
            {"role": "user", "content": f"Document: \n{text}"},
        ],
        temperature=0.7,
        max_tokens=60,
    )
    content = response.choices[0].message.content
    return content.strip("\"'-") if content else f"search query for: {text[:50]}"


def generate_queries(client: AzureOpenAI, texts: list[str]) -> list[str]:
    """Generate synthetic search queries for all texts (10 concurrent)."""
    queries: list[str | None] = [None] * len(texts)
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {
            pool.submit(_generate_single_query, client, t): i
            for i, t in enumerate(texts)
        }
        for future in as_completed(futures):
            queries[futures[future]] = future.result()
    return [q or "" for q in queries]


def score_retrieval(
    pool_embeddings: np.ndarray,
    query_embeddings: np.ndarray,
    correct_indices: np.ndarray,
    k_values: list[int] | None = None,
) -> dict[str, Any]:
    """Compute MRR + Recall@K from pre-computed embeddings.

    Args:
        pool_embeddings: (P, D) embeddings for the entire retrieval pool.
        query_embeddings: (Q, D) embeddings for the eval queries.
        correct_indices: length-Q array; correct_indices[i] is the index
                         in pool_embeddings that query i should retrieve.
        k_values: which K values to compute Recall@K for.

    Returns dict with mrr, recall@1/3/5/10, top1_indices, etc.
    """
    if k_values is None:
        k_values = [1, 3, 5, 10]

    # Normalize for cosine similarity
    pool_norms = pool_embeddings / np.linalg.norm(
        pool_embeddings, axis=1, keepdims=True
    )
    query_norms = query_embeddings / np.linalg.norm(
        query_embeddings, axis=1, keepdims=True
    )

    # Similarity matrix: (Q, P) — each row i is query_i's similarity to all pool texts
    similarity_matrix = query_norms @ pool_norms.T

    # Rank pool texts for each query (descending similarity)
    ranked_indices = np.argsort(-similarity_matrix, axis=1)

    num_queries = len(correct_indices)
    reciprocal_ranks: list[float] = []
    recall_at_k: dict[int, int] = {k: 0 for k in k_values}
    top1_indices: list[int] = []

    for i in range(num_queries):
        # Position of the correct document in the ranked list
        rank_positions = np.where(ranked_indices[i] == correct_indices[i])[0]
        rank = (
            int(rank_positions[0]) + 1 if len(rank_positions) > 0 else num_queries + 1
        )

        reciprocal_ranks.append(1.0 / rank)
        top1_indices.append(int(ranked_indices[i][0]))

        for k in k_values:
            if rank <= k:
                recall_at_k[k] += 1

    mrr = round(sum(reciprocal_ranks) / num_queries, 4)
    recall = {f"recall@{k}": round(v / num_queries, 4) for k, v in recall_at_k.items()}

    return {
        "mrr": mrr,
        **recall,
        "top1_indices": top1_indices,
        "num_queries": num_queries,
        "pool_size": pool_embeddings.shape[0],
    }


def _score_single_pair(client: AzureOpenAI, query: str, text: str) -> dict[str, Any]:
    response = client.chat.completions.create(
        model=CFG.chat_model,
        messages=[
            {
                "role": "system",
                "content": JUDGE_SCORING_PROMPT,
            },
            {
                "role": "user",
                "content": f"Query: {query}\nDocument: {text}",
            },
        ],
        temperature=0,
        seed=42,
        response_format={"type": "json_object"},
        max_tokens=100,
    )
    raw = (response.choices[0].message.content or "").strip()
    try:
        parsed = json.loads(raw)
        return {
            "query": query,
            "document_preview": text[:100],
            "score": int(parsed.get("score", 0)),
            "reason": parsed.get("reason", ""),
        }
    except (json.JSONDecodeError, ValueError):
        logging.warning("Failed to parse LLM judge response: %s", raw)
        return {
            "query": query,
            "document_preview": text[:100],
            "score": 0,
            "reason": "parse_error",
        }


def score_relevance_llm(
    client: AzureOpenAI,
    texts: list[str],
    queries: list[str],
) -> list[dict[str, Any]]:
    """Use LLM-as-judge to score all (query, document) pairs (10 concurrent)."""
    scores: list[dict[str, Any] | None] = [None] * len(texts)
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {
            pool.submit(_score_single_pair, client, q, t): i
            for i, (q, t) in enumerate(zip(queries, texts))
        }
        for future in as_completed(futures):
            scores[futures[future]] = future.result()
    return [
        s or {"query": "", "document_preview": "", "score": 0, "reason": "error"}
        for s in scores
    ]


def resolve_models(experiment: dict[str, Any]) -> list[str]:
    """Return the list of models to benchmark for this experiment.
    - Reads experiment["models"] if present (new experiments)
    - Falls back to ALL_MODEL_IDS for backward compatibility for older experiments
    - Validates all entries are known models
    """
    selected = experiment.get("models")
    if not selected:
        return list(ALL_MODEL_IDS)
    # Filtering only known models to keep the order of the input list
    known = set(AZURE_MODELS) | set(FASTEMBED_MODELS.keys())
    validated = [m for m in ALL_MODEL_IDS if m in selected and m in known]
    if not validated:
        raise ValueError(f"No valid models found in experiment: {selected}")
    return validated
