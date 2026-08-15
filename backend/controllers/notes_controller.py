import os

from flask import Response, g, jsonify, request

from controllers.auth_controller import DEPARTMENTS, SEMESTERS, YEARS
from models import store
from services import drive_service
from services.file_validation import validate


def public_note(note: dict) -> dict:
    return {
        "id": note["id"],
        "subject": note["subject"],
        "fileName": note["fileName"],
        "department": note["department"],
        "year": note["year"],
        "semester": note["semester"],
        "mimeType": note["mimeType"],
        "size": note["size"],
        "uploadedBy": note["uploadedByName"],
        "uploadedAt": note["uploadedAt"],
        "driveFileId": note.get("driveFileId"),
    }


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
        "mimeType": upload.mimetype,
        "size": len(payload),
        "uploadedById": g.user["id"],
        "uploadedByName": g.user["fullName"],
        "uploadedAt": store.now_iso(),
        "driveFileId": stored["driveFileId"],
        "storagePath": stored["storagePath"],
    }
    store.insert("notes", note)
    store.update("users", g.user["id"], {"sharedCount": int(g.user.get("sharedCount", 0)) + 1})
    return jsonify({"note": public_note(note)}), 201


def download_note(note_id: str):
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
    return Response(
        payload,
        mimetype=note["mimeType"],
        headers={
            "Content-Disposition": f'attachment; filename="{note["fileName"]}"',
            "Content-Length": str(len(payload)),
        },
    )