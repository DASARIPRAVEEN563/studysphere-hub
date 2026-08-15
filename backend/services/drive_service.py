"""Google Drive storage using a service account.

Folder layout:
    STUDENTS KA NOTES SHARING HUB / <Department> / <Year> / <Semester> / file

If no service-account key is configured the same layout is mirrored on the
local ``uploads/`` folder so the app stays fully functional offline.
"""
import io
import os
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

SCOPES = ["https://www.googleapis.com/auth/drive"]
FOLDER_MIME = "application/vnd.google-apps.folder"

_service = None
_folder_cache: dict = {}


def _key_path():
    path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "service-account.json")
    if not os.path.isabs(path):
        path = os.path.join(BASE_DIR, path)
    return path if os.path.exists(path) else None


def drive_enabled() -> bool:
    return _key_path() is not None


def _client():
    global _service
    if _service is not None:
        return _service
    key = _key_path()
    if not key:
        return None
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds = service_account.Credentials.from_service_account_file(key, scopes=SCOPES)
    _service = build("drive", "v3", credentials=creds, cache_discovery=False)
    return _service


def _ensure_folder(service, name: str, parent: str | None) -> str:
    cache_key = f"{parent or 'root'}::{name}"
    if cache_key in _folder_cache:
        return _folder_cache[cache_key]
    safe = name.replace("'", "\\'")
    query = f"name = '{safe}' and mimeType = '{FOLDER_MIME}' and trashed = false"
    if parent:
        query += f" and '{parent}' in parents"
    found = service.files().list(q=query, fields="files(id)", pageSize=1).execute().get("files", [])
    if found:
        folder_id = found[0]["id"]
    else:
        body = {"name": name, "mimeType": FOLDER_MIME}
        if parent:
            body["parents"] = [parent]
        folder_id = service.files().create(body=body, fields="id").execute()["id"]
    _folder_cache[cache_key] = folder_id
    return folder_id


def _folder_chain(service, department: str, year: str, semester: str) -> str:
    root_name = os.environ.get("DRIVE_ROOT_FOLDER", "STUDENTS KA NOTES SHARING HUB")
    parent = os.environ.get("GOOGLE_DRIVE_PARENT_ID") or None
    folder = _ensure_folder(service, root_name, parent)
    for part in (department, year, semester):
        folder = _ensure_folder(service, part, folder)
    return folder


def _local_path(department: str, year: str, semester: str, file_name: str) -> str:
    safe = [p.replace("/", "-") for p in (department, year, semester)]
    folder = os.path.join(UPLOAD_DIR, *safe)
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, file_name)


def upload_file(payload: bytes, file_name: str, mime_type: str, department: str, year: str, semester: str) -> dict:
    """Store the file and return {'driveFileId', 'storagePath'}."""
    service = _client()
    if service:
        from googleapiclient.http import MediaIoBaseUpload

        folder_id = _folder_chain(service, department, year, semester)
        media = MediaIoBaseUpload(io.BytesIO(payload), mimetype=mime_type, resumable=False)
        created = (
            service.files()
            .create(body={"name": file_name, "parents": [folder_id]}, media_body=media, fields="id")
            .execute()
        )
        return {"driveFileId": created["id"], "storagePath": None}

    path = _local_path(department, year, semester, file_name)
    with open(path, "wb") as fh:
        fh.write(payload)
    return {"driveFileId": None, "storagePath": os.path.relpath(path, BASE_DIR)}


def download_file(note: dict) -> bytes:
    service = _client()
    if note.get("driveFileId") and service:
        from googleapiclient.http import MediaIoBaseDownload

        buf = io.BytesIO()
        request = service.files().get_media(fileId=note["driveFileId"])
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buf.getvalue()

    path = os.path.join(BASE_DIR, note.get("storagePath") or "")
    if not os.path.exists(path):
        raise FileNotFoundError("Stored file is missing")
    with open(path, "rb") as fh:
        return fh.read()


def move_file(note: dict, department: str, year: str, semester: str) -> dict:
    service = _client()
    if note.get("driveFileId") and service:
        target = _folder_chain(service, department, year, semester)
        meta = service.files().get(fileId=note["driveFileId"], fields="parents").execute()
        previous = ",".join(meta.get("parents", []))
        service.files().update(
            fileId=note["driveFileId"], addParents=target, removeParents=previous, fields="id"
        ).execute()
        return {"driveFileId": note["driveFileId"], "storagePath": None}

    old = os.path.join(BASE_DIR, note.get("storagePath") or "")
    new = _local_path(department, year, semester, note["fileName"])
    if os.path.exists(old) and os.path.abspath(old) != os.path.abspath(new):
        shutil.move(old, new)
    return {"driveFileId": None, "storagePath": os.path.relpath(new, BASE_DIR)}


def rename_file(note: dict, new_file_name: str) -> dict:
    service = _client()
    if note.get("driveFileId") and service:
        service.files().update(fileId=note["driveFileId"], body={"name": new_file_name}).execute()
        return {"driveFileId": note["driveFileId"], "storagePath": None}

    old = os.path.join(BASE_DIR, note.get("storagePath") or "")
    new = _local_path(note["department"], note["year"], note["semester"], new_file_name)
    if os.path.exists(old):
        shutil.move(old, new)
    return {"driveFileId": None, "storagePath": os.path.relpath(new, BASE_DIR)}


def delete_file(note: dict) -> None:
    service = _client()
    if note.get("driveFileId") and service:
        try:
            service.files().delete(fileId=note["driveFileId"]).execute()
        except Exception:  # already gone
            pass
        return
    path = os.path.join(BASE_DIR, note.get("storagePath") or "")
    if os.path.exists(path):
        os.remove(path)