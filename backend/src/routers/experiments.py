"""Experiments CRUD and benchmark triggering."""

import uuid
from datetime import datetime, timezone

from azure.cosmos.container import ContainerProxy
from azure.cosmos.exceptions import CosmosResourceNotFoundError
from azure.storage.queue import QueueServiceClient
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from src.cosmos import get_experiments_container
from src.models import Constraints, Experiment
from src.queue import enqueue_benchmark_job, get_queue_service

router = APIRouter(prefix="/experiments", tags=["experiments"])


class CreateExperimentRequest(BaseModel):
    task_type: str = "retrieval"
    blob_name: str
    blob_url: str
    constraints: Constraints = Constraints()
    selected_models: list[str] = []


class StartBenchmarkRequest(BaseModel):
    selected_models: list[str]
    constraints: Constraints = Constraints()


@router.post("/", response_model=Experiment, status_code=status.HTTP_201_CREATED)
def create_experiment(
    req: CreateExperimentRequest,
    container: ContainerProxy = Depends(get_experiments_container),
) -> Experiment:
    exp = Experiment(
        id=str(uuid.uuid4()),
        status="pending",
        created_at=datetime.now(timezone.utc).isoformat(),
        task_type=req.task_type,  # type: ignore[arg-type]
        blob_name=req.blob_name,
        blob_url=req.blob_url,
        constraints=req.constraints,
        selected_models=req.selected_models,
    )
    container.upsert_item(exp.model_dump())
    return exp


@router.post("/{experiment_id}/benchmark", response_model=Experiment)
def start_benchmark(
    experiment_id: str,
    req: StartBenchmarkRequest,
    container: ContainerProxy = Depends(get_experiments_container),
    queue_service: QueueServiceClient = Depends(get_queue_service),
) -> Experiment:
    """Attach selected models + constraints to experiment and enqueue for processing."""
    try:
        item = container.read_item(experiment_id, partition_key=experiment_id)
    except CosmosResourceNotFoundError:
        raise HTTPException(status_code=404, detail="Experiment not found")

    item["selected_models"] = req.selected_models
    item["constraints"] = req.constraints.model_dump()
    item["status"] = "pending"
    container.upsert_item(item)

    enqueue_benchmark_job(queue_service, experiment_id)

    return Experiment(**item)


@router.get("/{experiment_id}", response_model=Experiment)
def get_experiment(
    experiment_id: str,
    container: ContainerProxy = Depends(get_experiments_container),
) -> Experiment:
    try:
        item = container.read_item(experiment_id, partition_key=experiment_id)
    except CosmosResourceNotFoundError:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return Experiment(**item)


@router.get("/", response_model=list[Experiment])
def list_experiments(
    container: ContainerProxy = Depends(get_experiments_container),
) -> list[Experiment]:
    items = list(container.query_items(
        "SELECT * FROM c ORDER BY c.created_at DESC",
        enable_cross_partition_query=True,
    ))
    return [Experiment(**item) for item in items]
