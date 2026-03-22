"""Experiment API endpoints."""

from typing import Any

from azure.storage.queue import QueueServiceClient
from fastapi import APIRouter, Depends, HTTPException

from src.cosmos_client import ExperimentCreate, create_experiment, get_experiment, list_experiments
from src.queue import enqueue_benchmark_job, get_queue_service

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.post("/", status_code=201)
async def create_experiment_endpoint(
    payload: ExperimentCreate,
    queue_service: QueueServiceClient = Depends(get_queue_service),
) -> dict[str, Any]:
    """Create a new experiment in Cosmos DB and enqueue benchmark job."""
    doc = create_experiment(payload)
    enqueue_benchmark_job(queue_service, doc["id"])
    return doc


@router.get("/{experiment_id}")
async def get_experiment_endpoint(experiment_id: str) -> dict[str, Any]:
    """Get a single experiment by ID."""
    doc = get_experiment(experiment_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
    return doc


@router.get("/")
async def list_experiments_endpoint() -> list[dict[str, Any]]:
    """List all experiments (newest first)."""
    return list_experiments()
