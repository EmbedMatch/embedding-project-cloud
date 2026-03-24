"""Experiment API endpoints."""

from typing import Any

from azure.storage.queue import QueueServiceClient
from fastapi import APIRouter, Depends, HTTPException

from src.cosmos_client import (
    ExperimentCreate,
    create_experiment,
    get_experiment,
    get_experiment_progress,
    get_experiment_summary,
    list_experiments,
    reset_experiment,
)
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


@router.get("/{experiment_id}/progress")
async def get_experiment_progress_endpoint(experiment_id: str) -> dict[str, Any]:
    """Poll experiment progress — returns status + % complete per model."""
    result = get_experiment_progress(experiment_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
    return result


@router.post("/{experiment_id}/retrigger")
async def retrigger_experiment_endpoint(
    experiment_id: str,
    queue_service: QueueServiceClient = Depends(get_queue_service),
) -> dict[str, Any]:
    """Reset experiment and re-enqueue for processing."""
    doc = reset_experiment(experiment_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
    enqueue_benchmark_job(queue_service, experiment_id)
    return {"message": "Experiment re-triggered", "experiment": doc}


@router.get("/{experiment_id}/summary")
async def get_experiment_summary_endpoint(experiment_id: str) -> dict[str, Any]:
    """Get ranked model summary with recommendation."""
    try:
        result = get_experiment_summary(experiment_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
    return result


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
