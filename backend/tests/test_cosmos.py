"""Tests for Cosmos DB client helpers and experiment endpoints."""

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.cosmos_client import (
    ExperimentCreate,
    _clean,
    create_experiment,
    get_experiment,
    get_experiment_progress,
    get_experiment_summary,
    list_experiments,
    reset_experiment,
)
from src.main import app
from src.queue import get_queue_service

# Override queue dependency so tests don't need a real connection string
app.dependency_overrides[get_queue_service] = lambda: MagicMock()

client = TestClient(app)


# ── _clean ────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_clean_removes_system_keys() -> None:
    """_clean should strip all Cosmos DB system properties (_rid, _ts, etc.)."""
    doc: dict[str, Any] = {
        "id": "abc",
        "name": "test",
        "_rid": "xxx",
        "_self": "/dbs/...",
        "_ts": 12345,
        "_etag": '"abc"',
    }
    result = _clean(doc)
    assert result == {"id": "abc", "name": "test"}


# ── CRUD helpers ──────────────────────────────────────────────────────────────


@pytest.mark.unit
@patch("src.cosmos_client._get_container")
def test_create_experiment(mock_get_container: MagicMock) -> None:
    """create_experiment should call create_item and return a cleaned document."""
    payload = ExperimentCreate(name="MyExp", blob_name="uploads/data.csv")

    created_doc: dict[str, Any] = {
        "id": "exp-1",
        "name": "MyExp",
        "blob_name": "uploads/data.csv",
        "description": "",
        "dataset_type": "csv",
        "status": "created",
        "created_at": "2025-01-01T00:00:00+00:00",
        "updated_at": "2025-01-01T00:00:00+00:00",
        "results": None,
        "_rid": "xxx",
        "_ts": 1,
    }
    mock_container = MagicMock()
    mock_container.create_item.return_value = created_doc
    mock_get_container.return_value = mock_container

    result = create_experiment(payload)

    mock_container.create_item.assert_called_once()
    assert result["name"] == "MyExp"
    assert "_rid" not in result
    assert "_ts" not in result


@pytest.mark.unit
@patch("src.cosmos_client._get_container")
def test_get_experiment_found(mock_get_container: MagicMock) -> None:
    """get_experiment should return the cleaned document when found."""
    doc: dict[str, Any] = {"id": "exp-1", "name": "X", "_ts": 1}
    mock_container = MagicMock()
    mock_container.read_item.return_value = doc
    mock_get_container.return_value = mock_container

    result = get_experiment("exp-1")
    assert result == {"id": "exp-1", "name": "X"}


@pytest.mark.unit
@patch("src.cosmos_client._get_container")
def test_get_experiment_not_found(mock_get_container: MagicMock) -> None:
    """get_experiment should return None when CosmosResourceNotFoundError is raised."""
    from azure.cosmos.exceptions import CosmosResourceNotFoundError

    mock_container = MagicMock()
    mock_container.read_item.side_effect = CosmosResourceNotFoundError(
        message="Not found", response=MagicMock(status_code=404)
    )
    mock_get_container.return_value = mock_container

    result = get_experiment("nonexistent")
    assert result is None


@pytest.mark.unit
@patch("src.cosmos_client._get_container")
def test_list_experiments(mock_get_container: MagicMock) -> None:
    """list_experiments should return a list of cleaned documents."""
    docs: list[dict[str, Any]] = [
        {"id": "a", "name": "First", "_ts": 2},
        {"id": "b", "name": "Second", "_ts": 1},
    ]
    mock_container = MagicMock()
    mock_container.query_items.return_value = iter(docs)
    mock_get_container.return_value = mock_container

    result = list_experiments()
    assert len(result) == 2
    assert result[0]["id"] == "a"
    assert "_ts" not in result[0]


# ── Experiment router endpoints ───────────────────────────────────────────────


