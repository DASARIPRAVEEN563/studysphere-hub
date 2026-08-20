import os

from flask import Response, g, jsonify, request

from controllers.auth_controller import DEPARTMENTS, SEMESTERS, YEARS
from models import store
from services import drive_service
from services.file_validation import validate


def public_note(note: dict) -> dict:
    liked_by = note.get("likedBy") or []
    me = getattr(g, "user", None) or {}
    return {
        "id": note["id"],
        "subject": note["subject"],
        "fileName": note["fileName"],
        "department": note["department"],
        "year": note["year"],
        "semester": note["semester"],
        "note": note.get("note"),
        "mimeType": note["mimeType"],
        "size": note["size"],
        "uploadedBy": note["uploadedByName"],
        "uploadedAt": note["uploadedAt"],
        "driveFileId": note.get("driveFileId"),
        "likes": len(liked_by),
        "likedByMe": me.get("id") in liked_by,
        "views": int(note.get("views", 0)),
        "downloads": int(note.get("downloads", 0)),
    }


def unique_subject(subject: str, department: str, year: str, semester: str) -> str:
    """ds -> ds01 -> ds02 when the subject folder already exists in the same scope."""
    taken = {
        n["subject"].lower()
        for n in store.read("notes")
        if n["department"] == department and n["year"] == year and n["semester"] == semester
    }
    if subject.lower() not in taken:
        return subject
    index = 1
    while f"{subject}{index:02d}".lower() in taken:
        index += 1
    return f"{subject}{index:02d}"


def list_notes():
    rows = store.read("notes")
    for key in ("department", "year", "semester", "subject"):
        value = request.args.get(key)
        if value:
            rows = [r for r in rows if r.get(key) == value]
    rows.sort(key=lambda r: r.get("uploadedAt", ""), reverse=True)
    return jsonify({"notes": [public_note(r) for r in rows]})


def upload_note():
    subject = (request.form.get("subject") or "").strip()
    department = request.form.get("department")
    year = request.form.get("year")
    semester = request.form.get("semester")
    extra_note = (request.form.get("note") or "").strip()[:200] or None
    upload = request.files.get("file")

    if not subject:
        return jsonify({"error": "Subject is required"}), 400
    if department not in DEPARTMENTS or year not in YEARS or semester not in SEMESTERS:
        return jsonify({"error": "Invalid department, year or semester"}), 400
    if upload is None:
        return jsonify({"error": "No file uploaded"}), 400

    payload = upload.read()
    ok, error = validate(upload.filename, upload.mimetype, payload)
    if not ok:
        return jsonify({"error": error}), 400

    subject = unique_subject(subject, department, year, semester)
    ext = os.path.splitext(upload.filename)[1].lower()
    stored_name = f"{subject}{ext}"
    existing = [
        n
        for n in store.read("notes")
        if n["department"] == department
        and n["year"] == year
        and n["semester"] == semester
        and n["fileName"] == stored_name
    ]
    if existing:
        stored_name = f"{subject} ({len(existing) + 1}){ext}"

    stored = drive_service.upload_file(
        payload, stored_name, upload.mimetype, department, year, semester
    )

    note = {
        "id": store.new_id(),
        "subject": subject,
        "fileName": stored_name,
        "department": department,
        "year": year,
        "semester": semester,
        "note": extra_note,
        "mimeType": upload.mimetype,
        "size": len(payload),
        "uploadedById": g.user["id"],
        "uploadedByName": g.user["fullName"],
        "uploadedAt": store.now_iso(),
        "driveFileId": stored["driveFileId"],
        "storagePath": stored["storagePath"],
        "likedBy": [],
        "views": 0,
        "downloads": 0,
    }
    store.insert("notes", note)
    stars = int(g.user.get("stars", 0)) + 1
    store.update(
        "users",
        g.user["id"],
        {"sharedCount": int(g.user.get("sharedCount", 0)) + 1, "stars": stars},
    )
    return jsonify({"note": public_note(note), "stars": stars}), 201


def download_note(note_id: str):
    if not g.user.get("faceVerified"):
        return jsonify({"error": "You are not face verified"}), 403
    note = store.find("notes", id=note_id)
    if not note:
        return jsonify({"error": "Note not found"}), 404
    try:
        payload = drive_service.download_file(note)
    except FileNotFoundError:
        return jsonify({"error": "Stored file is missing"}), 410

    store.update(
        "users", g.user["id"], {"downloadedCount": int(g.user.get("downloadedCount", 0)) + 1}
    )
    store.update("notes", note["id"], {"downloads": int(note.get("downloads", 0)) + 1})
    return Response(
        payload,
        mimetype=note["mimeType"],
        headers={
            "Content-Disposition": f'attachment; filename="{note["fileName"]}"',
            "Content-Length": str(len(payload)),
        },
    )


def view_note(note_id: str):
    note = store.find("notes", id=note_id)
    if not note:
        return jsonify({"error": "Note not found"}), 404
    try:
        payload = drive_service.download_file(note)
    except FileNotFoundError:
        return jsonify({"error": "Stored file is missing"}), 410
    store.update("notes", note["id"], {"views": int(note.get("views", 0)) + 1})
    return Response(
        payload,
        mimetype=note["mimeType"],
        headers={
            "Content-Disposition": f'inline; filename="{note["fileName"]}"',
            "Content-Length": str(len(payload)),
        },
    )


def like_note(note_id: str):
    note = store.find("notes", id=note_id)
    if not note:
        return jsonify({"error": "Note not found"}), 404
    liked_by = list(note.get("likedBy") or [])
    if g.user["id"] in liked_by:
        liked_by.remove(g.user["id"])
    else:
        liked_by.append(g.user["id"])
        owner = note.get("uploadedById")
        if owner and owner != g.user["id"]:
            # Anonymous like alert for the student who shared the file.
            store.insert(
                "notifications",
                {
                    "id": store.new_id(),
                    "userId": owner,
                    "text": f'Someone liked your note "{note["subject"]}" ({note["fileName"]})',
                    "createdAt": store.now_iso(),
                    "read": False,
                },
            )
    updated = store.update("notes", note_id, {"likedBy": liked_by})
    return jsonify({"note": public_note(updated)})