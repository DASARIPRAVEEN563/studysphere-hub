"""Password hashing (bcrypt via passlib) and JWT issuing/verification."""
import os
from datetime import datetime, timedelta, timezone

import jwt
from passlib.hash import bcrypt


def _secret() -> str:
    return os.environ.get("JWT_SECRET", "dev-insecure-secret-change-me")


def hash_value(raw: str) -> str:
    return bcrypt.using(rounds=12).hash(raw)


def verify_value(raw: str, hashed: str) -> bool:
    if not raw or not hashed:
        return False
    try:
        return bcrypt.verify(raw, hashed)
    except ValueError:
        return False


def create_token(user: dict) -> str:
    hours = int(os.environ.get("JWT_EXPIRES_HOURS", "24"))
    payload = {
        "sub": user["id"],
        "registrationId": user["registrationId"],
        "role": user.get("role", "student"),
        "exp": datetime.now(timezone.utc) + timedelta(hours=hours),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=["HS256"])