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
    list_experiments,
)
from src.main import app

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
@patch("src.routers.experiments.create_experiment")
def test_post_experiment(mock_create: MagicMock) -> None:
    """POST /experiments/ should create and return an experiment."""
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
