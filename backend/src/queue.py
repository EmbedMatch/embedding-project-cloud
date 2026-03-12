"""Azure Storage Queue client for dispatching benchmark jobs."""

from azure.core.exceptions import ResourceExistsError
from azure.storage.queue import QueueServiceClient
from fastapi import Depends

from src.config import Settings, get_settings

QUEUE_NAME = "benchmark-jobs"


def get_queue_service(settings: Settings = Depends(get_settings)) -> QueueServiceClient:
    return QueueServiceClient.from_connection_string(settings.azure_storage_connection_string)


def enqueue_benchmark_job(queue_service: QueueServiceClient, experiment_id: str) -> None:
    """Send experiment_id to the benchmark queue, creating it if needed."""
    queue_client = queue_service.get_queue_client(QUEUE_NAME)
    try:
        queue_client.create_queue()
    except ResourceExistsError:
        pass
    queue_client.send_message(experiment_id)
