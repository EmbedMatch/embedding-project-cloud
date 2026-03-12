"""Azure Storage Queue client for dispatching benchmark jobs."""

from azure.core.exceptions import ResourceExistsError
from azure.storage.queue import QueueClient, QueueServiceClient, TextBase64EncodePolicy
from fastapi import Depends

from src.config import Settings, get_settings

QUEUE_NAME = "benchmark-jobs"


def get_queue_service(settings: Settings = Depends(get_settings)) -> QueueServiceClient:
    """Return a QueueServiceClient (used by health-check to peek at the queue)."""
    return QueueServiceClient.from_connection_string(
        settings.azure_storage_connection_string,
    )


def enqueue_benchmark_job(queue_service: QueueServiceClient, experiment_id: str) -> None:
    """Send experiment_id to the benchmark queue, creating it if needed.

    Creates a QueueClient directly with TextBase64EncodePolicy because the
    Azure Functions queue trigger expects base64-encoded message bodies, and
    QueueServiceClient.get_queue_client() does NOT propagate encode policies.
    """
    queue_client = queue_service.get_queue_client(QUEUE_NAME)
    queue_client._message_encode_policy = TextBase64EncodePolicy()
    try:
        queue_client.create_queue()
    except ResourceExistsError:
        pass
    queue_client.send_message(experiment_id)
