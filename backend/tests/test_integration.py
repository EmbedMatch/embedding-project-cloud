"""End-to-end integration tests against the deployed Azure App Service.

These tests hit the live backend and are intentionally skipped in normal CI
runs (they require network access and a whitelisted IP on the Azure App Service).

Before running, set the INTEGRATION_BASE_URL environment variable to the
actual deployed app URL:

    export INTEGRATION_BASE_URL=https://<your-app-name>.azurewebsites.net
    pytest -m integration tests/test_integration.py -v

If your local IP is not whitelisted on the Azure App Service (Networking →
Access restrictions), add it first or run from an allowed network.

Environment variable (required for local runs):
    INTEGRATION_BASE_URL  – the full base URL of the deployed backend API
"""

import io
import os
import time

import pytest
import requests

# ── Config ────────────────────────────────────────────────────────────────────

# The app is called 'embed-match-web' in cloud_config.md — update this value
# (or set INTEGRATION_BASE_URL) if the actual Azure App Service name differs.
BASE_URL = os.getenv(
    "INTEGRATION_BASE_URL",
    "https://embed-match-web.azurewebsites.net",
).rstrip("/")

TIMEOUT = 30  # seconds per request

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def session() -> requests.Session:
    """Shared requests session so connections are reused across tests."""
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


# ── Health check ──────────────────────────────────────────────────────────────


@pytest.mark.integration
def test_health_endpoint_reachable(session: requests.Session) -> None:
    """GET /health should return HTTP 200."""
    resp = session.get(f"{BASE_URL}/health", timeout=TIMEOUT)
    assert resp.status_code == 200, f"Unexpected status: {resp.status_code}\n{resp.text}"


@pytest.mark.integration
def test_health_response_structure(session: requests.Session) -> None:
    """GET /health response must include 'status' and 'checks' keys."""
    resp = session.get(f"{BASE_URL}/health", timeout=TIMEOUT)
    resp.raise_for_status()
    body = resp.json()

    assert "status" in body, "Missing 'status' key in health response"
    assert "checks" in body, "Missing 'checks' key in health response"
    assert body["status"] in {"healthy", "degraded"}, f"Unexpected status value: {body['status']}"

    for svc in ("storage", "cosmos", "openai"):
        assert svc in body["checks"], f"Missing '{svc}' in health checks"
        assert "status" in body["checks"][svc], f"Missing 'status' inside checks.{svc}"


@pytest.mark.integration
def test_health_returns_version(session: requests.Session) -> None:
    """GET /health should include a 'version' field."""
    resp = session.get(f"{BASE_URL}/health", timeout=TIMEOUT)
    resp.raise_for_status()
    assert "version" in resp.json(), "Missing 'version' key in health response"


# ── Upload ────────────────────────────────────────────────────────────────────


@pytest.mark.integration
def test_upload_valid_csv(session: requests.Session) -> None:
    """POST /uploads/ with a valid CSV file should return 201 and a blob URL."""
    csv_bytes = b"sentence,label\nThe dog barked,animal\nThe cat purred,animal\n"
    files = {"file": ("integration_test.csv", io.BytesIO(csv_bytes), "text/csv")}

    resp = session.post(f"{BASE_URL}/uploads/", files=files, timeout=TIMEOUT)
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}\n{resp.text}"

    body = resp.json()
    assert "blob_name" in body
    assert "url" in body
    assert body["filename"] == "integration_test.csv"
    assert body["url"].startswith("https://")


@pytest.mark.integration
def test_upload_rejects_invalid_extension(session: requests.Session) -> None:
    """POST /uploads/ with a .exe file should be rejected with 415."""
    files = {"file": ("malware.exe", io.BytesIO(b"MZ fake exe"), "application/octet-stream")}

    resp = session.post(f"{BASE_URL}/uploads/", files=files, timeout=TIMEOUT)
    assert resp.status_code == 415, f"Expected 415, got {resp.status_code}\n{resp.text}"
    body = resp.json()
    assert "detail" in body


