"""Persistence through the Lovable Cloud bridge endpoint.

Lovable Cloud does not expose a Supabase service-role key, so Flask cannot talk
to the database directly. Instead it calls /api/public/state on the published
frontend, which performs the privileged read/write. Both sides share
BACKEND_BRIDGE_SECRET.
"""
import os
import threading
from datetime import datetime, timezone

import requests

_LOCK = threading.Lock()
_TIMEOUT = 20


def _base() -> str:
    return (os.environ.get("APP_BRIDGE_URL") or "").rstrip("/")


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {os.environ['BACKEND_BRIDGE_SECRET']}",
        "Content-Type": "application/json",
    }


def enabled() -> bool:
    return bool(_base() and os.environ.get("BACKEND_BRIDGE_SECRET"))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read(collection: str) -> list:
    res = requests.get(
        f"{_base()}/api/public/state",
        params={"shard": collection},
        headers=_headers(),
        timeout=_TIMEOUT,
    )
    res.raise_for_status()
    data = res.json().get("data")
    return data if isinstance(data, list) else []


def write(collection: str, rows: list) -> None:
    with _LOCK:
        res = requests.post(
            f"{_base()}/api/public/state",
            json={"shard": collection, "data": rows},
            headers=_headers(),
            timeout=_TIMEOUT,
        )
        res.raise_for_status()


def find(collection: str, **filters):
    for row in read(collection):
        if all(row.get(k) == v for k, v in filters.items()):
            return row
    return None


def insert(collection: str, row: dict) -> dict:
    rows = read(collection)
    rows.append(row)
    write(collection, rows)
    return row


def update(collection: str, row_id: str, patch: dict):
    rows = read(collection)
    updated = None
    for row in rows:
        if row.get("id") == row_id:
            row.update(patch)
            updated = row
    if updated:
        write(collection, rows)
    return updated


def delete(collection: str, row_id: str) -> bool:
    rows = read(collection)
    remaining = [r for r in rows if r.get("id") != row_id]
    if len(remaining) == len(rows):
        return False
    write(collection, remaining)
    return True
