"""Azure Blob Storage service."""

from azure.storage.blob import BlobServiceClient, ContentSettings
from fastapi import Depends, HTTPException, status

from src.config import Settings, get_settings


def get_blob_service(settings: Settings = Depends(get_settings)) -> BlobServiceClient:
    try:
        return BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Invalid AZURE_STORAGE_CONNECTION_STRING. "
                "Copy the full connection string from Azure Portal → Storage Account → Access keys "
                "(starts with 'DefaultEndpointsProtocol=https;'), not just the key."
            ),
        ) from exc


async def upload_blob(
    blob_service: BlobServiceClient,
    container: str,
    blob_name: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload bytes to Azure Blob Storage and return the blob URL."""
    container_client = blob_service.get_container_client(container)
    if not container_client.exists():
        container_client.create_container()

    blob_client = container_client.get_blob_client(blob_name)
    blob_client.upload_blob(
        data,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )
    return blob_client.url
