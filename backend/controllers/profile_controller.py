import re

from flask import g, jsonify, request

from controllers.auth_controller import DEPARTMENTS, SEMESTERS, YEARS
from models import store
from models.user import public_user
from services.email_service import send_face_verified_email

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get_profile():
    user = store.find("users", id=g.user["id"])
    return jsonify({"user": public_user(user)})


def update_profile():
    data = request.get_json(silent=True) or {}
    patch = {}
    if data.get("department") in DEPARTMENTS:
        patch["department"] = data["department"]
    if data.get("year") in YEARS:
        patch["year"] = data["year"]
    if data.get("semester") in SEMESTERS:
        patch["semester"] = data["semester"]
    if "email" in data:
        email = str(data.get("email") or "").strip()
        if email and not EMAIL_RE.match(email):
            return jsonify({"error": "Incorrect email ID"}), 400
        patch["email"] = email or None
    if "profilePicture" in data:
        picture = data["profilePicture"]
        if picture and not str(picture).startswith(("data:image/", "http://", "https://")):
            return jsonify({"error": "Invalid profile picture"}), 400
        patch["profilePicture"] = picture
    if not patch:
        return jsonify({"error": "Nothing to update"}), 400
    updated = store.update("users", g.user["id"], patch)
    return jsonify({"user": public_user(updated)})


def verify_face():
    data = request.get_json(silent=True) or {}
    image = data.get("image")
    user = store.find("users", id=g.user["id"]) or g.user
    email = user.get("email")
    if not email:
        return jsonify({"error": "Add and save your email ID before face verification"}), 400
    if not EMAIL_RE.match(str(email)):
        return jsonify({"error": "Incorrect email ID"}), 400
    faces = data.get("faces")
    if faces is not None and int(faces) != 1:
        return jsonify({"error": "Exactly one person must be in front of the camera"}), 400
    if not image or not str(image).startswith("data:image/"):
        return jsonify({"error": "A live camera capture is required"}), 400
    updated = store.update(
        "users",
        g.user["id"],
        {"faceImage": image, "faceVerified": True, "faceVerifiedAt": store.now_iso()},
    )
    sent = send_face_verified_email(email, updated.get("fullName", ""))
    return jsonify(
        {
            "user": public_user(updated),
            "emailedTo": email,
            "emailSent": sent,
            "message": "Face verified is successfully completed",
        }
    )


def confirm_identity():
    """In-app fallback for students whose mail provider blocks the "It's me" link."""
    user = store.find("users", id=g.user["id"]) or g.user
    if not user.get("faceVerified"):
        return jsonify({"error": "Complete live face verification first"}), 400
    updated = store.update("users", g.user["id"], {"identityConfirmed": True})
    return jsonify({"user": public_user(updated)})
