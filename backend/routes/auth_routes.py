"""
routes/auth_routes.py
-----------------------
Authentication & profile endpoints, mounted at /api/auth/*.

    POST   /api/auth/register          create a new patient account
    POST   /api/auth/login             log in, returns a JWT
    POST   /api/auth/forgot-password   request a password reset token
    POST   /api/auth/reset-password    reset password using a valid token
    POST   /api/auth/logout            client-side logout (see note below)
    GET    /api/auth/me                current user's profile (requires auth)
    PUT    /api/auth/profile           update full_name / email (requires auth)
    PUT    /api/auth/change-password   change password while logged in (requires auth)

Note on logout: JWTs are stateless, so "logout" is enforced by the frontend
discarding its stored token. This endpoint exists for a consistent API and
as a hook point if you later add a server-side token blocklist.
"""

import logging
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, g
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

logger = logging.getLogger(__name__)

from database import get_session
from models import User, Setting, Feedback, PredictionHistory, ChatSession, ChatHistory
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    generate_reset_token,
    RESET_TOKEN_EXPIRES_MINUTES,
    login_required,
)
from audit import log_action

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _user_public_dict(user: User, db=None):
    profile_photo = None
    if db:
        photo_row = db.query(Setting).filter_by(user_id=user.id, key="profile_photo").first()
        if photo_row and photo_row.value:
            profile_photo = photo_row.value
    else:
        try:
            with get_session() as s:
                photo_row = s.query(Setting).filter_by(user_id=user.id, key="profile_photo").first()
                if photo_row and photo_row.value:
                    profile_photo = photo_row.value
        except Exception:
            pass

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "profile_photo": profile_photo,
        "created_at": user.created_at.isoformat(),
    }


@auth_bp.route("/register", methods=["POST"])
def register():
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    full_name = (payload.get("full_name") or "").strip() or None

    if not username or not email or not password:
        return jsonify({"error": "username, email, and password are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    try:
        with get_session() as db:
            existing = db.query(User).filter(
                (User.username == username) | (User.email == email)
            ).first()
            if existing:
                if existing.email == email:
                    return jsonify({"error": "An account with this email already exists."}), 409
                return jsonify({"error": "That username is already registered."}), 409

            user = User(
                username=username,
                email=email,
                password_hash=hash_password(password),
                full_name=full_name,
                role="user",
                is_active=True,
            )
            db.add(user)
            db.flush()

            token = create_access_token(user.id, user.role)
            response = {"token": token, "user": _user_public_dict(user)}
            new_user_id = user.id

    except IntegrityError:
        return jsonify({"error": "That username or email is already registered."}), 409
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error during registration: {exc}"}), 500

    log_action(new_user_id, "user_register", f"New account: {username}")
    return jsonify(response), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required."}), 400

    try:
        with get_session() as db:
            user = db.query(User).filter_by(email=email).first()
            if user is None or not verify_password(password, user.password_hash):
                log_action(user.id if user else None, "login_failed", f"Failed login for {email}", status="failure")
                return jsonify({"error": "Invalid email or password."}), 401
            if not user.is_active:
                return jsonify({"error": "This account has been deactivated."}), 403

            token = create_access_token(user.id, user.role)
            response = {"token": token, "user": _user_public_dict(user)}
            log_action(
                user.id,
                "admin_login" if user.role == "admin" else "user_login",
                f"Login: {user.username}",
            )

    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error during login: {exc}"}), 500

    return jsonify(response)


@auth_bp.route("/admin-login", methods=["POST"])
def admin_login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required."}), 400

    try:
        with get_session() as db:
            user = db.query(User).filter_by(email=email).first()
            if user is None or not verify_password(password, user.password_hash):
                log_action(user.id if user else None, "login_failed", f"Failed admin login for {email}", status="failure")
                return jsonify({"error": "Invalid admin email or password."}), 401
            if not user.is_active:
                return jsonify({"error": "This admin account has been deactivated."}), 403
            if user.role != "admin":
                log_action(user.id, "login_failed", f"Non-admin access attempt by {email}", status="failure")
                return jsonify({"error": "Access denied. Admin credentials required."}), 403

            token = create_access_token(user.id, user.role)
            response = {"token": token, "user": _user_public_dict(user)}
            log_action(user.id, "admin_login", f"Admin Login: {user.username}")

    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error during admin login: {exc}"}), 500

    return jsonify(response)


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "email is required."}), 400

    # Always return the same generic message, whether or not the email
    # exists — this avoids leaking which emails are registered.
    generic_response = {
        "message": "If an account with that email exists, a reset link has been sent."
    }

    try:
        with get_session() as db:
            user = db.query(User).filter_by(email=email).first()
            if user is None:
                return jsonify(generic_response)

            token = generate_reset_token()
            user.reset_token = token
            user.reset_token_expires = datetime.utcnow() + timedelta(
                minutes=RESET_TOKEN_EXPIRES_MINUTES
            )

            # --- Email sending ---
            # No SMTP provider is configured yet. In development we log the
            # reset link instead of emailing it. Wire up a real provider
            # (SendGrid, SES, SMTP, etc.) in services/email_service.py and
            # call it here before shipping to production.
            reset_link = f"/reset-password?token={token}"
            print(f"[DEV ONLY] Password reset link for {email}: {reset_link}")

            # Included here ONLY because no email service is wired up yet —
            # remove `reset_token_dev_only` once real email sending exists.
            generic_response["reset_token_dev_only"] = token

    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify(generic_response)


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    payload = request.get_json(silent=True) or {}
    token = payload.get("token") or ""
    new_password = payload.get("new_password") or ""

    if not token or not new_password:
        return jsonify({"error": "token and new_password are required."}), 400
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    try:
        with get_session() as db:
            user = db.query(User).filter_by(reset_token=token).first()
            if user is None or user.reset_token_expires is None:
                return jsonify({"error": "Invalid or expired reset token."}), 400
            if user.reset_token_expires < datetime.utcnow():
                return jsonify({"error": "This reset token has expired."}), 400

            user.password_hash = hash_password(new_password)
            user.reset_token = None
            user.reset_token_expires = None

    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({"message": "Password has been reset. You can now log in."})


