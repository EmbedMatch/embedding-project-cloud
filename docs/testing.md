# Testing

## Setup

Tests live in `backend/tests/`. Dependencies (`pytest`, `pytest-cov`, `pytest-asyncio`) are already in dev deps:

```bash
cd backend
uv sync --dev
```

## Running tests

```bash
# Run unit tests only (default, no Azure credentials needed)
uv run pytest

# Run all tests including integration (requires .env with Azure credentials)
uv run pytest -m ""

# Verbose output
uv run pytest -v

# Run a specific test
uv run pytest tests/test_main.py::test_root
```

## Test markers

All tests must be marked with one of:

| Marker | Meaning | Needs credentials? |
|--------|---------|-------------------|
| `@pytest.mark.unit` | Mocked, no external calls | No |
| `@pytest.mark.integration` | Hits real Azure services | Yes |

CI runs only `unit` tests by default (configured in `pyproject.toml` via `-m "not integration"`).

## Writing a new test

```python
import pytest

@pytest.mark.unit
def test_something() -> None:
    """Describe what you're testing."""
    assert 1 + 1 == 2
```

For tests that call Azure services, mock them:

```python
from unittest.mock import MagicMock, patch

@pytest.mark.unit
@patch("src.main.BlobServiceClient")
def test_with_mock(mock_blob: MagicMock) -> None:
    mock_blob.from_connection_string.return_value.get_account_information.return_value = {
        "sku_name": "Standard_LRS"
    }
    # ... test code
```

## Coverage

Coverage is collected automatically on every run (`--cov=src`). Reports are printed to the terminal and written to `coverage.xml`.

CI enforces **diff-only coverage** using `diff-cover` — only lines changed in your PR are checked. Changed lines must have **≥80% coverage** or the CI fails. Total project coverage is not enforced.

To check diff coverage locally:

```bash
uv run pytest                                                    # generates coverage.xml
uv run diff-cover coverage.xml --compare-branch=main --fail-under=80
```
