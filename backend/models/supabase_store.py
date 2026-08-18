"""Supabase-backed data store for Railway deployment.

Mirrors the interface of models/store.py so the rest of the Flask app does not
need to change. Falls back to the JSON store if Supabase is not configured.

Uses the same public.app_state shards that the frontend cloud functions use,
so data stays in sync whether the browser talks to Flask or directly to
Lovable Cloud.
"""
import json
import os
import threading
from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

# Reuse the same shard names the frontend cloud-state uses.
SHARDS = ["users", "notes", "content", "feedback", "chats", "notifications", "likes"]
_ARRAY_SHARDS = set(SHARDS)  # all of them are arrays in this app

_LOCK = threading.Lock()


def _env(key: str) -> str | None:
    return os.environ.get(key)


def _supabase() -> Client | None:
    url = _env("SUPABASE_URL")
    key = _env("SUPABASE_SERVICE_ROLE_KEY") or _env("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def _enabled() -> bool:
    return _supabase() is not None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    import uuid

    return uuid.uuid4().hex


def _empty_shard(shard: str) -> Any:
    return [] if shard in _ARRAY_SHARDS else {}


def _read_all() -> dict:
    db = _supabase()
    if db is None:
        return {}
    rows = db.from_("app_state").select("id, data").execute().data or []
    doc = {s: _empty_shard(s) for s in SHARDS}
    for row in rows:
        if row["id"] in SHARDS:
            doc[row["id"]] = row.get("data") or _empty_shard(row["id"])
    return doc


def _write_shard(doc: dict, shard: str):
    db = _supabase()
    if db is None:
        return
    now = datetime.now(timezone.utc).isoformat()
    db.from_("app_state").upsert(
        {"id": shard, "data": doc.get(shard, _empty_shard(shard)), "updated_at": now}
    ).execute()


def _read_collection(collection: str) -> list:
    return _read_all().get(collection, [])


def _write_collection(collection: str, rows: list):
    with _LOCK:
        doc = _read_all()
        doc[collection] = rows
        _write_shard(doc, collection)


def read(collection: str) -> list:
    if not _enabled():
        from . import store as json_store

        return json_store.read(collection)
    return _read_collection(collection)


def write(collection: str, rows: list) -> None:
    if not _enabled():
        from . import store as json_store

        return json_store.write(collection, rows)
    _write_collection(collection, rows)


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
