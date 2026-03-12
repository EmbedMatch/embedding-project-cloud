"""Azure Cosmos DB service."""

from azure.cosmos import CosmosClient
from azure.cosmos.container import ContainerProxy
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


def get_experiments_container(
    client: CosmosClient = Depends(get_cosmos_client),
    settings: Settings = Depends(get_settings),
) -> ContainerProxy:
    """Return the 'experiments' container, creating it if needed."""
    db = client.create_database_if_not_exists(settings.azure_cosmos_database)
    return db.create_container_if_not_exists(
        id="experiments",
        partition_key={"paths": ["/id"], "kind": "Hash"},
    )
