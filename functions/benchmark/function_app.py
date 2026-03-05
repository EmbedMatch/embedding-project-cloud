"""Azure Function: queue-triggered benchmark engine.

Reads experiment_id from the 'benchmark-jobs' storage queue, runs the
embedding benchmark using Azure OpenAI or local open-source models (via
fastembed/ONNX Runtime), and writes results back to Cosmos DB.
"""

import gc
import io
import json
import logging
import os
import time
from typing import Any

# Cache dir for ONNX model files (persistent across restarts on App Service)
os.environ.setdefault("FASTEMBED_CACHE_PATH", "/home/hf_cache")

import azure.functions as func
import numpy as np
from azure.cosmos import CosmosClient
from azure.storage.blob import BlobServiceClient
from openai import AzureOpenAI

app = func.FunctionApp()

logger = logging.getLogger(__name__)

# ── Local open-source model support (via fastembed / ONNX Runtime) ───────────

LOCAL_MODEL_METADATA: dict[str, dict[str, Any]] = {
    "sentence-transformers/all-MiniLM-L6-v2": {"cost_per_m_tokens": 0.00, "dimensions": 384},
    "BAAI/bge-small-en-v1.5": {"cost_per_m_tokens": 0.00, "dimensions": 384},
    "BAAI/bge-base-en-v1.5": {"cost_per_m_tokens": 0.00, "dimensions": 768},
}

_local_model_cache: dict[str, Any] = {}


def _is_local_model(model_id: str) -> bool:
    return model_id in LOCAL_MODEL_METADATA


def _get_local_model(model_id: str) -> Any:
    """Load a fastembed model, keeping only one in memory at a time."""
    global _local_model_cache
    if model_id in _local_model_cache:
        return _local_model_cache[model_id]

    # Evict previous model to keep memory bounded
    for old_id in list(_local_model_cache.keys()):
        del _local_model_cache[old_id]
    gc.collect()

    from fastembed import TextEmbedding
    logger.info("Loading ONNX model via fastembed: %s", model_id)
    model = TextEmbedding(model_id, cache_dir=os.environ.get("FASTEMBED_CACHE_PATH"))
    _local_model_cache[model_id] = model
    return model


def _embed_local(model_id: str, texts: list[str]) -> list[list[float]]:
    """Embed texts using a local ONNX model via fastembed."""
    model = _get_local_model(model_id)
    embeddings = list(model.embed(texts))
    return [e.tolist() for e in embeddings]

# ── Azure clients (initialised once per cold start) ──────────────────────────

def _cosmos_container() -> Any:
    client = CosmosClient.from_connection_string(os.environ["AZURE_COSMOS_CONNECTION_STRING"])
    db = client.create_database_if_not_exists(os.getenv("AZURE_COSMOS_DATABASE", "embedbench"))
    return db.create_container_if_not_exists(
        id="experiments",
        partition_key={"paths": ["/id"], "kind": "Hash"},
    )


def _openai_client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version="2024-12-01-preview",
    )


