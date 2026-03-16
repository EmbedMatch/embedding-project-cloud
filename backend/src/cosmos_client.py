"""Cosmos DB client — thin wrapper for experiment CRUD operations."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from azure.cosmos import ContainerProxy, CosmosClient
from azure.cosmos.exceptions import CosmosResourceNotFoundError
from pydantic import BaseModel, Field

from src.config import settings

# ──────────────────────────────────────────────
#  Pydantic models
# ──────────────────────────────────────────────


class ExperimentBase(BaseModel):
    """Shared fields for all experiment schemas."""

    name: str
    description: str = ""
    blob_name: str  # e.g. "uploads/mydata.csv"
    dataset_type: str = "csv"  # "csv" or "json"


class ExperimentCreate(ExperimentBase):
    """Payload for creating a new experiment (inherits shared fields)."""


class Experiment(ExperimentBase):
    """Full experiment document as stored in Cosmos DB."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    status: str = "created"  # created → processing → completed → failed
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    results: dict[str, Any] | None = None


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
