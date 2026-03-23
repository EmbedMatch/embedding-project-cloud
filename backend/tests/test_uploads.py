"""Unit tests for file upload endpoints."""

import io
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from azure.core.exceptions import AzureError
from azure.storage.blob import BlobServiceClient
from fastapi.testclient import TestClient

from src.main import app
from src.storage import get_blob_service

# ── Mock the blob-service dependency globally ─────────────────────────────────
mock_blob_service = MagicMock(spec=BlobServiceClient)
app.dependency_overrides[get_blob_service] = lambda: mock_blob_service

client = TestClient(app)

# ── Helpers ───────────────────────────────────────────────────────────────────

FAKE_URL = "https://example.blob.core.windows.net/uploads/some-uuid/test.csv"


def _post_file(filename: str, content: bytes, content_type: str) -> object:
    return client.post(
        "/uploads/",
        files={"file": (filename, io.BytesIO(content), content_type)},
    )


# ── Happy-path ────────────────────────────────────────────────────────────────


@pytest.mark.unit
@patch("src.routers.uploads.upload_blob", new_callable=AsyncMock)
def test_upload_csv_success(mock_upload_blob: AsyncMock) -> None:
    """Successful CSV upload returns 201 with the structured UploadSuccess body."""
    mock_upload_blob.return_value = FAKE_URL

    response = _post_file("dataset.csv", b"header1,header2\nval1,val2", "text/csv")

    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "dataset.csv"
    assert data["url"] == FAKE_URL
    assert data["size_bytes"] == len(b"header1,header2\nval1,val2")
    assert data["content_type"] == "text/csv"
    assert "blob_name" in data
    mock_upload_blob.assert_called_once()


@pytest.mark.unit
@patch("src.routers.uploads.upload_blob", new_callable=AsyncMock)
def test_upload_json_success(mock_upload_blob: AsyncMock) -> None:
    """Successful JSON upload returns 201."""
    mock_upload_blob.return_value = "https://example.blob.core.windows.net/uploads/x/data.json"

    response = _post_file("data.json", b'{"key": "value"}', "application/json")
    assert response.status_code == 201
    assert response.json()["filename"] == "data.json"


@pytest.mark.unit
@patch("src.routers.uploads.upload_blob", new_callable=AsyncMock)
def test_upload_txt_success(mock_upload_blob: AsyncMock) -> None:
    """Successful plain-text upload returns 201."""
    mock_upload_blob.return_value = "https://example.blob.core.windows.net/uploads/x/notes.txt"

    response = _post_file("notes.txt", b"some text", "text/plain")
    assert response.status_code == 201


@pytest.mark.unit
@patch("src.routers.uploads.upload_blob", new_callable=AsyncMock)
def test_upload_alias_content_type(mock_upload_blob: AsyncMock) -> None:
    """CSV sent as application/vnd.ms-excel (Excel alias) is accepted."""
    mock_upload_blob.return_value = FAKE_URL

    response = _post_file("data.csv", b"a,b\n1,2", "application/vnd.ms-excel")
    assert response.status_code == 201
    # Resolved content type should be normalised to text/csv
    assert response.json()["content_type"] == "text/csv"


# ── Extension validation ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_upload_invalid_extension_jpg() -> None:
    """Rejected: .jpg extension."""
    response = _post_file("photo.jpg", b"fake image", "image/jpeg")
    assert response.status_code == 415
    body = response.json()
    assert body["detail"]["error"] == "invalid_extension"
    assert "allowed_extensions" in body["detail"]


@pytest.mark.unit
def test_upload_invalid_extension_pdf() -> None:
    """Rejected: .pdf extension."""
    response = _post_file("report.pdf", b"%PDF", "application/pdf")
    assert response.status_code == 415
    body = response.json()
    assert body["detail"]["error"] == "invalid_extension"


@pytest.mark.unit
def test_upload_no_extension() -> None:
    """Rejected: filename without extension."""
    response = _post_file("datafile", b"raw content", "text/plain")
    assert response.status_code == 415
    body = response.json()
    assert body["detail"]["error"] == "invalid_extension"


# ── MIME-type validation ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_upload_invalid_content_type() -> None:
    """Rejected: .csv file sent with image/jpeg content-type."""
    response = _post_file("tricky.csv", b"a,b", "image/jpeg")
    assert response.status_code == 415
    body = response.json()
    # Extension is valid (.csv) but MIME is rejected
    assert body["detail"]["error"] == "invalid_content_type"
    assert "allowed_types" in body["detail"]


# ── Size validation ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_upload_file_too_large() -> None:
    """Rejected: file exceeds the configured MAX_FILE_SIZE_BYTES."""
    from src.routers import uploads

    with patch.object(uploads, "MAX_FILE_SIZE_BYTES", 10):
        response = _post_file("big.txt", b"this is more than 10 bytes", "text/plain")

    assert response.status_code == 413
    body = response.json()
    assert body["detail"]["error"] == "file_too_large"
    assert "max_size_mb" in body["detail"]


# ── Filename required ─────────────────────────────────────────────────────────


@pytest.mark.unit
def test_upload_missing_filename() -> None:
    """Rejected: file submitted without a filename.

    FastAPI passes the empty filename to our router; the extension check
    fires first and returns 415 because '' has no recognised extension.
    """
    response = client.post(
        "/uploads/",
        files={"file": ("", io.BytesIO(b"data"), "text/plain")},
    )
    # Empty filename → no extension → 415 Unsupported Media Type
    assert response.status_code in {415, 422}
    if response.status_code == 415:
        assert response.json()["detail"]["error"] == "invalid_extension"


# ── Azure error propagation ───────────────────────────────────────────────────


@pytest.mark.unit
@patch("src.routers.uploads.upload_blob", new_callable=AsyncMock)
def test_upload_azure_error(mock_upload_blob: AsyncMock) -> None:
    """Azure Storage SDK errors are surfaced as 502 with structured body."""
    mock_upload_blob.side_effect = AzureError("Service unavailable")

    response = _post_file("data.csv", b"a,b\n1,2", "text/csv")

    assert response.status_code == 502
    body = response.json()
    assert body["detail"]["error"] == "storage_error"
    assert "Azure Storage error" in body["detail"]["detail"]
