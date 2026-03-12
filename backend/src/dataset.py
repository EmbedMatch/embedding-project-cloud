"""Dataset utilities — download blobs and parse CSV/JSON.

Shared module used by the backend API and the Function App.
"""

import csv
import io
import json
from typing import Any

from azure.storage.blob import BlobServiceClient

from src.config import settings


def download_blob(blob_name: str) -> bytes:
    """Download a blob from Azure Storage and return its raw bytes.

    Args:
        blob_name: Name of the blob inside the configured container
                   (e.g. "mydata.csv" or "uploads/mydata.csv").

    Returns:
        The file content as bytes.

    Raises:
        azure.core.exceptions.ResourceNotFoundError: If the blob does not exist.
    """
    blob_service = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
    blob_client = blob_service.get_blob_client(
        container=settings.azure_storage_container,
        blob=blob_name,
    )
    return blob_client.download_blob().readall()


def parse_dataset(raw: bytes, dataset_type: str) -> list[dict[str, Any]]:
    """Parse raw file bytes into a list of dicts.

    Args:
        raw: The file content as bytes (from download_blob).
        dataset_type: Either "csv" or "json".

    Returns:
        A list of dicts — one per row (CSV) or item (JSON).

    Raises:
        ValueError: If dataset_type is not "csv" or "json".
    """
    text = raw.decode("utf-8")

    if dataset_type == "csv":
        reader = csv.DictReader(io.StringIO(text))
        return [dict(row) for row in reader]

    if dataset_type == "json":
        parsed = json.loads(text)
        # Accept both a top-level list and a top-level object with a list key
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            # If the JSON object has a single list-valued key, use that
            list_values = [v for v in parsed.values() if isinstance(v, list)]
            if list_values:
                return list_values[0]
            # Otherwise wrap the object in a list
            return [parsed]

    raise ValueError(f"Unsupported dataset_type: {dataset_type!r}. Must be 'csv' or 'json'.")


def load_dataset(blob_name: str, dataset_type: str) -> list[dict[str, Any]]:
    """Convenience: download a blob and parse it in one call.

    Args:
        blob_name: Blob path in Azure Storage.
        dataset_type: "csv" or "json".

    Returns:
        Parsed rows as a list of dicts.
    """
    raw = download_blob(blob_name)
    return parse_dataset(raw, dataset_type)
