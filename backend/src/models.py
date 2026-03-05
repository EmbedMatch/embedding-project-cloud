"""Shared Pydantic models for experiments and benchmarking."""

from typing import Literal

from pydantic import BaseModel, Field


class Constraints(BaseModel):
    max_size_mb: float = 2000.0
    max_cost_per_m: float = 50.0
    min_score: float = 0.0


class ModelResult(BaseModel):
    model_name: str
    retrieval_score: float  # 0–1, LLM-judge average across queries
    latency_ms: float       # average embedding latency per doc
    cost_per_m_tokens: float
    dimensions: int


class BenchmarkProgress(BaseModel):
    current_model: str
    completed_models: int
    total_models: int


class Experiment(BaseModel):
    id: str
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    created_at: str  # ISO datetime
    task_type: Literal["retrieval", "classification"] = "retrieval"
    blob_name: str
    blob_url: str
    constraints: Constraints = Field(default_factory=Constraints)
    selected_models: list[str] = Field(default_factory=list)
    results: list[ModelResult] = Field(default_factory=list)
    progress: BenchmarkProgress | None = None
    error: str | None = None


class EmbeddingModel(BaseModel):
    name: str            # display name
    deployment: str      # Azure OpenAI deployment name or HuggingFace model ID
    dimensions: int
    cost_per_m_tokens: float
    mteb_score: float    # approximate MTEB average score
    size_mb: float       # approximate model size
    provider: str = "azure_openai"  # "azure_openai" or "sentence_transformers"
