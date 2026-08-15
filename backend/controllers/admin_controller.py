import os

from flask import Response, jsonify, request

from controllers.auth_controller import DEPARTMENTS, SEMESTERS, YEARS
from controllers.notes_controller import public_note
from models import store
from services import drive_service
from services.excel_service import build_students_workbook

CONTENT_TYPES = ["gallery", "timetable", "promotion", "video", "notice"]


def admin_list_notes():
    rows = sorted(store.read("notes"), key=lambda r: r.get("uploadedAt", ""), reverse=True)
    return jsonify({"notes": [public_note(r) for r in rows]})


def admin_update_note(note_id: str):
    note = store.find("notes", id=note_id)
    if not note:
        return jsonify({"error": "Note not found"}), 404
    data = request.get_json(silent=True) or {}
    patch = {}

    # Rename changes the SUBJECT (and keeps the stored file name in sync).
    new_subject = (data.get("subject") or "").strip()
    if new_subject and new_subject != note["subject"]:
        ext = os.path.splitext(note["fileName"])[1].lower()
        new_file_name = f"{new_subject}{ext}"
        stored = drive_service.rename_file(note, new_file_name)
        patch.update({"subject": new_subject, "fileName": new_file_name, **stored})
        note = {**note, **patch}

    department = data.get("department", note["department"])
    year = data.get("year", note["year"])
    semester = data.get("semester", note["semester"])
    if (department, year, semester) != (note["department"], note["year"], note["semester"]):
        if department not in DEPARTMENTS or year not in YEARS or semester not in SEMESTERS:
            return jsonify({"error": "Invalid destination folder"}), 400
        stored = drive_service.move_file(note, department, year, semester)
        patch.update(
            {"department": department, "year": year, "semester": semester, **stored}
        )

    if not patch:
        return jsonify({"error": "Nothing to update"}), 400
    updated = store.update("notes", note_id, patch)
    return jsonify({"note": public_note(updated)})


def admin_delete_note(note_id: str):
    note = store.find("notes", id=note_id)
    if not note:
        return jsonify({"error": "Note not found"}), 404
    drive_service.delete_file(note)
    store.delete("notes", note_id)
    return jsonify({"message": "Note deleted"})


def list_content():
    rows = sorted(store.read("content"), key=lambda r: r.get("createdAt", ""), reverse=True)
    kind = request.args.get("type")
    if kind:
        rows = [r for r in rows if r.get("type") == kind]
    return jsonify({"content": rows})


def create_content():
    data = request.get_json(silent=True) or {}
    if data.get("type") not in CONTENT_TYPES:
        return jsonify({"error": f"type must be one of {', '.join(CONTENT_TYPES)}"}), 400
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    url = (data.get("url") or "").strip()
    if url and not url.startswith(("http://", "https://", "data:image/")):
        return jsonify({"error": "URL must be http(s) or a data image"}), 400
    item = {
        "id": store.new_id(),
        "type": data["type"],
        "title": title,
        "description": (data.get("description") or "").strip(),
        "url": url,
        "createdAt": store.now_iso(),
    }
    store.insert("content", item)
    return jsonify({"item": item}), 201


def update_content(content_id: str):
    item = store.find("content", id=content_id)
    if not item:
        return jsonify({"error": "Content not found"}), 404
    data = request.get_json(silent=True) or {}
    patch = {}
    for key in ("title", "description", "url"):
        if key in data:
            patch[key] = str(data[key]).strip()
    if data.get("type") in CONTENT_TYPES:
        patch["type"] = data["type"]
    if not patch:
        return jsonify({"error": "Nothing to update"}), 400
    return jsonify({"item": store.update("content", content_id, patch)})


def delete_content(content_id: str):
    if not store.delete("content", content_id):
        return jsonify({"error": "Content not found"}), 404
    return jsonify({"message": "Content deleted"})


def export_students_xlsx():
    users = [u for u in store.read("users") if u.get("role") == "student"]
    users.sort(key=lambda u: u.get("fullName", "").lower())
    payload = build_students_workbook(users)
    return Response(
        payload,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="students.xlsx"'},
    )