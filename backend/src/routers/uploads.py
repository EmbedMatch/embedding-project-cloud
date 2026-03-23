"""File upload endpoints."""

import uuid

from azure.core.exceptions import AzureError
from azure.storage.blob import BlobServiceClient
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel

from src.config import Settings, get_settings
from src.storage import get_blob_service, upload_blob

router = APIRouter(prefix="/uploads", tags=["uploads"])

# ── Validation constants ──────────────────────────────────────────────────────

ALLOWED_CONTENT_TYPES = {"text/csv", "application/json", "text/plain"}

# Some browsers / clients send these MIME types for CSV / plain-text files
ALIAS_CONTENT_TYPES: dict[str, str] = {
    "application/vnd.ms-excel": "text/csv",  # .csv opened by Excel
    "application/octet-stream": "text/plain",  # generic binary fallback
}

ALLOWED_EXTENSIONS = {".csv", ".json", ".txt"}

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES // (1024 * 1024)


# ── Response / error models ───────────────────────────────────────────────────


class UploadSuccess(BaseModel):
    """Successful upload response."""

    blob_name: str
    url: str
    filename: str
    size_bytes: int
    content_type: str


class UploadError(BaseModel):
    """Structured error response for upload validation failures."""

    error: str
    detail: str
    allowed_types: list[str] | None = None
    allowed_extensions: list[str] | None = None
    max_size_mb: int | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _resolve_content_type(raw: str | None) -> str | None:
    """Normalise aliased content-types to their canonical form."""
    if raw is None:
        return None
    return ALIAS_CONTENT_TYPES.get(raw, raw)


def _file_extension(filename: str | None) -> str:
    """Return the lower-cased file extension (e.g. '.csv'), or empty string."""
    if not filename:
        return ""
    dot = filename.rfind(".")
    return filename[dot:].lower() if dot != -1 else ""


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    response_model=UploadSuccess,
    responses={
        status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: {"model": UploadError},
        status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": UploadError},
        status.HTTP_413_CONTENT_TOO_LARGE: {"model": UploadError},
        status.HTTP_502_BAD_GATEWAY: {"model": UploadError},
    },
)
async def upload_file(
    file: UploadFile,
    settings: Settings = Depends(get_settings),
    blob_service: BlobServiceClient = Depends(get_blob_service),
) -> UploadSuccess:
    """Upload a dataset file to Azure Blob Storage.

    Validation rules (in order):
    1. File must be provided with a filename.
    2. File extension must be one of: .csv, .json, .txt
    3. MIME type must match an allowed type (aliased types are normalised).
    4. File body must not exceed 50 MB.
    """

    # ── 1. Filename required ──
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=UploadError(
                error="missing_filename",
                detail="A filename is required. Please provide a file with a name.",
            ).model_dump(),
        )

    # ── 2. Extension check ──
    ext = _file_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=UploadError(
                error="invalid_extension",
                detail=f"File extension '{ext or '(none)'}' is not permitted.",
                allowed_extensions=sorted(ALLOWED_EXTENSIONS),
            ).model_dump(),
        )

    # ── 3. MIME-type check ──
    resolved_type = _resolve_content_type(file.content_type)
    if resolved_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=UploadError(
                error="invalid_content_type",
                detail=f"Content-Type '{file.content_type}' is not permitted.",
                allowed_types=sorted(ALLOWED_CONTENT_TYPES),
            ).model_dump(),
        )

    # ── 4. Size check ──
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=UploadError(
                error="file_too_large",
                detail=f"File size {len(contents) // (1024 * 1024)} MB exceeds the {MAX_FILE_SIZE_MB} MB limit.",
                max_size_mb=MAX_FILE_SIZE_MB,
            ).model_dump(),
        )

    # ── Upload ──
    blob_name = f"{uuid.uuid4()}/{file.filename}"
    try:
        url = await upload_blob(
            blob_service,
            container=settings.azure_storage_container,
            blob_name=blob_name,
            data=contents,
            content_type=resolved_type or "application/octet-stream",
        )
    except AzureError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=UploadError(
                error="storage_error",
                detail=f"Azure Storage error: {exc}",
            ).model_dump(),
        ) from exc

    return UploadSuccess(
        blob_name=blob_name,
        url=url,
        filename=file.filename,
        size_bytes=len(contents),
        content_type=resolved_type or "application/octet-stream",
    )
