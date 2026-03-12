"""Embedding model catalog endpoint."""

from fastapi import APIRouter

from src.models import EmbeddingModel

router = APIRouter(prefix="/models", tags=["models"])

# Curated catalog of Azure OpenAI embedding models available in this deployment.
# Metadata sourced from MTEB leaderboard and Azure OpenAI pricing (March 2025).
_CATALOG: list[EmbeddingModel] = [
    EmbeddingModel(
        name="Ada 002",
        deployment="text-embedding-ada-002",
        dimensions=1536,
        cost_per_m_tokens=0.10,
        mteb_score=61.0,
        size_mb=500,
    ),
    EmbeddingModel(
        name="Text Embedding 3 Large",
        deployment="text-embedding-3-large",
        dimensions=3072,
        cost_per_m_tokens=0.13,
        mteb_score=64.6,
        size_mb=1200,
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
