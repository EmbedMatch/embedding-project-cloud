"""Main FastAPI application."""

from typing import Any

from azure.cosmos import CosmosClient
from azure.storage.blob import BlobServiceClient
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import AzureOpenAI

from src.config import settings

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


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"status": "ok", "message": "Embedding Model Selection Platform API"}


@app.get("/health")
async def health_check() -> dict[str, Any]:
    """Detailed health check — probes Storage, Cosmos DB, and OpenAI."""
    checks: dict[str, Any] = {}

    # ── Azure Blob Storage ──
    try:
        blob_client = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
        props = blob_client.get_account_information()
        checks["storage"] = {"status": "ok", "sku": props["sku_name"]}
    except Exception as exc:
        checks["storage"] = {"status": "error", "detail": str(exc)}

    # ── Azure Cosmos DB ──
    try:
        cosmos_client = CosmosClient.from_connection_string(settings.azure_cosmos_connection_string)
        db = cosmos_client.get_database_client(settings.azure_cosmos_database)
        db.read()
        checks["cosmos"] = {"status": "ok", "database": settings.azure_cosmos_database}
    except Exception as exc:
        checks["cosmos"] = {"status": "error", "detail": str(exc)}

    # ── Azure OpenAI ──
    try:
        openai_client = AzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version="2024-12-01-preview",
        )
        resp = openai_client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[{"role": "user", "content": "Say 'ok' and nothing else."}],
            max_tokens=3,
        )
        reply = (resp.choices[0].message.content or "").strip()
        checks["openai"] = {"status": "ok", "reply": reply}
    except Exception as exc:
        checks["openai"] = {"status": "error", "detail": str(exc)}

    overall = "healthy" if all(c["status"] == "ok" for c in checks.values()) else "degraded"
    return {"status": overall, "version": "0.1.0", "checks": checks}
