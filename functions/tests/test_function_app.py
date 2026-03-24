"""Unit tests for function_app — pure logic only, no Azure calls."""

from unittest.mock import MagicMock

import pytest

from function_app import (
    Config,
    extract_texts,
    parse_dataset,
    run_benchmark,
    resolve_models,
    ALL_MODEL_IDS,
)


# ── parse_dataset ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_parse_csv():
    raw = b"text,category\nhello world,greet\nfoo bar,misc"
    rows = parse_dataset(raw, "csv")
    assert len(rows) == 2
    assert rows[0]["text"] == "hello world"
    assert rows[1]["category"] == "misc"


@pytest.mark.unit
def test_parse_json_list():
    raw = b'[{"text": "a"}, {"text": "b"}]'
    rows = parse_dataset(raw, "json")
    assert len(rows) == 2
    assert rows[0]["text"] == "a"


@pytest.mark.unit
def test_parse_json_object_with_list_key():
    raw = b'{"items": [{"text": "a"}, {"text": "b"}]}'
    rows = parse_dataset(raw, "json")
    assert len(rows) == 2


@pytest.mark.unit
def test_parse_json_plain_object():
    raw = b'{"text": "single item"}'
    rows = parse_dataset(raw, "json")
    assert len(rows) == 1
    assert rows[0]["text"] == "single item"


# ── extract_texts ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_extract_texts_text_key():
    rows = [{"text": "hello", "id": "1"}, {"text": "world", "id": "2"}]
    texts = extract_texts(rows)
    assert texts == ["hello", "world"]


@pytest.mark.unit
def test_extract_texts_content_key():
    rows = [{"content": "abc"}, {"content": "def"}]
    texts = extract_texts(rows)
    assert texts == ["abc", "def"]


@pytest.mark.unit
def test_extract_texts_fallback():
    rows = [{"title": "A", "summary": "B"}]
    texts = extract_texts(rows)
    assert texts == ["A B"]


@pytest.mark.unit
def test_extract_texts_empty_rows():
    assert extract_texts([]) == []


# ── run_benchmark ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_run_benchmark_returns_expected_fields():
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.data = [
        MagicMock(embedding=[0.1, 0.2, 0.3]),
        MagicMock(embedding=[0.4, 0.5, 0.6]),
    ]
    mock_client.embeddings.create.return_value = mock_resp

    texts = ["hello", "world"]
    queries = ["search hello", "search world"]
    judge_scores = [
        {
            "query": "search hello",
            "document_preview": "hello",
            "score": 8,
            "reason": "relevant",
        },
        {
            "query": "search world",
            "document_preview": "world",
            "score": 9,
            "reason": "relevant",
        },
    ]
    result = run_benchmark(mock_client, texts, queries, judge_scores)

    assert result["model"] == Config().embedding_model
    assert result["num_texts"] == 2
    assert result["dimensions"] == 3
    assert "latency_ms" in result
    assert 0.0 <= result["relevance_score"] <= 10.0
    assert "retrieval_accuracy" in result
    assert result["judge_scores"] == judge_scores


@pytest.mark.unit
def test_run_benchmark_batching():
    """With batch_size=2 and 3 texts, should make 2 API calls."""
    mock_client = MagicMock()

    def fake_embed(model, input):
        resp = MagicMock()
        resp.data = [MagicMock(embedding=[0.1, 0.2]) for _ in input]
        return resp

    mock_client.embeddings.create.side_effect = fake_embed

    # Patch batch_size by calling embed_batch directly
    from function_app import embed_batch

    result = embed_batch(mock_client, ["a", "b", "c"], batch_size=2)
    assert result.shape == (3, 2)
    assert mock_client.embeddings.create.call_count == 2


# ── resolve_models ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_resolve_models_with_subset():
    """When experiment has a models field, return that subset."""
    experiment = {"models": ["bge-small-en-v1.5", "text-embedding-ada-002"]}
    result = resolve_models(experiment)
    # Should be reordered to match canonical order
    assert result == ["text-embedding-ada-002", "bge-small-en-v1.5"]


@pytest.mark.unit
def test_resolve_models_without_field():
    """When experiment has no models field, fall back to all models."""
    experiment = {"name": "old-experiment"}
    result = resolve_models(experiment)
    assert result == ALL_MODEL_IDS


@pytest.mark.unit
def test_resolve_models_empty_list():
    """When experiment has an empty models list, fall back to all models."""
    experiment = {"models": []}
    result = resolve_models(experiment)
    assert result == ALL_MODEL_IDS


@pytest.mark.unit
def test_resolve_models_invalid_raises():
    """When ALL entries are unknown models, should raise ValueError."""
    experiment = {"models": ["nonexistent-model"]}
    with pytest.raises(ValueError, match="No valid models"):
        resolve_models(experiment)
