"""Tests for Azure Blob Storage service."""

from unittest.mock import MagicMock, patch

import pytest
from azure.core.exceptions import ResourceNotFoundError
from fastapi import HTTPException

from src.config import Settings
from src.storage import get_blob_service, upload_blob


@pytest.mark.unit
def test_get_blob_service_success() -> None:
    """Test successful blob service initialization."""
    settings = Settings(
        azure_storage_connection_string="DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;EndpointSuffix=core.windows.net",
        azure_storage_container="test-container",
    )
    with patch("azure.storage.blob.BlobServiceClient.from_connection_string") as mock_from_conn:
        service = get_blob_service(settings)
        assert service is not None
        mock_from_conn.assert_called_once_with(settings.azure_storage_connection_string)


@pytest.mark.unit
def test_get_blob_service_invalid_connection_string() -> None:
    """Test blob service initialization with invalid connection string."""
    settings = Settings(
        azure_storage_connection_string="invalid-string",
        azure_storage_container="test-container",
    )
    with pytest.raises(HTTPException) as exc:
        get_blob_service(settings)
    assert exc.value.status_code == 503
    assert "Invalid AZURE_STORAGE_CONNECTION_STRING" in exc.value.detail


@pytest.mark.unit
@pytest.mark.asyncio
async def test_upload_blob_success() -> None:
    """Test successful blob upload."""
    mock_service = MagicMock()
    mock_container = MagicMock()
    mock_blob = MagicMock()
    mock_blob.url = "https://test.blob.core.windows.net/test-container/test-blob"

    mock_service.get_container_client.return_value = mock_container
    mock_container.get_blob_client.return_value = mock_blob

    url = await upload_blob(
        mock_service,
        container="test-container",
        blob_name="test-blob",
        data=b"test data",
        content_type="text/plain",
    )

    assert url == mock_blob.url
    mock_blob.upload_blob.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_upload_blob_create_container_retry() -> None:
    """Test blob upload retry when container does not exist."""
    mock_service = MagicMock()
    mock_container = MagicMock()
    mock_blob = MagicMock()
    mock_blob.url = "https://test.blob.core.windows.net/test-container/test-blob"

    mock_service.get_container_client.return_value = mock_container
    mock_container.get_blob_client.return_value = mock_blob

    # First call raises ResourceNotFoundError, second call succeeds
    mock_blob.upload_blob.side_effect = [ResourceNotFoundError("Container not found"), None]

    url = await upload_blob(
        mock_service,
        container="test-container",
        blob_name="test-blob",
        data=b"test data",
    )

    assert url == mock_blob.url
    assert mock_container.create_container.called
    assert mock_blob.upload_blob.call_count == 2
