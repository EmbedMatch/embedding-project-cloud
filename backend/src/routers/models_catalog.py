"""Embedding model catalog endpoint."""

from fastapi import APIRouter

from src.models import EmbeddingModel

router = APIRouter(prefix="/models", tags=["models"])

# Curated catalog of embedding models: Azure OpenAI (API) + open-source (sentence-transformers).
# MTEB scores from https://huggingface.co/spaces/mteb/leaderboard
_CATALOG: list[EmbeddingModel] = [
    # ── Azure OpenAI (API-based) ──
    EmbeddingModel(
        name="Ada 002",
        deployment="text-embedding-ada-002",
        dimensions=1536,
        cost_per_m_tokens=0.10,
        mteb_score=61.0,
        size_mb=500,
        provider="azure_openai",
    ),
    EmbeddingModel(
        name="Text Embedding 3 Large",
        deployment="text-embedding-3-large",
        dimensions=3072,
        cost_per_m_tokens=0.13,
        mteb_score=64.6,
        size_mb=1200,
        provider="azure_openai",
    ),
    # ── Open-source (ONNX Runtime via fastembed, run locally in Function App) ──
    EmbeddingModel(
        name="MiniLM-L6-v2",
        deployment="sentence-transformers/all-MiniLM-L6-v2",
        dimensions=384,
        cost_per_m_tokens=0.00,
        mteb_score=56.3,
        size_mb=80,
        provider="sentence_transformers",
    ),
    EmbeddingModel(
        name="BGE Small EN v1.5",
        deployment="BAAI/bge-small-en-v1.5",
        dimensions=384,
        cost_per_m_tokens=0.00,
        mteb_score=62.2,
        size_mb=130,
        provider="sentence_transformers",
    ),
    EmbeddingModel(
        name="BGE Base EN v1.5",
        deployment="BAAI/bge-base-en-v1.5",
        dimensions=768,
        cost_per_m_tokens=0.00,
        mteb_score=63.6,
        size_mb=420,
        provider="sentence_transformers",
    ),
]


@router.get("/", response_model=list[EmbeddingModel])
def list_models(
    max_cost_per_m: float | None = None,
    min_score: float | None = None,
    max_size_mb: float | None = None,
) -> list[EmbeddingModel]:
    """Return embedding models, optionally filtered by constraints."""
    models = _CATALOG
    if max_cost_per_m is not None:
        models = [m for m in models if m.cost_per_m_tokens <= max_cost_per_m]
    if min_score is not None:
        models = [m for m in models if m.mteb_score >= min_score]
    if max_size_mb is not None:
        models = [m for m in models if m.size_mb <= max_size_mb]
    return models
