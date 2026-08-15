from flask import g, jsonify, request

from controllers.auth_controller import DEPARTMENTS, SEMESTERS, YEARS
from models import store
from models.user import public_user


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
    if "profilePicture" in data:
        picture = data["profilePicture"]
        if picture and not str(picture).startswith(("data:image/", "http://", "https://")):
            return jsonify({"error": "Invalid profile picture"}), 400
        patch["profilePicture"] = picture
    if not patch:
        return jsonify({"error": "Nothing to update"}), 400
    updated = store.update("users", g.user["id"], patch)
    return jsonify({"user": public_user(updated)})