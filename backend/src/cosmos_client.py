"""Cosmos DB client — thin wrapper for experiment CRUD operations."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from azure.cosmos import ContainerProxy, CosmosClient
from azure.cosmos.exceptions import CosmosResourceNotFoundError
from pydantic import BaseModel, Field, field_validator

from src.config import settings

# ──────────────────────────────────────────────
#  Pydantic models
# ──────────────────────────────────────────────
SUPPORTED_MODELS: list[str] = [
    "text-embedding-ada-002",
    "text-embedding-3-large",
    "all-MiniLM-L6-v2",
    "bge-base-en-v1.5",
    "bge-small-en-v1.5",
]


class ExperimentBase(BaseModel):
    """Shared fields for all experiment schemas."""

    name: str
    description: str = ""
    blob_name: str  # e.g. "uploads/mydata.csv"
    dataset_type: str = "csv"  # "csv" or "json"


class ExperimentCreate(ExperimentBase):
    """Payload for creating a new experiment (inherits shared fields)."""

    models: list[str] = Field(default_factory=lambda: list(SUPPORTED_MODELS))

    @field_validator("models")
    @classmethod
    def validate_models(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Models list must not be empty")
        if len(v) != len(set(v)):
            raise ValueError("Models list must not contain duplicates")
        invalid = set(v) - set(SUPPORTED_MODELS)
        if invalid:
            raise ValueError(f"unsupported model(s): {', '.join(sorted(invalid))}")
        return [m for m in SUPPORTED_MODELS if m in v]


class Experiment(ExperimentBase):
    """Full experiment document as stored in Cosmos DB."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    status: str = "created"  # created → processing → completed → failed
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    results: list[dict[str, Any]] | dict[str, Any] | None = None
    models: list[str] = Field(default_factory=lambda: list(SUPPORTED_MODELS))


# ──────────────────────────────────────────────
#  Container accessor
# ──────────────────────────────────────────────

_container: ContainerProxy | None = None


def _get_container() -> ContainerProxy:
    """Return (and cache) a reference to the experiments container."""
    global _container  # noqa: PLW0603
    if _container is None:
        client = CosmosClient.from_connection_string(settings.azure_cosmos_connection_string)
        database = client.get_database_client(settings.azure_cosmos_database)
        _container = database.get_container_client(settings.azure_cosmos_container)
    return _container


# ──────────────────────────────────────────────
#  CRUD helpers
# ──────────────────────────────────────────────


def create_experiment(data: ExperimentCreate) -> dict[str, Any]:
    """Create a new experiment document in Cosmos DB.

    Returns the created document (with id, timestamps, etc.).
    """
    experiment = Experiment(**data.model_dump())
    container = _get_container()
    created: dict[str, Any] = container.create_item(body=experiment.model_dump())
    return _clean(created)


def get_experiment(experiment_id: str) -> dict[str, Any] | None:
    """Read a single experiment by its ID.

    Returns the document dict, or None if not found.
    """
    container = _get_container()
    try:
        item: dict[str, Any] = container.read_item(
            item=experiment_id,
            partition_key=experiment_id,
        )
        return _clean(item)
    except CosmosResourceNotFoundError:
        return None


def list_experiments() -> list[dict[str, Any]]:
    """Return all experiments (newest first)."""
    container = _get_container()
    query = "SELECT * FROM c ORDER BY c.created_at DESC"
    items = list(container.query_items(query=query, enable_cross_partition_query=True))
    return [_clean(item) for item in items]


# ──────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────


def _clean(doc: dict[str, Any]) -> dict[str, Any]:
    """Remove Cosmos DB system properties (e.g. _rid, _self, _ts, …)."""
    return {k: v for k, v in doc.items() if not k.startswith("_")}


