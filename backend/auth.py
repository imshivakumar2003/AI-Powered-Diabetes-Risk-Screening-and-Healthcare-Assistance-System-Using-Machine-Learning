"""
auth.py
--------
Authentication utilities: password hashing, JWT issuing/verification, and
Flask route decorators for protecting endpoints by login state or role.

This module does not define any routes itself — see routes/auth_routes.py.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

from database import get_session
from models import User

JWT_SECRET = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = int(os.environ.get("JWT_EXPIRES_MINUTES", "60"))
RESET_TOKEN_EXPIRES_MINUTES = int(os.environ.get("RESET_TOKEN_EXPIRES_MINUTES", "30"))


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def hash_password(raw_password: str) -> str:
    return generate_password_hash(raw_password)


def verify_password(raw_password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, raw_password)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRES_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str):
    """Returns the decoded payload, or raises jwt exceptions on failure."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


# ---------------------------------------------------------------------------
# Decorators
# ---------------------------------------------------------------------------
def _extract_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip()


def login_required(fn):
    """Verifies a valid JWT is present, loads the user, and attaches it to
    flask.g.current_user for the duration of the request."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return fn(*args, **kwargs)

        token = _extract_token()
        if not token:
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        try:
            payload = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token."}), 401

        with get_session() as db:
            user = db.query(User).filter_by(id=int(payload["sub"])).first()
            if user is None:
                return jsonify({"error": "User no longer exists."}), 401
            if not user.is_active:
                return jsonify({"error": "This account has been deactivated."}), 403

            # Detach a plain snapshot so it's usable after the session closes.
            g.current_user = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
            }

        return fn(*args, **kwargs)
    return wrapper


def get_optional_user():
    """Returns a user dict if a valid token is present, otherwise None.
    Never raises — used by routes that must keep working for anonymous
    requests (e.g. the existing /api/predict) while still linking the
    prediction to a logged-in user when possible."""
    token = _extract_token()
    if not token:
        return None
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        return None

    with get_session() as db:
        user = db.query(User).filter_by(id=int(payload["sub"])).first()
        if user is None or not user.is_active:
            return None
        return {"id": user.id, "role": user.role}


def admin_required(fn):
    """Stacks on top of login_required — use as @admin_required directly,
    it implies login_required."""
    @wraps(fn)
    @login_required
    def wrapper(*args, **kwargs):
        if g.current_user["role"] != "admin":
            return jsonify({"error": "Admin access required."}), 403
        return fn(*args, **kwargs)
    return wrapper