@pytest.mark.unit
@patch("src.routers.experiments.enqueue_benchmark_job")
@patch("src.routers.experiments.create_experiment")
def test_post_experiment(mock_create: MagicMock, mock_enqueue: MagicMock) -> None:
    """POST /experiments/ should create, enqueue, and return an experiment."""
    mock_create.return_value = {
        "id": "exp-1",
        "name": "Test",
        "blob_name": "uploads/f.csv",
        "description": "",
        "dataset_type": "csv",
        "status": "created",
        "created_at": "2025-01-01T00:00:00+00:00",
        "updated_at": "2025-01-01T00:00:00+00:00",
        "results": None,
    }

    response = client.post(
        "/experiments/",
        json={"name": "Test", "blob_name": "uploads/f.csv"},
    )
    assert response.status_code == 201
    assert response.json()["id"] == "exp-1"
    mock_enqueue.assert_called_once()


@pytest.mark.unit
@patch("src.routers.experiments.get_experiment")
def test_get_experiment_endpoint_found(mock_get: MagicMock) -> None:
    """GET /experiments/{id} should return 200 when found."""
    mock_get.return_value = {"id": "exp-1", "name": "Test", "status": "created"}

    response = client.get("/experiments/exp-1")
    assert response.status_code == 200
    assert response.json()["id"] == "exp-1"


@pytest.mark.unit
@patch("src.routers.experiments.get_experiment")
def test_get_experiment_endpoint_not_found(mock_get: MagicMock) -> None:
    """GET /experiments/{id} should return 404 when not found."""
    mock_get.return_value = None

    response = client.get("/experiments/missing-id")
    assert response.status_code == 404


