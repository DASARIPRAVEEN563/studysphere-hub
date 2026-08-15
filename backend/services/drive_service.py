"""Google Drive storage via the Lovable connector gateway.

Folder layout:
    STUDENTS KA NOTES SHARING HUB / <Department> / <Year> / <Semester> / file

If the Lovable connector is not configured, the same layout is mirrored on the
local ``uploads/`` folder so the app stays fully functional offline.
"""
import io
import json
import os
import shutil

import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_drive"
FOLDER_MIME = "application/vnd.google-apps.folder"

_folder_cache: dict = {}


def _api_key_headers():
    lov_key = os.environ.get("LOVABLE_API_KEY")
    conn_key = os.environ.get("GOOGLE_DRIVE_API_KEY")
    if not lov_key or not conn_key:
        return None
    return {
        "Authorization": f"Bearer {lov_key}",
        "X-Connection-Api-Key": conn_key,
    }


def drive_enabled() -> bool:
    return _api_key_headers() is not None


def _request(method: str, path: str, **kwargs):
    headers = _api_key_headers()
    if not headers:
        raise RuntimeError("Lovable Google Drive connector is not configured")
    kwargs.setdefault("headers", {})
    kwargs["headers"].update(headers)
    url = f"{GATEWAY_BASE}{path}"
    response = requests.request(method, url, timeout=60, **kwargs)
    if not response.ok:
        raise RuntimeError(f"Drive gateway error {response.status_code}: {response.text}")
    return response


def _ensure_folder(name: str, parent: str | None) -> str:
    cache_key = f"{parent or 'root'}::{name}"
    if cache_key in _folder_cache:
        return _folder_cache[cache_key]
    safe = name.replace("'", "\\'")
    q = f"name = '{safe}' and mimeType = '{FOLDER_MIME}' and trashed = false"
    if parent:
        q += f" and '{parent}' in parents"
    resp = _request(
        "GET",
        "/drive/v3/files",
        params={"q": q, "fields": "files(id)", "pageSize": "1"},
    )
    files = resp.json().get("files", [])
    if files:
        folder_id = files[0]["id"]
    else:
        body = {"name": name, "mimeType": FOLDER_MIME}
        if parent:
            body["parents"] = [parent]
        resp = _request(
            "POST",
            "/drive/v3/files",
            params={"fields": "id"},
            json=body,
        )
        folder_id = resp.json()["id"]
    _folder_cache[cache_key] = folder_id
    return folder_id


def _folder_chain(department: str, year: str, semester: str) -> str:
    root_name = os.environ.get("DRIVE_ROOT_FOLDER", "STUDENTS KA NOTES SHARING HUB")
    folder = _ensure_folder(root_name, None)
    for part in (department, year, semester):
        folder = _ensure_folder(part, folder)
    return folder


def _local_path(department: str, year: str, semester: str, file_name: str) -> str:
    safe = [p.replace("/", "-") for p in (department, year, semester)]
    folder = os.path.join(UPLOAD_DIR, *safe)
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, file_name)


def upload_file(payload: bytes, file_name: str, mime_type: str, department: str, year: str, semester: str) -> dict:
    """Store the file and return {'driveFileId', 'storagePath'}."""
    if drive_enabled():
        folder_id = _folder_chain(department, year, semester)
        metadata = {"name": file_name, "parents": [folder_id]}
        files = {
            "metadata": (None, json.dumps(metadata), "application/json; charset=UTF-8"),
            "file": (file_name, io.BytesIO(payload), mime_type),
        }
        resp = _request(
            "POST",
            "/upload/drive/v3/files",
            params={"uploadType": "multipart", "fields": "id"},
            files=files,
        )
        return {"driveFileId": resp.json()["id"], "storagePath": None}

    path = _local_path(department, year, semester, file_name)
    with open(path, "wb") as fh:
        fh.write(payload)
    return {"driveFileId": None, "storagePath": os.path.relpath(path, BASE_DIR)}


def download_file(note: dict) -> bytes:
    if note.get("driveFileId") and drive_enabled():
        resp = _request(
            "GET",
            f"/drive/v3/files/{note['driveFileId']}",
            params={"alt": "media"},
        )
        return resp.content

    path = os.path.join(BASE_DIR, note.get("storagePath") or "")
    if not os.path.exists(path):
        raise FileNotFoundError("Stored file is missing")
    with open(path, "rb") as fh:
        return fh.read()


def move_file(note: dict, department: str, year: str, semester: str) -> dict:
    if note.get("driveFileId") and drive_enabled():
        target = _folder_chain(department, year, semester)
        resp = _request(
            "GET",
            f"/drive/v3/files/{note['driveFileId']}",
            params={"fields": "parents"},
        )
        previous = ",".join(resp.json().get("parents", []))
        _request(
            "PATCH",
            f"/drive/v3/files/{note['driveFileId']}",
            params={"addParents": target, "removeParents": previous, "fields": "id"},
        )
        return {"driveFileId": note["driveFileId"], "storagePath": None}

    old = os.path.join(BASE_DIR, note.get("storagePath") or "")
    new = _local_path(department, year, semester, note["fileName"])
    if os.path.exists(old) and os.path.abspath(old) != os.path.abspath(new):
        shutil.move(old, new)
    return {"driveFileId": None, "storagePath": os.path.relpath(new, BASE_DIR)}


def rename_file(note: dict, new_file_name: str) -> dict:
    if note.get("driveFileId") and drive_enabled():
        _request(
            "PATCH",
            f"/drive/v3/files/{note['driveFileId']}",
            params={"fields": "id"},
            json={"name": new_file_name},
        )
        return {"driveFileId": note["driveFileId"], "storagePath": None}

    old = os.path.join(BASE_DIR, note.get("storagePath") or "")
    new = _local_path(note["department"], note["year"], note["semester"], new_file_name)
    if os.path.exists(old):
        shutil.move(old, new)
    return {"driveFileId": None, "storagePath": os.path.relpath(new, BASE_DIR)}


def delete_file(note: dict) -> None:
    if note.get("driveFileId") and drive_enabled():
        try:
            _request("DELETE", f"/drive/v3/files/{note['driveFileId']}")
        except Exception:  # already gone
            pass
        return
    path = os.path.join(BASE_DIR, note.get("storagePath") or "")
    if os.path.exists(path):
        os.remove(path)
