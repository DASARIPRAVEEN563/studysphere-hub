"""JWT authentication and role-based authorization decorators."""
from functools import wraps

from flask import g, jsonify, request

from models import store
from services.security_service import decode_token


def _current_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None, "Missing bearer token"
    try:
        payload = decode_token(header.split(" ", 1)[1].strip())
    except Exception:
        return None, "Invalid or expired token"
    user = store.find("users", id=payload.get("sub"))
    if not user:
        return None, "Account no longer exists"
    return user, None


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user, error = _current_user()
        if error:
            return jsonify({"error": error}), 401
        g.user = user
        return fn(*args, **kwargs)

    return wrapper


def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user, error = _current_user()
        if error:
            return jsonify({"error": error}), 401
        if user.get("role") != "admin":
            return jsonify({"error": "Administrator access required"}), 403
        g.user = user
        return fn(*args, **kwargs)

    return wrapper