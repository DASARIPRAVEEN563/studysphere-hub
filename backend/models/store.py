"""Data store with automatic Supabase persistence on Railway.

Locally (or whenever SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are missing) it
falls back to JSON files in backend/data/. On Railway it uses the same
public.app_state shards that the frontend cloud functions use.
"""
import json
import os
import threading
import uuid
from datetime import datetime, timezone

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(DATA_DIR, exist_ok=True)

_LOCK = threading.Lock()

FILES = {
    "users": os.path.join(DATA_DIR, "users.json"),
    "notes": os.path.join(DATA_DIR, "notes.json"),
    "content": os.path.join(DATA_DIR, "content.json"),
    "feedback": os.path.join(DATA_DIR, "feedback.json"),
    "chats": os.path.join(DATA_DIR, "chats.json"),
    "notifications": os.path.join(DATA_DIR, "notifications.json"),
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


def _supabase_enabled() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


def _json_read(collection: str) -> list:
    path = FILES[collection]
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as fh:
        try:
            return json.load(fh)
        except json.JSONDecodeError:
            return []


def _json_write(collection: str, rows: list) -> None:
    with _LOCK:
        with open(FILES[collection], "w", encoding="utf-8") as fh:
            json.dump(rows, fh, indent=2, ensure_ascii=False)


def read(collection: str) -> list:
    if _supabase_enabled():
        from . import supabase_store

        return supabase_store.read(collection)
    return _json_read(collection)


def write(collection: str, rows: list) -> None:
    if _supabase_enabled():
        from . import supabase_store

        return supabase_store.write(collection, rows)
    _json_write(collection, rows)


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
