from flask import Blueprint, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from database import get_session
from models import Notification, Setting
from auth import get_optional_user

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@notifications_bp.route("", methods=["GET", "OPTIONS"])
def list_notifications():
    if request.method == "OPTIONS":
        return "", 200

    user = get_optional_user()
    if not user:
        return jsonify([])

    limit = request.args.get("limit", 50, type=int)

    try:
        with get_session() as db:
            rows = (
                db.query(Notification)
                .filter_by(user_id=user["id"])
                .order_by(Notification.created_at.desc())
                .limit(limit)
                .all()
            )
            return jsonify([r.to_dict() for r in rows])
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500


@notifications_bp.route("/unread-count", methods=["GET", "OPTIONS"])
def unread_count():
    if request.method == "OPTIONS":
        return "", 200

    user = get_optional_user()
    if not user:
        return jsonify({"unread_count": 0})

    try:
        with get_session() as db:
            count = (
                db.query(Notification)
                .filter_by(user_id=user["id"], is_read=False)
                .count()
            )
            return jsonify({"unread_count": count})
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500


@notifications_bp.route("/<int:notif_id>/read", methods=["PATCH", "POST", "OPTIONS"])
def mark_read(notif_id):
    if request.method == "OPTIONS":
        return "", 200

    user = get_optional_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    try:
        with get_session() as db:
            row = db.query(Notification).filter_by(id=notif_id, user_id=user["id"]).first()
            if not row:
                return jsonify({"error": "Notification not found"}), 44

            row.is_read = True
            db.flush()

            # Recalculate unread count
            unread = db.query(Notification).filter_by(user_id=user["id"], is_read=False).count()
            return jsonify({"success": True, "notification": row.to_dict(), "unread_count": unread})
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500


@notifications_bp.route("/read-all", methods=["PATCH", "POST", "OPTIONS"])
def mark_all_read():
    if request.method == "OPTIONS":
        return "", 200

    user = get_optional_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    try:
        with get_session() as db:
            db.query(Notification).filter_by(user_id=user["id"], is_read=False).update({"is_read": True})
            db.flush()
            return jsonify({"success": True, "unread_count": 0})
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500


@notifications_bp.route("/<int:notif_id>", methods=["DELETE", "OPTIONS"])
def delete_notification(notif_id):
    if request.method == "OPTIONS":
        return "", 200

    user = get_optional_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    try:
        with get_session() as db:
            row = db.query(Notification).filter_by(id=notif_id, user_id=user["id"]).first()
            if row:
                db.delete(row)
                db.flush()
            unread = db.query(Notification).filter_by(user_id=user["id"], is_read=False).count()
            return jsonify({"success": True, "unread_count": unread})
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500


@notifications_bp.route("/preferences", methods=["GET", "PUT", "PATCH", "OPTIONS"])
def preferences():
    if request.method == "OPTIONS":
        return "", 200

    user = get_optional_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    keys = [
        "prediction_notifications",
        "report_notifications",
        "ai_health_tips",
        "system_notifications",
    ]

    try:
        with get_session() as db:
            if request.method in ("PUT", "PATCH"):
                payload = request.get_json(silent=True) or {}
                for k in keys:
                    if k in payload:
                        val_str = "true" if str(payload[k]).lower() in ("true", "1", "yes") else "false"
                        s = db.query(Setting).filter_by(user_id=user["id"], key=k).first()
                        if not s:
                            s = Setting(user_id=user["id"], key=k, value=val_str)
                            db.add(s)
                        else:
                            s.value = val_str
                db.flush()

            # Retrieve current preferences
            rows = db.query(Setting).filter_by(user_id=user["id"]).filter(Setting.key.in_(keys)).all()
            row_map = {r.key: r.value for r in rows}

            return jsonify({
                "prediction_notifications": row_map.get("prediction_notifications", "true") == "true",
                "report_notifications": row_map.get("report_notifications", "true") == "true",
                "ai_health_tips": row_map.get("ai_health_tips", "true") == "true",
                "system_notifications": row_map.get("system_notifications", "true") == "true",
            })
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500
