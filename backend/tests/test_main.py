"""Tests for main application endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


@pytest.mark.unit
def test_root() -> None:
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.unit
@patch("src.main.AzureOpenAI")
@patch("src.main.CosmosClient")
@patch("src.main.BlobServiceClient")
def test_health_check_healthy(mock_blob: MagicMock, mock_cosmos: MagicMock, mock_openai: MagicMock) -> None:
    """Test health check returns healthy when all services respond."""
    # Storage mock
    mock_blob.from_connection_string.return_value.get_account_information.return_value = {"sku_name": "Standard_LRS"}
    # Cosmos mock
    mock_cosmos.from_connection_string.return_value.get_database_client.return_value.read.return_value = {}
    # OpenAI mock
    choice = MagicMock()
    choice.message.content = "ok"
    mock_openai.return_value.chat.completions.create.return_value.choices = [choice]

    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["checks"]["storage"]["status"] == "ok"
    assert data["checks"]["cosmos"]["status"] == "ok"
    assert data["checks"]["openai"]["status"] == "ok"


@pytest.mark.unit
@patch("src.main.AzureOpenAI")
@patch("src.main.CosmosClient")
@patch("src.main.BlobServiceClient")
def test_health_check_degraded(mock_blob: MagicMock, mock_cosmos: MagicMock, mock_openai: MagicMock) -> None:
    """Test health check returns degraded when a service fails."""
    # Storage fails
    mock_blob.from_connection_string.side_effect = Exception("connection refused")
    # Cosmos OK
    mock_cosmos.from_connection_string.return_value.get_database_client.return_value.read.return_value = {}
    # OpenAI OK
    choice = MagicMock()
    choice.message.content = "ok"
    mock_openai.return_value.chat.completions.create.return_value.choices = [choice]

    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["checks"]["storage"]["status"] == "error"
