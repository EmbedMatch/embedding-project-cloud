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
    texts: list[str],
    queries: list[str],
    judge_scores: list[dict[str, Any]],
    model_name: str = "",
) -> dict[str, Any]:
    """Embed texts with the specified model and compute metrics."""
    model_name = model_name or CFG.embedding_model

    total_tokens = 0

    # Step 1: Embed texts
    start = datetime.now(UTC)
    if model_name in AZURE_MODELS:
        embeddings, tokens = embed_batch(client, texts, model=model_name)
        total_tokens += tokens
    elif model_name in FASTEMBED_MODELS:
        embeddings, tokens = embed_batch_fastembed(texts, model_name)
        total_tokens += tokens
    else:
        raise ValueError(f"Unknown model: {model_name}")
    latency_ms = (datetime.now(UTC) - start).total_seconds() * 1000

    n_texts, n_dims = embeddings.shape

    # Step 2: Score retrieval with THIS model's embeddings
    retrieval, ret_tokens = score_retrieval(client, texts, queries, model_name=model_name)
    total_tokens += ret_tokens

    # Apply pricing
    if model_name == "text-embedding-ada-002":
        cost_usd = (total_tokens / 1_000_000) * 0.10
    elif model_name == "text-embedding-3-large":
        cost_usd = (total_tokens / 1_000_000) * 0.13
    else:
        cost_usd = 0.0

    # Step 3: Compute average relevance from pre-computed judge scores
    avg_relevance = round(sum(s["score"] for s in judge_scores) / len(judge_scores), 2)

    return {
        "model": model_name,
        "num_texts": n_texts,
        "dimensions": int(n_dims),
        "latency_ms": round(latency_ms, 1),
        "relevance_score": avg_relevance,
        "retrieval_accuracy": retrieval["retrieval_accuracy"],
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
        texts = extract_texts(rows)

        if not texts:
            update_status(
                container, experiment, "failed", error="No text found in dataset"
            )
            return

        client = openai_client()

        # Generate queries and judge scores ONCE (they depend on text, not model)
        queries = generate_queries(client, texts)
        judge_scores = score_relevance_llm(client, texts, queries)

        # Run benchmark for each registered model
        ALL_MODELS = resolve_models(experiment)
        results_array: list[dict[str, Any]] = []

        for model_name in ALL_MODELS:
            logging.info("Benchmarking model: %s", model_name)
            try:
                result = run_benchmark(
                    client, texts, queries, judge_scores, model_name=model_name
                )
                results_array.append(result)
                logging.info(
                    "  %s: %d dims, %.0fms, relevance=%.1f",
                    model_name,
                    result["dimensions"],
                    result["latency_ms"],
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


def generate_queries(client: AzureOpenAI, texts: list[str]) -> list[str]:
    """Generate a synthetic search open query for each text using GPT."""
    queries: list[str] = []
    for text in texts:
        # we call the chat completion API
        response = client.chat.completions.create(
            model=CFG.chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful search assistant. Give a document, write a single realistic search query that a user might, type into a search engine to find it. Output ONLY the query text."
                    ),
                },
                {"role": "user", "content": f"Document: \n{text}"},
            ],
            temperature=0.2,  # Low temperature so it doesn't get too creative/hallucinate
            max_tokens=60,
        )
        query = response.choices[0].message.content.strip("\"'-")
        queries.append(query)

    return queries


def score_retrieval(
    client: AzureOpenAI,
    texts: list[str],
    queries: list[str],
    model_name: str = "",
) -> tuple[dict[str, Any], int]:
    """Embed queries + texts with the specified model, compute retrieval accuracy via cosine similarity."""
    model_name = model_name or CFG.embedding_model
    total_tokens = 0

    # Embed both sets using the SAME model being benchmarked
    if model_name in AZURE_MODELS:
        text_embeddings, t_tokens = embed_batch(client, texts, model=model_name)
        query_embeddings, q_tokens = embed_batch(client, queries, model=model_name)
        total_tokens += t_tokens + q_tokens
    elif model_name in FASTEMBED_MODELS:
        text_embeddings, t_tokens = embed_batch_fastembed(texts, model_name)
        query_embeddings, q_tokens = embed_batch_fastembed(queries, model_name)
        total_tokens += t_tokens + q_tokens
    else:
        text_embeddings, t_tokens = embed_batch(client, texts)
        query_embeddings, q_tokens = embed_batch(client, queries)
        total_tokens += t_tokens + q_tokens

    # Normalize for cosine similarity
    text_norms = text_embeddings / np.linalg.norm(
        text_embeddings, axis=1, keepdims=True
    )
    query_norms = query_embeddings / np.linalg.norm(
        query_embeddings, axis=1, keepdims=True
    )

    # Similarity matrix: (N, N) — each row i is query_i's similarity to all texts
    similarity_matrix = query_norms @ text_norms.T

    # For each query, check if the highest-similarity text is the correct one
    predicted_indices = np.argmax(similarity_matrix, axis=1)
    correct_indices = np.arange(len(texts))
    hits = int(np.sum(predicted_indices == correct_indices))

    return {
        "retrieval_accuracy": round(hits / len(texts), 4),
        "hits": hits,
        "total": len(texts),
    }, total_tokens


def score_relevance_llm(
    client: AzureOpenAI,
    texts: list[str],
    queries: list[str],
) -> list[dict[str, Any]]:
    """Use LLM-as-judge to score each (query, document) pair on 0 to 10 scale."""
    scores: list[dict[str, Any]] = []
    for query, text in zip(queries, texts):
        response = client.chat.completions.create(
            model=CFG.chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        'You are a relevance judge. Given a search query and a document, rate how relevant the document is to the query on a scale of 0 (completely irrelevant) to 10 (perfectly relevant). Respond with JSON only: {"score": <int>, "reason": "<brief reason>"}'
                    ),
                },
                {
                    "role": "user",
                    "content": f"Query: {query}\nnDocument: {text}",
                },
            ],
            temperature=0,
            seed=42,
            response_format={"type": "json_object"},
            max_tokens=100,
        )
        raw = response.choices[0].message.content.strip()
        try:
            parsed = json.loads(raw)
            scores.append(
                {
                    "query": query,
                    "document_preview": text[:100],
                    "score": int(parsed.get("score", 0)),
                    "reason": parsed.get("reason", ""),
                }
            )
        except (json.JSONDecodeError, ValueError):
            logging.warning("Failed to parse LLM judge response: %s", raw)
            scores.append(
                {
                    "query": query,
                    "document_preview": text[:100],
                    "score": 0,
                    "reason": "parse_error",
                }
            )
    return scores


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
