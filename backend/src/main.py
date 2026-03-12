"""Main FastAPI application."""

from typing import Any

from azure.core.exceptions import AzureError
from azure.cosmos import CosmosClient
from azure.storage.blob import BlobServiceClient
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.cosmos import get_cosmos_client
from src.routers import uploads
from src.storage import get_blob_service

settings = get_settings()

app = FastAPI(
    title="Embedding Model Selection Platform",
    description="API for benchmarking and selecting embedding models",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(uploads.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok", "message": "Embedding Model Selection Platform API"}


@app.get("/health")
async def health_check(
    blob_service: BlobServiceClient = Depends(get_blob_service),
    cosmos_client: CosmosClient = Depends(get_cosmos_client),
) -> dict[str, Any]:
    """Probe both Azure services and report their status."""
    checks: dict[str, Any] = {"version": "0.1.0"}

    # Check Blob Storage — fetch account properties (cheap, no list needed)
    try:
        blob_service.get_account_information()
        checks["storage"] = "ok"
    except Exception as exc:
        checks["storage"] = f"error: {exc}"

    # Check Cosmos DB — list databases (cheap read operation)
    try:
        next(iter(cosmos_client.list_databases()), None)
        checks["cosmos"] = "ok"
    except Exception as exc:
        checks["cosmos"] = f"error: {exc}"

    checks["status"] = "healthy" if all(v == "ok" for k, v in checks.items() if k not in ("version", "status")) else "degraded"
    return checks
