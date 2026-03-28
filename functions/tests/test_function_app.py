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
def test_run_benchmark_returns_expected_fields(monkeypatch):
    mock_client = MagicMock()
    mock_resp = MagicMock()
    # 3 pool texts, each with 3 dims
    mock_resp.data = [
        MagicMock(embedding=[0.1, 0.2, 0.3]),
        MagicMock(embedding=[0.4, 0.5, 0.6]),
        MagicMock(embedding=[0.7, 0.8, 0.9]),
    ]
    mock_client.embeddings.create.return_value = mock_resp

    # Mock the LLM judge (now called inside run_benchmark)
    fake_judge_scores = [
        {"query": "q1", "document_preview": "hello", "score": 7, "reason": "ok"},
        {"query": "q2", "document_preview": "world", "score": 8, "reason": "ok"},
    ]
    monkeypatch.setattr(
        "function_app.score_relevance_llm", lambda *_args, **_kw: fake_judge_scores
    )

    pool_texts = ["hello", "world", "distractor"]
    eval_texts = ["hello", "world"]
    eval_indices = [0, 1]
    queries = ["find hello", "find world"]

    result = run_benchmark(mock_client, pool_texts, eval_texts, eval_indices, queries)

    assert result["model"] == Config().embedding_model
    assert result["num_texts"] == 3  # full pool size
    assert result["dimensions"] == 3
    assert "latency_ms" in result
    assert 0.0 <= result["relevance_score"] <= 10.0
    assert "mrr" in result
    assert "recall_at_1" in result
    assert "recall_at_5" in result
    assert "recall_at_10" in result
    assert "retrieval_accuracy" in result
    assert result["pool_size"] == 3
    assert result["eval_size"] == 2
    assert result["judge_scores"] == fake_judge_scores
    assert "total_tokens" in result
    assert "cost_usd" in result


@pytest.mark.unit
def test_run_benchmark_batching():
    """With batch_size=2 and 3 texts, should make 2 API calls."""
    mock_client = MagicMock()

    def fake_embed(model, input):
        resp = MagicMock()
        resp.data = [MagicMock(embedding=[0.1, 0.2]) for _ in input]
        resp.usage = MagicMock(total_tokens=10)
        return resp

    mock_client.embeddings.create.side_effect = fake_embed

    # Patch batch_size by calling embed_batch directly
    from function_app import embed_batch

    result, tokens = embed_batch(mock_client, ["a", "b", "c"], batch_size=2)
    assert result.shape == (3, 2)
    assert tokens >= 0
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
