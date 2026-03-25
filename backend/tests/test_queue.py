"""Tests for the storage queue client."""

from unittest.mock import MagicMock

import pytest
from azure.core.exceptions import ResourceExistsError
from azure.storage.queue import TextBase64EncodePolicy

from src.queue import enqueue_benchmark_job


@pytest.mark.unit
def test_enqueue_benchmark_job_success() -> None:
    """Test successful message enqueueing with base64 encode policy."""
    mock_queue_service = MagicMock()
    mock_queue_client = MagicMock()
    mock_queue_service.get_queue_client.return_value = mock_queue_client

    enqueue_benchmark_job(mock_queue_service, "exp-123")

    mock_queue_client.send_message.assert_called_once_with("exp-123")
    # Policy is set directly on the client instance (not via get_queue_client kwarg)
    assert isinstance(mock_queue_client._message_encode_policy, TextBase64EncodePolicy)


@pytest.mark.unit
def test_enqueue_benchmark_job_creates_queue() -> None:
    """Test that it tries to create the queue if it doesn't exist."""
    mock_queue_service = MagicMock()
    mock_queue_client = MagicMock()
    mock_queue_service.get_queue_client.return_value = mock_queue_client

    # Simulate queue already exists
    mock_queue_client.create_queue.side_effect = ResourceExistsError("Exists")

    enqueue_benchmark_job(mock_queue_service, "exp-123")

    mock_queue_client.create_queue.assert_called_once()
    mock_queue_client.send_message.assert_called_once()
