from flask import jsonify, request

from models import store
from models.user import public_user
from services.security_service import create_token, hash_value, verify_value

DEPARTMENTS = ["AMIL & CSM", "CSE", "ECE", "EEE", "MECH", "CIVIL"]
YEARS = ["1 Year", "2 Year", "3 Year", "4 Year"]
SEMESTERS = ["1 Sem", "2 Sem"]


def signup():
    data = request.get_json(silent=True) or {}
    required = ["fullName", "registrationId", "password", "securityQuestion", "securityAnswer"]
    missing = [f for f in required if not str(data.get(f, "")).strip()]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
    if len(data["password"]) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    registration_id = data["registrationId"].strip().upper()
    if store.find("users", registrationId=registration_id):
        return jsonify({"error": "This registration ID is already registered"}), 409

    department = data.get("department") if data.get("department") in DEPARTMENTS else DEPARTMENTS[0]
    year = data.get("year") if data.get("year") in YEARS else YEARS[0]
    semester = data.get("semester") if data.get("semester") in SEMESTERS else SEMESTERS[0]

    user = {
        "id": store.new_id(),
        "fullName": data["fullName"].strip(),
        "registrationId": registration_id,
        "email": (data.get("email") or "").strip() or None,
        "passwordHash": hash_value(data["password"]),
        "securityQuestion": data["securityQuestion"].strip(),
        "securityAnswerHash": hash_value(data["securityAnswer"].strip().lower()),
        "department": department,
        "year": year,
        "semester": semester,
        "role": "student",
        "profilePicture": None,
        "sharedCount": 0,
        "downloadedCount": 0,
        "createdAt": store.now_iso(),
    }
    store.insert("users", user)
    return jsonify({"token": create_token(user), "user": public_user(user)}), 201


def login():
    data = request.get_json(silent=True) or {}
    registration_id = str(data.get("registrationId", "")).strip().upper()
    password = data.get("password", "")
    user = store.find("users", registrationId=registration_id)
    if not user or not verify_value(password, user.get("passwordHash", "")):
        return jsonify({"error": "Invalid registration ID or password"}), 401
    return jsonify({"token": create_token(user), "user": public_user(user)})


def forgot_question():
    data = request.get_json(silent=True) or {}
    registration_id = str(data.get("registrationId", "")).strip().upper()
    user = store.find("users", registrationId=registration_id)
    if not user:
        return jsonify({"error": "No account found for this registration ID"}), 404
    return jsonify({"securityQuestion": user.get("securityQuestion")})


def forgot_reset():
    data = request.get_json(silent=True) or {}
    registration_id = str(data.get("registrationId", "")).strip().upper()
    answer = str(data.get("securityAnswer", "")).strip().lower()
    new_password = data.get("newPassword", "")
    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    user = store.find("users", registrationId=registration_id)
    if not user or not verify_value(answer, user.get("securityAnswerHash", "")):
        return jsonify({"error": "Security answer is incorrect"}), 401
    store.update("users", user["id"], {"passwordHash": hash_value(new_password)})
    return jsonify({"message": "Password updated successfully"})