"""Azure Storage Queue client for dispatching benchmark jobs."""

import contextlib

from azure.core.exceptions import ResourceExistsError
from azure.storage.queue import QueueServiceClient, TextBase64EncodePolicy
from fastapi import Depends

from src.config import Settings, get_settings

QUEUE_NAME = "benchmark-jobs"


def get_queue_service(settings: Settings = Depends(get_settings)) -> QueueServiceClient:
    """Return a QueueServiceClient."""
    return QueueServiceClient.from_connection_string(
        settings.azure_storage_connection_string,
    )


def enqueue_benchmark_job(queue_service: QueueServiceClient, experiment_id: str) -> None:
    """Send experiment_id to the benchmark queue, creating it if needed.

    Creates a QueueClient directly with TextBase64EncodePolicy because the
    Azure Functions queue trigger expects base64-encoded message bodies.
    """
    queue_client = queue_service.get_queue_client(QUEUE_NAME)
    queue_client._message_encode_policy = TextBase64EncodePolicy()
    with contextlib.suppress(ResourceExistsError):
        queue_client.create_queue()
    queue_client.send_message(experiment_id)
