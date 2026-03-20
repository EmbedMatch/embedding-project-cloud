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
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import azure.functions as func
import numpy as np
from azure.cosmos import ContainerProxy, CosmosClient
from azure.storage.blob import BlobServiceClient
from openai import AzureOpenAI

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


CFG = Config()


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
    client: AzureOpenAI, texts: list[str], batch_size: int = 16
) -> np.ndarray:
    """Embed texts in batches, returns a (N, D) numpy array."""
    all_embeddings: list[list[float]] = []
    for i in range(0, len(texts), batch_size):
        batch = [t[:8000] for t in texts[i : i + batch_size]]
        resp = client.embeddings.create(model=CFG.embedding_model, input=batch)
        all_embeddings.extend(d.embedding for d in resp.data)
    return np.array(all_embeddings)


def run_benchmark(client: AzureOpenAI, texts: list[str]) -> dict[str, Any]:
    """Embed all texts and return stats.

    Relevance score is a placeholder — real LLM-as-judge scoring
    will be implemented in Sprint 2.
    """
    start = datetime.now(UTC)
    embeddings = embed_batch(client, texts)
    latency_ms = (datetime.now(UTC) - start).total_seconds() * 1000

    n_texts, n_dims = embeddings.shape

    # Placeholder relevance score (random 0.5–0.95) until LLM judge is added
    placeholder_score = round(random.uniform(0.5, 0.95), 4)

    return {
        "model": CFG.embedding_model,
        "num_texts": n_texts,
        "dimensions": int(n_dims),
        "latency_ms": round(latency_ms, 1),
        "relevance_score": placeholder_score,
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

        results = run_benchmark(openai_client(), texts)
        update_status(container, experiment, "completed", results=results)
        logging.info(
            "Experiment %s completed: %d texts, %d dims, %.0fms",
            experiment_id,
            results["num_texts"],
            results["dimensions"],
            results["latency_ms"],
        )

    except Exception:
        logging.exception("Experiment %s failed", experiment_id)
        try:
            update_status(container, experiment, "failed")
        except Exception:
            logging.exception("Could not update experiment status to failed")