@auth_bp.route("/logout", methods=["POST"])
def logout():
    # Stateless JWT — the frontend discards the token. See module docstring.
    return jsonify({"message": "Logged out."})


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    try:
        with get_session() as db:
            user = db.query(User).filter_by(id=g.current_user["id"]).first()
            if user is None:
                return jsonify({"error": "User not found."}), 404
            return jsonify(_user_public_dict(user))
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500


@auth_bp.route("/profile", methods=["PUT"])
@login_required
def update_profile():
    payload = request.get_json(silent=True) or {}
    full_name = payload.get("full_name")
    email = payload.get("email")

    try:
        with get_session() as db:
            user = db.query(User).filter_by(id=g.current_user["id"]).first()
            if user is None:
                return jsonify({"error": "User not found."}), 404

            if email and email.strip().lower() != user.email:
                new_email = email.strip().lower()
                clash = db.query(User).filter(User.email == new_email, User.id != user.id).first()
                if clash:
                    return jsonify({"error": "That email is already in use."}), 409
                user.email = new_email

            if full_name is not None:
                user.full_name = full_name.strip() or None

            db.flush()
            response = _user_public_dict(user)

    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "user_updated", "Profile updated")
    try:
        from notification_service import create_user_notification
        create_user_notification(g.current_user["id"], "profile_updated")
    except Exception:
        pass
    return jsonify(response)


@auth_bp.route("/change-password", methods=["PUT"])
@login_required
def change_password():
    payload = request.get_json(silent=True) or {}
    old_password = payload.get("old_password") or ""
    new_password = payload.get("new_password") or ""

    if not old_password or not new_password:
        return jsonify({"error": "old_password and new_password are required."}), 400
    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters."}), 400

    try:
        with get_session() as db:
            user = db.query(User).filter_by(id=g.current_user["id"]).first()
            if user is None:
                return jsonify({"error": "User not found."}), 404
            if not verify_password(old_password, user.password_hash):
                return jsonify({"error": "Current password is incorrect."}), 401

            user.password_hash = hash_password(new_password)

    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "password_changed", "Password changed via profile")
    return jsonify({"message": "Password updated successfully."})