@pytest.mark.unit
@patch("src.routers.experiments.list_experiments")
def test_list_experiments_endpoint(mock_list: MagicMock) -> None:
    """GET /experiments/ should return list of experiments."""
    mock_list.return_value = [
        {"id": "a", "name": "First"},
        {"id": "b", "name": "Second"},
    ]

    response = client.get("/experiments/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["id"] == "a"


# ── Model selection validation ────────────────────────────────────────────────


@pytest.mark.unit
@patch("src.routers.experiments.enqueue_benchmark_job")
@patch("src.routers.experiments.create_experiment")
def test_post_experiment_with_models(mock_create: MagicMock, mock_enqueue: MagicMock) -> None:
    """POST /experiments/ with explicit models stores them."""
    mock_create.return_value = {
        "id": "exp-m1",
        "name": "Test",
        "blob_name": "uploads/f.csv",
        "description": "",
        "dataset_type": "csv",
        "status": "created",
        "models": ["text-embedding-3-large", "bge-small-en-v1.5"],
        "created_at": "2025-01-01T00:00:00+00:00",
        "updated_at": "2025-01-01T00:00:00+00:00",
        "results": None,
    }

    response = client.post(
        "/experiments/",
        json={
            "name": "Test",
            "blob_name": "uploads/f.csv",
            "models": ["text-embedding-3-large", "bge-small-en-v1.5"],
        },
    )
    assert response.status_code == 201
    assert response.json()["models"] == ["text-embedding-3-large", "bge-small-en-v1.5"]


@pytest.mark.unit
@patch("src.routers.experiments.enqueue_benchmark_job")
@patch("src.routers.experiments.create_experiment")
def test_post_experiment_default_models(mock_create: MagicMock, mock_enqueue: MagicMock) -> None:
    """POST /experiments/ without models stores the full default list."""
    mock_create.return_value = {
        "id": "exp-d",
        "name": "Test",
        "blob_name": "uploads/f.csv",
        "description": "",
        "dataset_type": "csv",
        "status": "created",
        "models": [
            "text-embedding-ada-002",
            "text-embedding-3-large",
            "all-MiniLM-L6-v2",
            "bge-base-en-v1.5",
            "bge-small-en-v1.5",
        ],
        "created_at": "2025-01-01T00:00:00+00:00",
        "updated_at": "2025-01-01T00:00:00+00:00",
        "results": None,
    }

    response = client.post(
        "/experiments/",
        json={"name": "Test", "blob_name": "uploads/f.csv"},
    )
    assert response.status_code == 201
    assert len(response.json()["models"]) == 5


@pytest.mark.unit
def test_post_experiment_invalid_model() -> None:
    """POST /experiments/ with an unknown model should return 422."""
    response = client.post(
        "/experiments/",
        json={"name": "Test", "blob_name": "uploads/f.csv", "models": ["nonexistent-model"]},
    )
    assert response.status_code == 422


@pytest.mark.unit
def test_post_experiment_duplicate_model() -> None:
    """POST /experiments/ with duplicate models should return 422."""
    response = client.post(
        "/experiments/",
        json={
            "name": "Test",
            "blob_name": "uploads/f.csv",
            "models": ["text-embedding-ada-002", "text-embedding-ada-002"],
        },
    )
    assert response.status_code == 422


@pytest.mark.unit
def test_post_experiment_empty_models() -> None:
    """POST /experiments/ with an empty models list should return 422."""
    response = client.post(
        "/experiments/",
        json={"name": "Test", "blob_name": "uploads/f.csv", "models": []},
    )
    assert response.status_code == 422


# ── 2.6: Progress polling ─────────────────────────────────────────────────────


@pytest.mark.unit
@patch("src.cosmos_client.get_experiment")
def test_get_experiment_progress_partial_results(mock_get: MagicMock) -> None:
    """get_experiment_progress should compute correct % when some models are done."""
    mock_get.return_value = {
        "id": "exp-1",
        "status": "processing",
        "models": ["ada-002", "bge-base", "miniLM"],
        "results": [
            {"model": "ada-002", "relevance_score": 7.5},
        ],
        "updated_at": "2025-01-01T00:00:00+00:00",
    }
    result = get_experiment_progress("exp-1")
    assert result is not None
    assert result["progress_percent"] == pytest.approx(33.3, abs=0.1)
    assert result["completed_models"] == 1
    assert result["total_models"] == 3
    # Check per-model breakdown
    statuses = {m["model"]: m["status"] for m in result["per_model"]}
    assert statuses["ada-002"] == "done"
    assert statuses["bge-base"] == "pending"
    assert statuses["miniLM"] == "pending"


@pytest.mark.unit
@patch("src.cosmos_client.get_experiment")
def test_get_experiment_progress_no_results(mock_get: MagicMock) -> None:
    """get_experiment_progress with no results should show 0% progress."""
    mock_get.return_value = {
        "id": "exp-2",
        "status": "processing",
        "models": ["ada-002", "bge-base"],
        "results": None,
        "updated_at": "2025-01-01T00:00:00+00:00",
    }
    result = get_experiment_progress("exp-2")
    assert result is not None
    assert result["progress_percent"] == 0.0
    assert result["completed_models"] == 0


@pytest.mark.unit
@patch("src.cosmos_client.get_experiment")
def test_get_experiment_progress_not_found(mock_get: MagicMock) -> None:
    """get_experiment_progress returns None for non-existent experiment."""
    mock_get.return_value = None
    result = get_experiment_progress("missing")
    assert result is None


@pytest.mark.unit
@patch("src.cosmos_client.get_experiment")
def test_get_experiment_progress_with_failed_model(mock_get: MagicMock) -> None:
    """get_experiment_progress should mark errored models as 'failed'."""
    mock_get.return_value = {
        "id": "exp-3",
        "status": "processing",
        "models": ["ada-002", "bge-base"],
        "results": [
            {"model": "ada-002", "error": "Model benchmark failed"},
        ],
        "updated_at": "2025-01-01T00:00:00+00:00",
    }
    result = get_experiment_progress("exp-3")
    assert result is not None
    statuses = {m["model"]: m["status"] for m in result["per_model"]}
    assert statuses["ada-002"] == "failed"
    assert statuses["bge-base"] == "pending"


@pytest.mark.unit
@patch("src.routers.experiments.get_experiment_progress")
def test_progress_endpoint_found(mock_progress: MagicMock) -> None:
    """GET /experiments/{id}/progress returns 200 with progress data."""
    mock_progress.return_value = {
        "id": "exp-1",
        "status": "processing",
        "progress_percent": 50.0,
        "completed_models": 1,
        "total_models": 2,
        "per_model": [],
        "updated_at": "2025-01-01T00:00:00+00:00",
    }
    response = client.get("/experiments/exp-1/progress")
    assert response.status_code == 200
    assert response.json()["progress_percent"] == 50.0


@pytest.mark.unit
@patch("src.routers.experiments.get_experiment_progress")
def test_progress_endpoint_not_found(mock_progress: MagicMock) -> None:
    """GET /experiments/{id}/progress returns 404 for missing experiment."""
    mock_progress.return_value = None
    response = client.get("/experiments/missing/progress")
    assert response.status_code == 404


# ── 2.7: Re-trigger ───────────────────────────────────────────────────────────


@pytest.mark.unit
@patch("src.cosmos_client._get_container")
def test_reset_experiment_success(mock_get_container: MagicMock) -> None:
    """reset_experiment should clear results, reset status, and update timestamp."""
    existing_doc: dict[str, Any] = {
        "id": "exp-1",
        "name": "Test",
        "blob_name": "uploads/f.csv",
        "description": "",
        "dataset_type": "csv",
        "status": "completed",
        "models": ["ada-002"],
        "results": [{"model": "ada-002", "relevance_score": 7.5}],
        "error": "some old error",
        "created_at": "2025-01-01T00:00:00+00:00",
        "updated_at": "2025-01-01T00:00:00+00:00",
    }
    mock_container = MagicMock()
    mock_container.read_item.return_value = existing_doc
    mock_get_container.return_value = mock_container

    result = reset_experiment("exp-1")

    assert result is not None
    assert result["status"] == "created"
    assert result["results"] is None
    assert "error" not in result
    mock_container.replace_item.assert_called_once()


@pytest.mark.unit
@patch("src.cosmos_client._get_container")
def test_reset_experiment_not_found(mock_get_container: MagicMock) -> None:
    """reset_experiment returns None for non-existent experiment."""
    from azure.cosmos.exceptions import CosmosResourceNotFoundError

    mock_container = MagicMock()
    mock_container.read_item.side_effect = CosmosResourceNotFoundError(
        message="Not found", response=MagicMock(status_code=404)
    )
    mock_get_container.return_value = mock_container

    result = reset_experiment("missing")
    assert result is None


@pytest.mark.unit
@patch("src.routers.experiments.enqueue_benchmark_job")
@patch("src.routers.experiments.reset_experiment")
def test_retrigger_endpoint_success(mock_reset: MagicMock, mock_enqueue: MagicMock) -> None:
    """POST /experiments/{id}/retrigger returns 200 and re-enqueues."""
    mock_reset.return_value = {
        "id": "exp-1",
        "status": "created",
        "results": None,
    }
    response = client.post("/experiments/exp-1/retrigger")
    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Experiment re-triggered"
    assert body["experiment"]["status"] == "created"
    mock_enqueue.assert_called_once()


@pytest.mark.unit
@patch("src.routers.experiments.reset_experiment")
def test_retrigger_endpoint_not_found(mock_reset: MagicMock) -> None:
    """POST /experiments/{id}/retrigger returns 404 for missing experiment."""
    mock_reset.return_value = None
    response = client.post("/experiments/missing/retrigger")
    assert response.status_code == 404


# ── 2.8: Summary / recommendation ────────────────────────────────────────────


@pytest.mark.unit
@patch("src.cosmos_client.get_experiment")
def test_get_experiment_summary_ranking(mock_get: MagicMock) -> None:
    """get_experiment_summary should rank models by composite score."""
    mock_get.return_value = {
        "id": "exp-1",
        "status": "completed",
        "results": [
            {
                "model": "model-A",
                "relevance_score": 6.0,
                "retrieval_accuracy": 0.8,
                "latency_ms": 1000,
            },
            {
                "model": "model-B",
                "relevance_score": 8.0,
                "retrieval_accuracy": 0.9,
                "latency_ms": 500,
            },
        ],
    }
    result = get_experiment_summary("exp-1")
    assert result is not None
    assert result["ranked_models"][0]["model"] == "model-B"
    assert result["ranked_models"][0]["rank"] == 1
    assert result["ranked_models"][1]["rank"] == 2
    assert result["recommendation"]["model"] == "model-B"
    assert result["recommendation"]["composite_score"] > 0


@pytest.mark.unit
@patch("src.cosmos_client.get_experiment")
def test_get_experiment_summary_not_completed(mock_get: MagicMock) -> None:
    """get_experiment_summary should raise ValueError if not completed."""
    mock_get.return_value = {
        "id": "exp-1",
        "status": "processing",
        "results": [],
    }
    with pytest.raises(ValueError, match="not 'completed'"):
        get_experiment_summary("exp-1")


@pytest.mark.unit
@patch("src.cosmos_client.get_experiment")
def test_get_experiment_summary_not_found(mock_get: MagicMock) -> None:
    """get_experiment_summary returns None for non-existent experiment."""
    mock_get.return_value = None
    result = get_experiment_summary("missing")
    assert result is None


@pytest.mark.unit
@patch("src.cosmos_client.get_experiment")
def test_get_experiment_summary_all_failed(mock_get: MagicMock) -> None:
    """get_experiment_summary handles case where all models failed."""
    mock_get.return_value = {
        "id": "exp-1",
        "status": "completed",
        "results": [
            {"model": "model-A", "error": "failed"},
            {"model": "model-B", "error": "failed"},
        ],
    }
    result = get_experiment_summary("exp-1")
    assert result is not None
    assert result["ranked_models"] == []
    assert result["recommendation"] is None
    assert "All models failed" in result["message"]


@pytest.mark.unit
@patch("src.cosmos_client.get_experiment")
def test_get_experiment_summary_composite_score_math(mock_get: MagicMock) -> None:
    """Verify composite score formula: 0.5*rel + 0.3*ret*10 + 0.2*speed*10."""
    mock_get.return_value = {
        "id": "exp-1",
        "status": "completed",
        "results": [
            {
                "model": "only-model",
                "relevance_score": 8.0,
                "retrieval_accuracy": 0.9,
                "latency_ms": 100,
            },
        ],
    }
    result = get_experiment_summary("exp-1")
    assert result is not None
    # Single model → normalized_latency = 100/100 = 1.0, speed_score = 0
    # composite = 0.5*8.0 + 0.3*(0.9*10) + 0.2*(0*10) = 4.0 + 2.7 + 0 = 6.7
    assert result["ranked_models"][0]["composite_score"] == pytest.approx(6.7, abs=0.01)


@pytest.mark.unit
@patch("src.routers.experiments.get_experiment_summary")
def test_summary_endpoint_success(mock_summary: MagicMock) -> None:
    """GET /experiments/{id}/summary returns 200 with recommendation."""
    mock_summary.return_value = {
        "id": "exp-1",
        "status": "completed",
        "ranked_models": [{"model": "best", "rank": 1, "composite_score": 9.0}],
        "recommendation": {"model": "best", "composite_score": 9.0},
    }
    response = client.get("/experiments/exp-1/summary")
    assert response.status_code == 200
    assert response.json()["recommendation"]["model"] == "best"


@pytest.mark.unit
@patch("src.routers.experiments.get_experiment_summary")
def test_summary_endpoint_not_completed(mock_summary: MagicMock) -> None:
    """GET /experiments/{id}/summary returns 400 if experiment not completed."""
    mock_summary.side_effect = ValueError("not 'completed'")
    response = client.get("/experiments/exp-1/summary")
    assert response.status_code == 400


@pytest.mark.unit
@patch("src.routers.experiments.get_experiment_summary")
def test_summary_endpoint_not_found(mock_summary: MagicMock) -> None:
    """GET /experiments/{id}/summary returns 404 for missing experiment."""
    mock_summary.return_value = None
    response = client.get("/experiments/missing/summary")
    assert response.status_code == 404