@pytest.mark.integration
def test_upload_rejects_invalid_content_type(session: requests.Session) -> None:
    """POST /uploads/ with image/jpeg content-type should be rejected with 415."""
    files = {"file": ("photo.jpg", io.BytesIO(b"\xff\xd8\xff fake jpeg"), "image/jpeg")}

    resp = session.post(f"{BASE_URL}/uploads/", files=files, timeout=TIMEOUT)
    assert resp.status_code == 415, f"Expected 415, got {resp.status_code}\n{resp.text}"


# ── Experiment lifecycle ──────────────────────────────────────────────────────


@pytest.mark.integration
def test_create_experiment(session: requests.Session) -> None:
    """POST /experiments/ should create an experiment and return its ID."""
    payload = {
        "name": "integration-test-exp",
        "description": "Created by integration test suite",
        "blob_name": "uploads/integration_test.csv",
        "dataset_type": "csv",
    }

    resp = session.post(f"{BASE_URL}/experiments/", json=payload, timeout=TIMEOUT)
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}\n{resp.text}"

    body = resp.json()
    assert "id" in body
    assert body["name"] == "integration-test-exp"
    assert body["status"] == "created"

    # Stash the ID on the session for downstream tests (best-effort)
    session.__dict__["_last_exp_id"] = body["id"]


@pytest.mark.integration
def test_get_experiment(session: requests.Session) -> None:
    """GET /experiments/{id} should return the experiment created in the previous test."""
    exp_id = session.__dict__.get("_last_exp_id")
    if not exp_id:
        pytest.skip("No experiment ID available (run test_create_experiment first)")

    resp = session.get(f"{BASE_URL}/experiments/{exp_id}", timeout=TIMEOUT)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}\n{resp.text}"

    body = resp.json()
    assert body["id"] == exp_id
    assert body["name"] == "integration-test-exp"


@pytest.mark.integration
def test_get_experiment_not_found(session: requests.Session) -> None:
    """GET /experiments/{id} with a non-existent ID should return 404."""
    resp = session.get(f"{BASE_URL}/experiments/does-not-exist-at-all-xyz", timeout=TIMEOUT)
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}\n{resp.text}"


@pytest.mark.integration
def test_list_experiments(session: requests.Session) -> None:
    """GET /experiments/ should return a list (possibly empty)."""
    resp = session.get(f"{BASE_URL}/experiments/", timeout=TIMEOUT)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}\n{resp.text}"
    body = resp.json()
    assert isinstance(body, list), f"Expected a list, got {type(body)}"


# ── Results polling ───────────────────────────────────────────────────────────


@pytest.mark.integration
def test_poll_experiment_status(session: requests.Session) -> None:
    """Poll GET /experiments/{id} until status != 'created' or max attempts reached.

    This verifies that the polling contract works — the test does NOT assert that
    processing completes; it only confirms the endpoint stays reachable and returns
    a consistent schema while the job is in flight.
    """
    exp_id = session.__dict__.get("_last_exp_id")
    if not exp_id:
        pytest.skip("No experiment ID available (run test_create_experiment first)")

    terminal_statuses = {"completed", "failed"}
    max_polls = 6
    poll_interval = 10  # seconds

    for attempt in range(1, max_polls + 1):
        resp = session.get(f"{BASE_URL}/experiments/{exp_id}", timeout=TIMEOUT)
        assert resp.status_code == 200
        body = resp.json()
        status = body.get("status", "")

        assert status in {"created", "processing", "completed", "failed"}, f"Unexpected status: {status}"

        if status in terminal_statuses:
            break  # Job finished — no need to keep polling

        if attempt < max_polls:
            time.sleep(poll_interval)
    # If we exhaust all polls the test still passes — we just confirmed the API
    # stayed healthy throughout. Processing time varies by queue depth.
