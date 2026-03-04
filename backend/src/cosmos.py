"""Azure Cosmos DB service."""

from azure.cosmos import CosmosClient
from fastapi import Depends, HTTPException, status

from src.config import Settings, get_settings


def get_cosmos_client(settings: Settings = Depends(get_settings)) -> CosmosClient:
    try:
        return CosmosClient.from_connection_string(settings.azure_cosmos_connection_string)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Invalid AZURE_COSMOS_CONNECTION_STRING. "
                "Copy it from Azure Portal → Cosmos DB → Settings → Keys → Primary Connection String."
            ),
        ) from exc
