"""File upload endpoints."""

import uuid

from azure.core.exceptions import AzureError
from azure.storage.blob import BlobServiceClient
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from src.config import Settings, get_settings
from src.storage import get_blob_service, upload_blob

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_CONTENT_TYPES = {"text/csv", "application/json", "text/plain"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile,
    settings: Settings = Depends(get_settings),
    blob_service: BlobServiceClient = Depends(get_blob_service),
) -> dict[str, str]:
    """Upload a file to Azure Blob Storage."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: {ALLOWED_CONTENT_TYPES}",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_FILE_SIZE // (1024 * 1024)} MB limit.",
        )

    blob_name = f"{uuid.uuid4()}/{file.filename}"
    try:
        url = await upload_blob(
            blob_service,
            container=settings.azure_storage_container,
            blob_name=blob_name,
            data=contents,
            content_type=file.content_type or "application/octet-stream",
        )
    except AzureError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Azure Storage error: {exc}",
        ) from exc

    return {"blob_name": blob_name, "url": url, "filename": file.filename or ""}