def _blob_service() -> BlobServiceClient:
    return BlobServiceClient.from_connection_string(os.environ["AZURE_STORAGE_CONNECTION_STRING"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    return float(np.dot(va, vb) / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-9))


def _parse_documents(blob_bytes: bytes, blob_name: str) -> list[str]:
    """Extract text documents from CSV or JSON blob. Returns list of strings."""
    if blob_name.endswith(".json"):
        data = json.loads(blob_bytes)
        if isinstance(data, list):
            # Try common text field names
            for field in ("text", "content", "body", "document"):
                if data and field in data[0]:
                    return [str(row[field]) for row in data if row.get(field)]
            # Fallback: first string field
            if data:
                first_str_key = next((k for k, v in data[0].items() if isinstance(v, str)), None)
                if first_str_key:
                    return [str(row[first_str_key]) for row in data if row.get(first_str_key)]
    else:
        # CSV
        import csv
        reader = csv.DictReader(io.StringIO(blob_bytes.decode("utf-8", errors="replace")))
        rows = list(reader)
        if not rows:
            return []
        for field in ("text", "content", "body", "document"):
            if field in rows[0]:
                return [str(row[field]) for row in rows if row.get(field)]
        # Fallback: first column
        first_key = next(iter(rows[0]))
        return [str(row[first_key]) for row in rows if row.get(first_key)]
    return []


def _generate_queries(docs: list[str], openai: AzureOpenAI, chat_deployment: str) -> list[str]:
    """Use GPT to generate 5 sample retrieval queries from the documents."""
    sample = "\n".join(f"- {d[:200]}" for d in docs[:10])
    resp = openai.chat.completions.create(
        model=chat_deployment,
        messages=[{
            "role": "user",
            "content": (
                f"Given these text documents:\n{sample}\n\n"
                "Generate 5 short, realistic retrieval queries a user might ask to find "
                "relevant documents. Output one query per line, no numbering or bullets."
            ),
        }],
        max_tokens=200,
    )
    raw = resp.choices[0].message.content or ""
    return [q.strip() for q in raw.strip().splitlines() if q.strip()][:5]


def _llm_judge(
    query: str, retrieved_docs: list[str], openai: AzureOpenAI, chat_deployment: str
) -> float:
    """Ask GPT to score relevance of retrieved docs for a query. Returns 0.0–1.0."""
    docs_text = "\n".join(f"[{i+1}] {d[:300]}" for i, d in enumerate(retrieved_docs))
    resp = openai.chat.completions.create(
        model=chat_deployment,
        messages=[{
            "role": "user",
            "content": (
                f'Query: "{query}"\n\n'
                f"Retrieved documents:\n{docs_text}\n\n"
                "Rate the overall relevance of these retrieved documents for the query "
                "on a scale from 0.0 (completely irrelevant) to 1.0 (perfectly relevant). "
                "Respond with only a single decimal number."
            ),
        }],
        max_tokens=10,
    )
    raw = (resp.choices[0].message.content or "0").strip()
    try:
        return max(0.0, min(1.0, float(raw)))
    except ValueError:
        return 0.5


def _benchmark_model(
    model_deployment: str,
    docs: list[str],
    queries: list[str],
    openai: AzureOpenAI,
    chat_deployment: str,
) -> dict[str, Any]:
    """Embed docs + queries with model, retrieve top-5, LLM-judge relevance."""
    local = _is_local_model(model_deployment)
    truncated_docs = docs[:100]

    # Embed all documents
    t0 = time.perf_counter()
    if local:
        doc_vecs = _embed_local(model_deployment, truncated_docs)
    else:
        doc_resp = openai.embeddings.create(model=model_deployment, input=truncated_docs)
        doc_vecs = [e.embedding for e in doc_resp.data]
    embed_time_ms = (time.perf_counter() - t0) * 1000
    latency_per_doc_ms = embed_time_ms / max(len(doc_vecs), 1)

    # Score each query
    scores: list[float] = []
    for query in queries:
        if local:
            q_vec = _embed_local(model_deployment, [query])[0]
        else:
            q_resp = openai.embeddings.create(model=model_deployment, input=[query])
            q_vec = q_resp.data[0].embedding
        sims = [(_cosine_similarity(q_vec, dv), truncated_docs[i]) for i, dv in enumerate(doc_vecs)]
        sims.sort(key=lambda x: x[0], reverse=True)
        top5 = [d for _, d in sims[:5]]
        score = _llm_judge(query, top5, openai, chat_deployment)
        scores.append(score)

    return {
        "retrieval_score": round(sum(scores) / len(scores), 4) if scores else 0.0,
        "latency_ms": round(latency_per_doc_ms, 2),
    }


# ── Function trigger ──────────────────────────────────────────────────────────

@app.queue_trigger(
    arg_name="msg",
    queue_name="benchmark-jobs",
    connection="AZURE_STORAGE_CONNECTION_STRING",
)
def benchmark(msg: func.QueueMessage) -> None:
    experiment_id = msg.get_body().decode("utf-8").strip()
    logger.info("Starting benchmark for experiment %s", experiment_id)

    container = _cosmos_container()
    openai = _openai_client()
    blob_service = _blob_service()
    chat_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")

    # Fetch experiment
    item = container.read_item(experiment_id, partition_key=experiment_id)
    item["status"] = "running"
    container.upsert_item(item)

    try:
        # Download blob
        blob_container = os.getenv("AZURE_STORAGE_CONTAINER", "uploads")
        blob_client = blob_service.get_blob_client(blob_container, item["blob_name"])
        blob_bytes = blob_client.download_blob().readall()

        docs = _parse_documents(blob_bytes, item["blob_name"])
        if not docs:
            raise ValueError("No text documents found in uploaded file.")

        logger.info("Parsed %d documents", len(docs))

        # Generate queries
        queries = _generate_queries(docs, openai, chat_deployment)
        if not queries:
            queries = ["What is the main topic of these documents?"]
        logger.info("Generated %d queries: %s", len(queries), queries)

        # Benchmark each model
        results = []
        model_metadata = {
            "text-embedding-ada-002": {"cost_per_m_tokens": 0.10, "dimensions": 1536},
            "text-embedding-3-large": {"cost_per_m_tokens": 0.13, "dimensions": 3072},
            **LOCAL_MODEL_METADATA,
        }
        for model_deployment in item.get("selected_models", []):
            logger.info("Benchmarking model: %s", model_deployment)
            metrics = _benchmark_model(model_deployment, docs, queries, openai, chat_deployment)
            meta = model_metadata.get(model_deployment, {"cost_per_m_tokens": 0.10, "dimensions": 1536})
            results.append({
                "model_name": model_deployment,
                "retrieval_score": metrics["retrieval_score"],
                "latency_ms": metrics["latency_ms"],
                "cost_per_m_tokens": meta["cost_per_m_tokens"],
                "dimensions": meta["dimensions"],
            })

        item["results"] = results
        item["status"] = "completed"

    except Exception as exc:
        logger.exception("Benchmark failed for %s", experiment_id)
        item["status"] = "failed"
        item["error"] = str(exc)

    container.upsert_item(item)
    logger.info("Benchmark %s finished with status: %s", experiment_id, item["status"])
