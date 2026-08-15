"""Extension / MIME / size validation for uploaded notes."""
import os

ALLOWED = {
    ".pdf": {"application/pdf"},
    ".jpg": {"image/jpeg", "image/jpg"},
    ".jpeg": {"image/jpeg", "image/jpg"},
    ".png": {"image/png"},
    ".webp": {"image/webp"},
}

MAGIC = {
    b"%PDF": "application/pdf",
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"RIFF": "image/webp",
}


def max_bytes() -> int:
    return int(os.environ.get("MAX_UPLOAD_MB", "25")) * 1024 * 1024


def sniff(head: bytes):
    for magic, mime in MAGIC.items():
        if head.startswith(magic):
            return mime
    return None


def validate(filename: str, mimetype: str, payload: bytes):
    """Return (ok, error_message)."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED:
        return False, "Only PDF, JPG, JPEG, PNG and WEBP files are allowed"
    if (mimetype or "").lower() not in ALLOWED[ext]:
        return False, "File MIME type does not match its extension"
    size = len(payload)
    if size == 0:
        return False, "File is empty"
    if size > max_bytes():
        return False, f"File exceeds the {max_bytes() // (1024 * 1024)} MB limit"
    detected = sniff(payload[:8])
    if detected is None:
        return False, "Unsafe or unrecognised file content"
    if detected == "application/pdf" and ext != ".pdf":
        return False, "File content does not match the extension"
    if detected != "application/pdf" and ext == ".pdf":
        return False, "File content does not match the extension"
    return True, None