def get_experiment_progress(experiment_id: str) -> dict[str, Any] | None:
    """Return experiment status + per-model progress."""
    doc = get_experiment(experiment_id)
    if doc is None:
        return None
    total_models = doc.get("models", [])
    completed_results = doc.get("results", []) or []
    # Build per-model status
    finished_model_names = set()
    per_model = []
    for result in completed_results:
        model_name = result.get("model", "unknown")
        finished_model_names.add(model_name)
        has_error = "error" in result
        per_model.append(
            {
                "model": model_name,
                "status": "failed" if has_error else "done",
            }
        )
    # Adds pending models (not yet in results)
    for model_name in total_models:
        if model_name not in finished_model_names:
            per_model.append(
                {
                    "model": model_name,
                    "status": "pending",
                }
            )
    completed_count = len(completed_results)
    total_count = len(total_models) if total_models else 1  # avoids division by zero
    return {
        "id": doc["id"],
        "status": doc["status"],
        "progress_percent": round((completed_count / total_count) * 100, 1),
        "completed_models": completed_count,
        "total_models": total_count,
        "per_model": per_model,
        "updated_at": doc.get("updated_at"),
    }


def reset_experiment(experiment_id: str) -> dict[str, Any] | None:
    """Reset an experiment for re-processing.

    Clears results, resets status to 'created', updates timestamp.
    Returns the updated document, or None if not found.
    """
    container = _get_container()
    try:
        doc: dict[str, Any] = container.read_item(
            item=experiment_id,
            partition_key=experiment_id,
        )
    except CosmosResourceNotFoundError:
        return None

    doc["status"] = "created"
    doc["results"] = None
    doc["updated_at"] = datetime.now(UTC).isoformat()
    doc.pop("error", None)

    container.upsert_item(body=doc)
    return _clean(doc)


def get_experiment_summary(experiment_id: str) -> dict[str, Any] | None:
    """Rank benchmarked models and return a recommendation.

    Returns None if experiment not found.
    Raises ValueError if experiment hasn't completed or has no results.
    """
    doc = get_experiment(experiment_id)
    if doc is None:
        return None

    if doc["status"] != "completed":
        raise ValueError(
            f"Experiment is '{doc['status']}', not 'completed'. Cannot generate summary until benchmark finishes."
        )

    results = doc.get("results", [])
    if not results:
        raise ValueError("No results available for this experiment.")

    # Filter out failed models (those with 'error' key but no scores)
    valid_results = [r for r in results if "error" not in r]

    if not valid_results:
        return {
            "id": doc["id"],
            "status": doc["status"],
            "ranked_models": [],
            "recommendation": None,
            "message": "All models failed during benchmarking.",
        }

    # Composite score: 0.5 * relevance + 0.3 * retrieval(×10) + 0.2 * speed(×10)
    max_latency = max(r.get("latency_ms", 0) for r in valid_results) or 1

    for r in valid_results:
        relevance = r.get("relevance_score", 0)
        retrieval = r.get("retrieval_accuracy", 0)
        latency = r.get("latency_ms", 0)
        normalized_latency = latency / max_latency

        r["composite_score"] = round(
            0.5 * relevance + 0.3 * (retrieval * 10) + 0.2 * ((1 - normalized_latency) * 10),
            2,
        )

    ranked = sorted(valid_results, key=lambda r: r["composite_score"], reverse=True)

    for i, r in enumerate(ranked, start=1):
        r["rank"] = i

    best = ranked[0]

    return {
        "id": doc["id"],
        "status": doc["status"],
        "ranked_models": ranked,
        "recommendation": {
            "model": best["model"],
            "composite_score": best["composite_score"],
            "relevance_score": best.get("relevance_score"),
            "retrieval_accuracy": best.get("retrieval_accuracy"),
            "latency_ms": best.get("latency_ms"),
            "reason": (
                f"{best['model']} achieved the highest composite score of "
                f"{best['composite_score']}/10, balancing relevance "
                f"({best.get('relevance_score', 'N/A')}), retrieval accuracy "
                f"({best.get('retrieval_accuracy', 'N/A')}), and latency "
                f"({best.get('latency_ms', 'N/A')}ms)."
            ),
        },
    }
