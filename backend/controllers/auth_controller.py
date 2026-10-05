import hmac
import os
import secrets
import time

from flask import jsonify, request

from models import store
from models.user import public_user
from services.security_service import create_token, hash_value, verify_value

DEPARTMENTS = ["AIML & CSM", "CSE", "ECE", "EEE", "MECH", "CIVIL"]
YEARS = ["1 Year", "2 Year", "3 Year", "4 Year"]
SEMESTERS = ["1 Sem", "2 Sem"]

# Permanent master admin credentials come from the environment (.env) so no
# password is ever committed to the repository.
SUPER_ADMIN_ID = os.environ.get("MASTER_ADMIN_ID", "MASTERADMIN").upper()
SUPER_ADMIN_PASSWORD = os.environ.get("MASTER_ADMIN_PASSWORD", "")


def ensure_super_admin() -> dict:
    user = store.find("users", registrationId=SUPER_ADMIN_ID)
    if user:
        store.update("users", user["id"], {"passwordHash": hash_value(SUPER_ADMIN_PASSWORD), "role": "admin"})
        return store.find("users", registrationId=SUPER_ADMIN_ID)
    user = {
        "id": store.new_id(),
        "fullName": "Praveen (Master Admin)",
        "registrationId": SUPER_ADMIN_ID,
        "email": None,
        "passwordHash": hash_value(SUPER_ADMIN_PASSWORD),
        "securityQuestion": "Master admin",
        "securityAnswerHash": hash_value("praveen"),
        "department": "CSE",
        "year": "4 Year",
        "semester": "2 Sem",
        "role": "admin",
        "profilePicture": None,
        "sharedCount": 0,
        "downloadedCount": 0,
        "faceVerified": True,
        "createdAt": store.now_iso(),
    }
    store.insert("users", user)
    return user


def signup():
    data = request.get_json(silent=True) or {}
    required = ["fullName", "registrationId", "password"]
    missing = [f for f in required if not str(data.get(f, "")).strip()]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
    if len(data["password"]) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    registration_id = data["registrationId"].strip().upper()
    if store.find("users", registrationId=registration_id):
        return jsonify({"error": "This registration ID is already registered"}), 409

    email = (data.get("email") or "").strip() or None
    if email and any(
        str(u.get("email") or "").strip().lower() == email.lower() for u in store.read("users")
    ):
        return jsonify({"error": "This email ID is already used by another account"}), 409

    department = data.get("department") if data.get("department") in DEPARTMENTS else DEPARTMENTS[0]
    year = data.get("year") if data.get("year") in YEARS else YEARS[0]
    semester = data.get("semester") if data.get("semester") in SEMESTERS else SEMESTERS[0]

    user = {
        "id": store.new_id(),
        "fullName": data["fullName"].strip(),
        "registrationId": registration_id,
        "email": email,
        "passwordHash": hash_value(data["password"]),
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
    if SUPER_ADMIN_PASSWORD and registration_id == SUPER_ADMIN_ID and password == SUPER_ADMIN_PASSWORD:
        user = ensure_super_admin()
        return jsonify({"token": create_token(user), "user": public_user(user)})
    user = store.find("users", registrationId=registration_id)
    if not user or not password:
        return jsonify({"error": "Invalid registration ID or password"}), 401
    if user.get("passwordHash"):
        ok = verify_value(password, user["passwordHash"])
    else:
        legacy = user.get("password")
        ok = bool(legacy) and hmac.compare_digest(str(legacy), str(password))
        if ok:
            # Upgrade the legacy plain password to a bcrypt hash.
            store.update("users", user["id"], {"passwordHash": hash_value(password), "password": None})
            user = store.find("users", registrationId=registration_id) or user
    if not ok:
        return jsonify({"error": "Invalid registration ID or password"}), 401
    return jsonify({"token": create_token(user), "user": public_user(user)})


def forgot_question():
    data = request.get_json(silent=True) or {}
    registration_id = str(data.get("registrationId", "")).strip().upper()
    user = store.find("users", registrationId=registration_id)
    if not user:
        return jsonify({"error": "No account found for this registration ID"}), 404
    return jsonify({"securityQuestion": user.get("securityQuestion")})


def forgot_code():
    data = request.get_json(silent=True) or {}
    registration_id = str(data.get("registrationId", "")).strip().upper()
    user = store.find("users", registrationId=registration_id)
    if not user:
        return jsonify({"error": "No account found for this registration ID"}), 404
    email = (user.get("email") or "").strip()
    if not email:
        return jsonify({"error": "No email is linked to this account. Please contact the admin."}), 400
    code = f"{secrets.randbelow(1000000):06d}"
    store.update(
        "users",
        user["id"],
        {"resetCodeHash": hash_value(code), "resetCodeExpires": int(time.time()) + 15 * 60},
    )
    return jsonify(
        {
            "email": email,
            "fullName": user.get("fullName"),
            "code": code,
            "registrationId": user.get("registrationId"),
            "department": user.get("department"),
            "year": user.get("year"),
            "semester": user.get("semester"),
        }
    )


def forgot_reset():
    data = request.get_json(silent=True) or {}
    registration_id = str(data.get("registrationId", "")).strip().upper()
    code = str(data.get("code", "")).strip()
    answer = str(data.get("securityAnswer", "")).strip().lower()
    new_password = data.get("newPassword", "")
    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    user = store.find("users", registrationId=registration_id)
    if not user:
        return jsonify({"error": "No account found for this registration ID"}), 404
    if code:
        if int(user.get("resetCodeExpires") or 0) < int(time.time()):
            return jsonify({"error": "Verification code expired. Please request a new one."}), 401
        if not verify_value(code, user.get("resetCodeHash", "")):
            return jsonify({"error": "Verification code is incorrect"}), 401
    elif not verify_value(answer, user.get("securityAnswerHash", "")):
        return jsonify({"error": "Verification code is required"}), 401
    store.update(
        "users",
        user["id"],
        {
            "passwordHash": hash_value(new_password),
            "password": None,
            "resetCodeHash": None,
            "resetCodeExpires": None,
        },
    )
    return jsonify(
        {
            "message": "Password updated successfully",
            "email": user.get("email"),
            "fullName": user.get("fullName"),
            "registrationId": user.get("registrationId"),
            "department": user.get("department"),
            "year": user.get("year"),
            "semester": user.get("semester"),
        }
    )