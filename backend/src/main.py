"""Main FastAPI application."""

from typing import Any

from azure.core.exceptions import AzureError
from azure.cosmos import CosmosClient
from azure.storage.blob import BlobServiceClient
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import AzureOpenAI

from src.config import get_settings
from src.cosmos import get_cosmos_client
from src.openai_client import get_openai_client
from src.routers import chat, experiments, models_catalog, uploads
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
app.include_router(chat.router)
app.include_router(experiments.router)
app.include_router(models_catalog.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok", "message": "Embedding Model Selection Platform API"}


@app.get("/health")
async def health_check(
    blob_service: BlobServiceClient = Depends(get_blob_service),
    cosmos_client: CosmosClient = Depends(get_cosmos_client),
    openai_client: AzureOpenAI = Depends(get_openai_client),
) -> dict[str, Any]:
    """Probe all Azure services and report their status."""
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

    # Check Azure OpenAI — minimal 1-token completion
    try:
        openai_client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )
        checks["llm"] = "ok"
    except Exception as exc:
        checks["llm"] = f"error: {exc}"

    checks["status"] = "healthy" if all(v == "ok" for k, v in checks.items() if k not in ("version", "status")) else "degraded"
    return checks
