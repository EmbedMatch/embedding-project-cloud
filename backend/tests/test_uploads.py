"""Tests for file upload endpoints."""

import io
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from azure.core.exceptions import AzureError
from azure.storage.blob import BlobServiceClient
from fastapi.testclient import TestClient

from src.main import app
from src.storage import get_blob_service

# Mock the dependency so it doesn't try to parse a real/fake AZURE_STORAGE_CONNECTION_STRING
mock_blob_service = MagicMock(spec=BlobServiceClient)
app.dependency_overrides[get_blob_service] = lambda: mock_blob_service

client = TestClient(app)


@pytest.mark.unit
@patch("src.routers.uploads.upload_blob", new_callable=AsyncMock)
def test_upload_file_success(mock_upload_blob: AsyncMock) -> None:
    """Test successful file upload."""
    mock_upload_blob.return_value = "https://example.blob.core.windows.net/uploads/some-uuid/test.csv"

    file_content = b"header1,header2\nval1,val2"
    file_obj = io.BytesIO(file_content)

    response = client.post(
        "/uploads/",
        files={"file": ("test.csv", file_obj, "text/csv")},
    )

    assert response.status_code == 201
    data = response.json()
    assert "blob_name" in data
    assert data["filename"] == "test.csv"
    assert data["url"] == "https://example.blob.core.windows.net/uploads/some-uuid/test.csv"
    mock_upload_blob.assert_called_once()


@pytest.mark.unit
def test_upload_file_invalid_type() -> None:
    """Test uploading an unsupported file type."""
    file_content = b"fake image content"
    file_obj = io.BytesIO(file_content)

    response = client.post(
        "/uploads/",
        files={"file": ("test.jpg", file_obj, "image/jpeg")},
    )

    assert response.status_code == 415
    assert "Unsupported file type" in response.json()["detail"]


@pytest.mark.unit
@patch("src.routers.uploads.upload_blob", new_callable=AsyncMock)
def test_upload_file_azure_error(mock_upload_blob: AsyncMock) -> None:
    """Test upload error from Azure SDK."""
    mock_upload_blob.side_effect = AzureError("Service unavailable")

    file_content = b"text content"
    file_obj = io.BytesIO(file_content)

    response = client.post(
        "/uploads/",
        files={"file": ("test.txt", file_obj, "text/plain")},
    )

    assert response.status_code == 502
    assert "Azure Storage error" in response.json()["detail"]
