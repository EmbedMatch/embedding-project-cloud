"""Dataset utilities — download blobs and parse CSV/JSON.

Shared module used by the backend API and the Function App.
All Azure credentials and configuration are passed as parameters
so this module has no dependency on any app-specific config.
"""

import csv
import io
import json
from typing import Any

from azure.storage.blob import BlobServiceClient


def download_blob(connection_string: str, container: str, blob_name: str) -> bytes:
    """Download a blob from Azure Storage and return its raw bytes.

    Args:
        connection_string: Azure Storage connection string.
        container: Name of the blob container.
        blob_name: Name of the blob inside the container
                   (e.g. "mydata.csv" or "uploads/mydata.csv").

    Returns:
        The file content as bytes.

    Raises:
        azure.core.exceptions.ResourceNotFoundError: If the blob does not exist.
    """
    blob_service = BlobServiceClient.from_connection_string(connection_string)
    blob_client = blob_service.get_blob_client(
        container=container,
        blob=blob_name,
    )
    return blob_client.download_blob().readall()


def parse_dataset(
    raw: bytes,
    dataset_type: str,
    *,
    data_key: str | None = None,
) -> list[dict[str, Any]]:
    """Parse raw file bytes into a list of dicts.

    Args:
        raw: The file content as bytes (from download_blob).
        dataset_type: Either "csv" or "json".
        data_key: (JSON only) If the JSON root is a dict, extract the list
                  stored under this key. When *None* and the dict contains
                  exactly one list-valued key, that key is used automatically.
                  If multiple list-valued keys exist and *data_key* is not
                  specified, a ``ValueError`` is raised listing the available
                  keys so the caller can choose explicitly.

    Returns:
        A list of dicts — one per row (CSV) or item (JSON).

    Raises:
        ValueError: If dataset_type is unsupported, the data_key is missing,
                    or ambiguous list keys cannot be resolved.
    """
    text = raw.decode("utf-8")

    if dataset_type == "csv":
        reader = csv.DictReader(io.StringIO(text))
        return [dict(row) for row in reader]

    if dataset_type == "json":
        parsed = json.loads(text)

        # Top-level list — return directly
        if isinstance(parsed, list):
            return parsed

        if isinstance(parsed, dict):
            # Explicit key requested by caller
            if data_key is not None:
                if data_key not in parsed:
                    raise ValueError(
                        f"data_key {data_key!r} not found in JSON object. "
                        f"Available keys: {sorted(parsed.keys())}"
                    )
                value = parsed[data_key]
                if not isinstance(value, list):
                    raise ValueError(
                        f"data_key {data_key!r} does not contain a list "
                        f"(got {type(value).__name__})"
                    )
                return value

            # Auto-detect: find all list-valued keys
            list_keys = [k for k, v in parsed.items() if isinstance(v, list)]

            if len(list_keys) == 1:
                # Exactly one list key — unambiguous, use it
                return parsed[list_keys[0]]

            if len(list_keys) > 1:
                # Ambiguous — the caller must specify data_key
                raise ValueError(
                    f"JSON object has multiple list-valued keys: {sorted(list_keys)}. "
                    f"Pass data_key=<key> to specify which one contains the dataset."
                )

            # No list-valued keys — wrap the single object in a list
            return [parsed]

    raise ValueError(f"Unsupported dataset_type: {dataset_type!r}. Must be 'csv' or 'json'.")


def load_dataset(
    connection_string: str,
    container: str,
    blob_name: str,
    dataset_type: str,
    *,
    data_key: str | None = None,
) -> list[dict[str, Any]]:
    """Convenience: download a blob and parse it in one call.

    Args:
        connection_string: Azure Storage connection string.
        container: Name of the blob container.
        blob_name: Blob path in Azure Storage.
        dataset_type: "csv" or "json".
        data_key: Optional key for JSON dict extraction (see parse_dataset).

    Returns:
        Parsed rows as a list of dicts.
    """
    raw = download_blob(connection_string, container, blob_name)
    return parse_dataset(raw, dataset_type, data_key=data_key)
