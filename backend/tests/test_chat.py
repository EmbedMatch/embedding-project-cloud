"""Tests for chat endpoints."""

from types import SimpleNamespace
from unittest.mock import Mock

from fastapi.testclient import TestClient

from src.main import app
from src.routers import chat as chat_router

client = TestClient(app)


def _set_openai_settings(monkeypatch: object) -> None:
    """Populate OpenAI settings used by chat endpoint for tests."""
    monkeypatch.setattr(
        chat_router.settings,
        "azure_openai_endpoint",
        "https://example.openai.azure.com",
        raising=False,
    )
    monkeypatch.setattr(chat_router.settings, "azure_openai_api_key", "test-key", raising=False)
    monkeypatch.setattr(chat_router.settings, "azure_openai_deployment", "gpt-4o-mini", raising=False)


def test_chat_endpoint_success(monkeypatch: object) -> None:
    """Chat endpoint returns reply/model/usage when OpenAI call succeeds."""
    _set_openai_settings(monkeypatch)

    usage = SimpleNamespace(prompt_tokens=10, completion_tokens=7, total_tokens=17)
    message = SimpleNamespace(content="connection ok")
    choice = SimpleNamespace(message=message)
    response_obj = SimpleNamespace(choices=[choice], model="gpt-4o-mini", usage=usage)

    create_mock = Mock(return_value=response_obj)
    mock_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create_mock)))
    azure_openai_mock = Mock(return_value=mock_client)

    monkeypatch.setattr(chat_router, "AzureOpenAI", azure_openai_mock)

    response = client.post("/chat/", json={"prompt": "Say hello"})

    assert response.status_code == 200
    assert response.json()["reply"] == "connection ok"
    assert response.json()["model"] == "gpt-4o-mini"
    assert response.json()["usage"]["total_tokens"] == 17

    assert create_mock.call_count == 1
    call_kwargs = create_mock.call_args.kwargs
    assert call_kwargs["max_tokens"] == 512


def test_chat_endpoint_failure(monkeypatch: object) -> None:
    """Chat endpoint returns 500 when OpenAI request raises unexpected error."""
    _set_openai_settings(monkeypatch)

    create_mock = Mock(side_effect=RuntimeError("unexpected failure"))
    mock_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create_mock)))
    azure_openai_mock = Mock(return_value=mock_client)

    monkeypatch.setattr(chat_router, "AzureOpenAI", azure_openai_mock)

    response = client.post("/chat/", json={"prompt": "hello"})

    assert response.status_code == 500
    assert response.json()["detail"] == "Unexpected error while calling Azure OpenAI."


def test_chat_test_page_returns_html() -> None:
    """Chat test page endpoint returns HTML content."""
    response = client.get("/chat/test")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Azure OpenAI Chat Test" in response.text
