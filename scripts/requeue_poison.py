"""Inspect the benchmark-jobs-poison queue and optionally re-enqueue messages.

Poison messages land here when the Azure Function fails to process a message
5 times in a row (MaxDequeueCount). Use this script to diagnose stuck experiments
and push them back to the live queue for another attempt.

Usage:
    # List poison messages (read-only)
    python scripts/requeue_poison.py

    # Move all poison messages back to the live queue
    python scripts/requeue_poison.py --requeue

Requires:
    AZURE_STORAGE_CONNECTION_STRING env var (or a .env file at the project root)
"""

import argparse
import os
import sys

from azure.storage.queue import QueueClient, QueueServiceClient, TextBase64EncodePolicy

LIVE_QUEUE = "benchmark-jobs"
POISON_QUEUE = "benchmark-jobs-poison"


def get_conn_str() -> str:
    conn = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
    if conn:
        return conn
    # Try loading from project root .env
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("AZURE_STORAGE_CONNECTION_STRING="):
                    return line.split("=", 1)[1]
    print("Error: AZURE_STORAGE_CONNECTION_STRING not set.", file=sys.stderr)
    sys.exit(1)


def make_live_client(conn: str) -> QueueClient:
    """Return a QueueClient for the live queue with base64 encoding (required by Azure Functions)."""
    client = QueueServiceClient.from_connection_string(conn).get_queue_client(LIVE_QUEUE)
    client._message_encode_policy = TextBase64EncodePolicy()
    return client


def main(requeue: bool) -> None:
    conn = get_conn_str()
    poison_q = QueueServiceClient.from_connection_string(conn).get_queue_client(POISON_QUEUE)

    messages = list(poison_q.receive_messages(messages_per_page=32))
    if not messages:
        print("Poison queue is empty.")
        return

    print(f"Found {len(messages)} poison message(s):\n")
    for msg in messages:
        print(f"  id            : {msg.id}")
        print(f"  experiment_id : {msg.content!r}")
        print(f"  dequeue_count : {msg.dequeue_count}")
        print()

    if not requeue:
        print("Run with --requeue to move these back to the live queue.")
        return

    live_q = make_live_client(conn)
    for msg in messages:
        live_q.send_message(msg.content)
        poison_q.delete_message(msg)
        print(f"Re-enqueued: {msg.content!r}")
    print(f"\nDone — {len(messages)} message(s) moved to '{LIVE_QUEUE}'.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--requeue", action="store_true", help="Move messages back to the live queue")
    args = parser.parse_args()
    main(args.requeue)