@auth_bp.route("/user-settings", methods=["GET"])
@login_required
def get_user_settings():
    defaults = {
        "preferred_language": "en",
        "theme": "light",
        "email_notifications": "true",
        "ai_health_tips": "true",
        "report_notifications": "true",
    }
    stored = {}
    try:
        with get_session() as db:
            rows = db.query(Setting).filter_by(user_id=g.current_user["id"]).all()
            stored = {r.key: r.value for r in rows}
    except Exception as exc:
        logger.error(f"Error loading user settings: {exc}")

    for k, v in defaults.items():
        if k not in stored:
            stored[k] = v

    return jsonify(stored)


@auth_bp.route("/user-settings", methods=["PUT"])
@login_required
def update_user_settings():
    payload = request.get_json(silent=True) or {}
    updated_keys = []

    try:
        with get_session() as db:
            for k, v in payload.items():
                row = db.query(Setting).filter_by(user_id=g.current_user["id"], key=k).first()
                if row:
                    row.value = str(v)
                else:
                    db.add(Setting(user_id=g.current_user["id"], key=k, value=str(v)))
                updated_keys.append(k)

            db.flush()
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "settings_updated", f"User updated settings: {', '.join(updated_keys)}")
    return jsonify({"updated": updated_keys})


@auth_bp.route("/account", methods=["DELETE"])
@login_required
def delete_account():
    payload = request.get_json(silent=True) or {}
    password = payload.get("password") or ""

    try:
        with get_session() as db:
            user = db.query(User).filter_by(id=g.current_user["id"]).first()
            if not user:
                return jsonify({"error": "User not found."}), 404
            if not verify_password(password, user.password_hash):
                return jsonify({"error": "Incorrect password. Cannot delete account."}), 401

            db.delete(user)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({"message": "Account deleted successfully."})


@auth_bp.route("/feedback", methods=["POST"])
@login_required
def submit_feedback():
    payload = request.get_json(silent=True) or {}
    category = payload.get("category") or "feedback"
    subject = (payload.get("subject") or "").strip()
    message = (payload.get("message") or "").strip()

    if not message:
        return jsonify({"error": "message is required."}), 400

    try:
        with get_session() as db:
            fb = Feedback(
                user_id=g.current_user["id"],
                category=category,
                subject=subject,
                message=message,
                status="open",
            )
            db.add(fb)
            db.flush()
            out = fb.to_dict()
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "chat_activity", f"Feedback submitted: {category}")
    return jsonify(out), 201


@auth_bp.route("/download-data", methods=["GET"])
@login_required
def download_user_data():
    try:
        with get_session() as db:
            user = db.query(User).filter_by(id=g.current_user["id"]).first()
            if not user:
                return jsonify({"error": "User not found."}), 404

            user_info = _user_public_dict(user)

            # Predictions
            preds = db.query(PredictionHistory).filter_by(user_id=user.id).order_by(PredictionHistory.created_at.desc()).all()
            prediction_items = [p.to_api_dict() for p in preds]

            # Chat history
            sessions = db.query(ChatSession).filter_by(user_id=user.id).all()
            chat_items = []
            for s in sessions:
                msgs = db.query(ChatHistory).filter_by(session_id=s.id).order_by(ChatHistory.created_at.asc()).all()
                chat_items.append({
                    "session_id": s.id,
                    "title": s.title,
                    "messages": [{"role": m.role, "message": m.message, "created_at": m.created_at.isoformat()} for m in msgs]
                })

            # Settings
            settings_rows = db.query(Setting).filter_by(user_id=user.id).all()
            settings_dict = {r.key: r.value for r in settings_rows}

    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    full_package = {
        "export_date": datetime.utcnow().isoformat(),
        "user_profile": user_info,
        "user_settings": settings_dict,
        "prediction_history": prediction_items,
        "chat_sessions": chat_items,
    }

    return jsonify(full_package)


