"""Azure Functions app scaffold for benchmark queue processing."""

import json
import logging
from datetime import datetime
from typing import Any

import azure.functions as func

app = func.FunctionApp()


@app.function_name(name="benchmark_job_listener")
@app.queue_trigger(
    arg_name="msg",
    queue_name="benchmark-jobs",
    connection="AZURE_STORAGE_CONNECTION_STRING",
)
def benchmark_job_listener(msg: func.QueueMessage) -> None:
    """Read queue messages from benchmark-jobs and log payload details.

    
    """
    raw_body = msg.get_body().decode("utf-8", errors="replace")
    parsed_body: Any = raw_body

    try:
        parsed_body = json.loads(raw_body)
    except json.JSONDecodeError:
        logging.info("Queue message is not valid JSON. Logging raw payload.")

    metadata = {
        "id": msg.id,
        "dequeue_count": msg.dequeue_count,
        "insertion_time": _format_datetime(msg.insertion_time),
        "expiration_time": _format_datetime(msg.expiration_time),
    }

    logging.info("Received benchmark queue message metadata: %s", metadata)
    logging.info("Received benchmark queue message payload: %s", parsed_body)


def _format_datetime(value: datetime | None) -> str | None:
    """Format datetime safely for structured log output."""
    if value is None:
        return None
    return value.isoformat()
