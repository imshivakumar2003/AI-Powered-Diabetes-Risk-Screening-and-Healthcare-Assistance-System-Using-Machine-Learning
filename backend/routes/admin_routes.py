"""
routes/admin_routes.py
------------------------
Admin-only endpoints, mounted at /api/admin/*. Every route here requires
a valid JWT belonging to a user with role='admin' (see @admin_required).

    Settings
        GET  /api/admin/settings
        PUT  /api/admin/settings

    Audit Logs
        GET  /api/admin/audit-logs

    Backup & Restore
        GET  /api/admin/backup/export-sql     download a portable .sql dump
        POST /api/admin/backup/import-sql     restore from an uploaded .sql dump
        POST /api/admin/backup/create         snapshot the current DB file
        GET  /api/admin/backup/list           list stored snapshots
        POST /api/admin/backup/restore/<name> restore a stored snapshot
        GET  /api/admin/backup/download/<name> download a stored snapshot
"""

import os
import shutil
import sqlite3
from datetime import datetime, timedelta
from sqlalchemy import func
from flask import Blueprint, request, jsonify, g, send_file
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.utils import secure_filename

from database import get_session, DATABASE_URL, DEFAULT_SQLITE_PATH
from models import Setting, AuditLog, User, PredictionHistory, ChatSession, ChatHistory, Report, Suggestion, Feedback
from auth import admin_required
from audit import log_action

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(os.path.dirname(BASE_DIR), "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

IS_SQLITE = DATABASE_URL.startswith("sqlite")


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
# Every manageable setting, grouped by category, with a flag for whether it
# holds a secret (secrets are masked on GET and only ever accepted on PUT).
SETTINGS_SCHEMA = {
    "ai": {
        "api_key": {"label": "AI API Key", "secret": True, "default": ""},
        "model_provider": {"label": "Model Provider", "secret": False, "default": "anthropic"},
    },
    "email": {
        "smtp_host": {"label": "SMTP Host", "secret": False, "default": ""},
        "smtp_port": {"label": "SMTP Port", "secret": False, "default": "587"},
        "smtp_username": {"label": "SMTP Username", "secret": False, "default": ""},
        "smtp_password": {"label": "SMTP Password", "secret": True, "default": ""},
        "from_address": {"label": "From Address", "secret": False, "default": "no-reply@glucosecheck.app"},
    },
    "database": {
        "url_display": {"label": "Database URL (read-only)", "secret": True, "default": DATABASE_URL},
        "auto_vacuum": {"label": "Auto Vacuum Enabled", "secret": False, "default": "false"},
    },
    "application": {
        "app_name": {"label": "Application Name", "secret": False, "default": "GlucoseCheck"},
        "support_email": {"label": "Support Email", "secret": False, "default": ""},
        "maintenance_mode": {"label": "Maintenance Mode", "secret": False, "default": "false"},
    },
    "theme": {
        "default_mode": {"label": "Default Theme", "secret": False, "default": "light"},
        "accent_color": {"label": "Accent Color", "secret": False, "default": "#0e7c86"},
    },
    "backup": {
        "auto_backup_enabled": {"label": "Automatic Backups", "secret": False, "default": "false"},
        "retention_days": {"label": "Retention (days)", "secret": False, "default": "30"},
    },
}


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "••••"
    return "•" * (len(value) - 4) + value[-4:]


@admin_bp.route("/settings", methods=["GET"])
@admin_required
def get_settings():
    try:
        with get_session() as db:
            rows = db.query(Setting).filter(Setting.user_id.is_(None)).all()
            stored = {r.key: r.value for r in rows}
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    result = {}
    for category, keys in SETTINGS_SCHEMA.items():
        result[category] = {}
        for key, meta in keys.items():
            full_key = f"{category}.{key}"
            raw_value = stored.get(full_key, meta["default"])
            result[category][key] = {
                "label": meta["label"],
                "secret": meta["secret"],
                "value": _mask(raw_value) if meta["secret"] else raw_value,
                "configured": bool(stored.get(full_key)),
            }

    return jsonify(result)


@admin_bp.route("/settings", methods=["PUT"])
@admin_required
def update_settings():
    payload = request.get_json(silent=True) or {}
    # Expected shape: { "ai": { "api_key": "..." }, "email": { "smtp_host": "..." }, ... }

    updated_keys = []
    errors = []

    try:
        with get_session() as db:
            for category, keys in payload.items():
                if category not in SETTINGS_SCHEMA:
                    errors.append(f"Unknown category: {category}")
                    continue
                if not isinstance(keys, dict):
                    continue
                for key, value in keys.items():
                    if key not in SETTINGS_SCHEMA[category]:
                        errors.append(f"Unknown setting: {category}.{key}")
                        continue
                    if key == "url_display":
                        errors.append("database.url_display is read-only — change DATABASE_URL in .env instead.")
                        continue

                    full_key = f"{category}.{key}"
                    row = db.query(Setting).filter_by(user_id=None, key=full_key).first()
                    if row:
                        row.value = str(value)
                    else:
                        db.add(Setting(user_id=None, key=full_key, value=str(value)))
                    updated_keys.append(full_key)

    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "settings_updated", f"Updated: {', '.join(updated_keys)}")

    response = {"updated": updated_keys}
    if errors:
        response["warnings"] = errors
    return jsonify(response)


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------
@admin_bp.route("/audit-logs", methods=["GET"])
@admin_required
def list_audit_logs():
    page = request.args.get("page", default=1, type=int)
    page_size = min(request.args.get("page_size", default=20, type=int), 100)
    q = request.args.get("q") or request.args.get("search")
    action = request.args.get("action")
    user_id = request.args.get("user_id", type=int) or request.args.get("admin_id", type=int)
    status = request.args.get("status")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")

    try:
        with get_session() as db:
            query = db.query(AuditLog)

            if q:
                search_term = f"%{q.strip()}%"
                query = query.filter(
                    (AuditLog.description.ilike(search_term)) |
                    (AuditLog.action.ilike(search_term))
                )
            if action and action != "all":
                query = query.filter(AuditLog.action == action)
            if user_id:
                query = query.filter(AuditLog.user_id == user_id)
            if status and status != "all":
                query = query.filter(AuditLog.status == status)
            if date_from:
                try:
                    df = datetime.fromisoformat(date_from)
                    query = query.filter(AuditLog.created_at >= df)
                except ValueError:
                    pass
            if date_to:
                try:
                    dt = datetime.fromisoformat(date_to)
                    query = query.filter(AuditLog.created_at <= dt)
                except ValueError:
                    pass

            total = query.count()
            rows = (
                query.order_by(AuditLog.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
                .all()
            )

            # Fetch distinct admins and actions for frontend filters
            admins = db.query(User).filter(User.role == "admin").all()
            admin_list = [{"id": a.id, "name": a.full_name or a.username} for a in admins]

            items = [r.to_dict() for r in rows]
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size else 0,
        "admins": admin_list,
    })


# ---------------------------------------------------------------------------
# Backup & Restore
# ---------------------------------------------------------------------------
def _require_sqlite():
    if not IS_SQLITE:
        return jsonify({
            "error": (
                "Built-in backup/restore only supports SQLite. For MySQL/PostgreSQL, "
                "use `mysqldump`/`pg_dump` and `mysql`/`psql restore` instead."
            )
        }), 400
    return None


@admin_bp.route("/backup/export-sql", methods=["GET"])
@admin_required
def export_sql():
    guard = _require_sqlite()
    if guard:
        return guard

    try:
        conn = sqlite3.connect(DEFAULT_SQLITE_PATH)
        dump_lines = list(conn.iterdump())
        conn.close()
    except sqlite3.Error as exc:
        return jsonify({"error": f"Could not export database: {exc}"}), 500

    filename = f"export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.sql"
    filepath = os.path.join(BACKUP_DIR, filename)
    with open(filepath, "w") as f:
        f.write("\n".join(dump_lines))

    log_action(g.current_user["id"], "database_backup", f"SQL export: {filename}")
    return send_file(filepath, as_attachment=True, download_name=filename)


@admin_bp.route("/backup/import-sql", methods=["POST"])
@admin_required
def import_sql():
    guard = _require_sqlite()
    if guard:
        return guard

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Send it as multipart/form-data field 'file'."}), 400

    file = request.files["file"]
    if not file.filename.endswith(".sql"):
        return jsonify({"error": "Only .sql files are accepted."}), 400

    sql_content = file.read().decode("utf-8", errors="replace")

    # Safety net: automatically snapshot the current database before
    # overwriting it, so a bad restore can always be undone.
    safety_backup = f"pre_restore_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.db"
    try:
        shutil.copy(DEFAULT_SQLITE_PATH, os.path.join(BACKUP_DIR, safety_backup))
    except OSError as exc:
        return jsonify({"error": f"Could not create safety backup before restore: {exc}"}), 500

    try:
        # Restore into a fresh file, then atomically swap it in — safer than
        # executing DROP/CREATE statements against the live, open database.
        tmp_path = DEFAULT_SQLITE_PATH + ".restoring"
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        conn = sqlite3.connect(tmp_path)
        conn.executescript(sql_content)
        conn.commit()
        conn.close()

        os.replace(tmp_path, DEFAULT_SQLITE_PATH)
    except sqlite3.Error as exc:
        return jsonify({
            "error": f"Restore failed, original database was not modified: {exc}",
            "safety_backup": safety_backup,
        }), 400

    log_action(g.current_user["id"], "database_restore", f"Restored from uploaded file: {file.filename}")
    return jsonify({
        "message": "Database restored successfully.",
        "safety_backup_created": safety_backup,
    })


@admin_bp.route("/backup/create", methods=["POST"])
@admin_required
def create_backup():
    guard = _require_sqlite()
    if guard:
        return guard

    filename = f"backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.db"
    filepath = os.path.join(BACKUP_DIR, filename)
    try:
        shutil.copy(DEFAULT_SQLITE_PATH, filepath)
    except OSError as exc:
        return jsonify({"error": f"Backup failed: {exc}"}), 500

    log_action(g.current_user["id"], "database_backup", f"Snapshot created: {filename}")
    return jsonify({"filename": filename, "created_at": datetime.utcnow().isoformat()})


@admin_bp.route("/backup/list", methods=["GET"])
@admin_required
def list_backups():
    items = []
    for fname in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if fname == ".gitkeep":
            continue
        fpath = os.path.join(BACKUP_DIR, fname)
        stat = os.stat(fpath)
        items.append({
            "filename": fname,
            "size_bytes": stat.st_size,
            "created_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
            "type": "sql" if fname.endswith(".sql") else "db",
        })
    return jsonify({"items": items})


@admin_bp.route("/backup/restore/<path:filename>", methods=["POST"])
@admin_required
def restore_backup(filename):
    guard = _require_sqlite()
    if guard:
        return guard

    safe_name = secure_filename(filename)
    fpath = os.path.join(BACKUP_DIR, safe_name)
    if not os.path.isfile(fpath):
        return jsonify({"error": "Backup file not found."}), 404
    if not safe_name.endswith(".db"):
        return jsonify({"error": "Only .db snapshot files can be restored via this endpoint. Use import-sql for .sql dumps."}), 400

    safety_backup = f"pre_restore_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.db"
    try:
        shutil.copy(DEFAULT_SQLITE_PATH, os.path.join(BACKUP_DIR, safety_backup))
        shutil.copy(fpath, DEFAULT_SQLITE_PATH)
    except OSError as exc:
        return jsonify({"error": f"Restore failed: {exc}"}), 500

    log_action(g.current_user["id"], "database_restore", f"Restored snapshot: {safe_name}")
    return jsonify({"message": f"Restored from {safe_name}.", "safety_backup_created": safety_backup})


@admin_bp.route("/backup/download/<path:filename>", methods=["GET"])
@admin_required
def download_backup(filename):
    safe_name = secure_filename(filename)
    fpath = os.path.join(BACKUP_DIR, safe_name)
    if not os.path.isfile(fpath):
        return jsonify({"error": "Backup file not found."}), 404
    return send_file(fpath, as_attachment=True, download_name=safe_name)


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Dashboard Overview & Analytics
# ---------------------------------------------------------------------------
@admin_bp.route("/dashboard", methods=["GET"])
@admin_bp.route("/dashboard/stats", methods=["GET"])
@admin_required
def get_dashboard_overview():
    try:
        with get_session() as db:
            total_users = db.query(User).count()
            total_predictions = db.query(PredictionHistory).count()
            positive_cases = db.query(PredictionHistory).filter_by(result="Positive").count()
            negative_cases = db.query(PredictionHistory).filter_by(result="Negative").count()
            
            # Count actual AI chat messages (or sessions if no messages yet)
            chat_msg_count = db.query(ChatHistory).count()
            chat_session_count = db.query(ChatSession).count()
            total_chats = max(chat_msg_count, chat_session_count)
            
            reports_generated = db.query(Report).count()

            # Average Risk Score calculation
            preds = db.query(PredictionHistory).all()
            total_prob = sum((r.probability or 0.0) for r in preds)
            avg_risk_score = round(total_prob / len(preds), 1) if preds else 0.0

            now = datetime.utcnow()
            today_start = datetime(now.year, now.month, now.day)
            week_start = now - timedelta(days=7)
            month_start = now - timedelta(days=30)

            # Real active users today from AuditLog & registration timestamps
            active_logs = db.query(AuditLog.user_id).filter(
                AuditLog.created_at >= today_start,
                AuditLog.user_id.isnot(None)
            ).distinct().all()
            active_set = {r[0] for r in active_logs}
            created_today = db.query(User.id).filter(User.created_at >= today_start).all()
            for u in created_today:
                active_set.add(u[0])

            active_users_today = len(active_set) if total_users > 0 else 0

            daily_predictions = db.query(PredictionHistory).filter(PredictionHistory.created_at >= today_start).count()
            weekly_predictions = db.query(PredictionHistory).filter(PredictionHistory.created_at >= week_start).count()
            monthly_predictions = db.query(PredictionHistory).filter(PredictionHistory.created_at >= month_start).count()

            # Distributions for Dashboard Charts
            age_dist = {"Under 30": 0, "30-45": 0, "46-60": 0, "Above 60": 0}
            gender_dist = {"Male": 0, "Female": 0}
            hba1c_dist = {"Normal (<5.7)": 0, "Prediabetes (5.7-6.4)": 0, "Diabetes (6.5+)": 0}
            glucose_dist = {"Normal (<100)": 0, "Impaired (100-125)": 0, "High (126+)": 0}

            for r in preds:
                if r.gender in gender_dist:
                    gender_dist[r.gender] += 1
                if r.age < 30:
                    age_dist["Under 30"] += 1
                elif r.age <= 45:
                    age_dist["30-45"] += 1
                elif r.age <= 60:
                    age_dist["46-60"] += 1
                else:
                    age_dist["Above 60"] += 1

                if r.hba1c_level < 5.7:
                    hba1c_dist["Normal (<5.7)"] += 1
                elif r.hba1c_level <= 6.4:
                    hba1c_dist["Prediabetes (5.7-6.4)"] += 1
                else:
                    hba1c_dist["Diabetes (6.5+)"] += 1

                if r.blood_glucose_level < 100:
                    glucose_dist["Normal (<100)"] += 1
                elif r.blood_glucose_level <= 125:
                    glucose_dist["Impaired (100-125)"] += 1
                else:
                    glucose_dist["High (126+)"] += 1

            # Monthly trends breakdown from actual prediction records
            trends_dict = {}
            for r in sorted(preds, key=lambda x: x.created_at):
                m_key = r.created_at.strftime("%Y-%m")
                if m_key not in trends_dict:
                    trends_dict[m_key] = {"month": m_key, "total": 0, "positive": 0, "negative": 0}
                trends_dict[m_key]["total"] += 1
                if r.result == "Positive":
                    trends_dict[m_key]["positive"] += 1
                else:
                    trends_dict[m_key]["negative"] += 1

            monthly_trends = list(trends_dict.values())[-6:]

            recent_logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(5).all()
            recent_audit_logs = [r.to_dict() for r in recent_logs]

    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({
        "totalUsers": total_users,
        "activeUsersToday": active_users_today,
        "totalPredictions": total_predictions,
        "positivePredictions": positive_cases,
        "negativePredictions": negative_cases,
        "totalAIChats": total_chats,
        "reportsGenerated": reports_generated,
        "averageRiskScore": avg_risk_score,
        "recentAuditLogs": recent_audit_logs,
        "recent_audit_logs": recent_audit_logs,

        # Snake_case compatibility
        "total_users": total_users,
        "active_users_today": active_users_today,
        "total_predictions": total_predictions,
        "positive_cases": positive_cases,
        "negative_cases": negative_cases,
        "positive_predictions": positive_cases,
        "negative_predictions": negative_cases,
        "total_chats": total_chats,
        "reports_generated": reports_generated,
        "avg_risk_score": avg_risk_score,
        "api_status": "Operational",
        "server_status": "Online",
        "daily_predictions": daily_predictions,
        "weekly_predictions": weekly_predictions,
        "monthly_predictions": monthly_predictions,
        "monthly_trends": monthly_trends,
        "positive_vs_negative": {"positive": positive_cases, "negative": negative_cases},
        "age_distribution": age_dist,
        "gender_distribution": gender_dist,
        "hba1c_distribution": hba1c_dist,
        "glucose_distribution": glucose_dist,
    })


@admin_bp.route("/analytics", methods=["GET"])
@admin_required
def get_analytics():
    try:
        with get_session() as db:
            rows = db.query(PredictionHistory).all()

            age_dist = {"Under 30": 0, "30-45": 0, "46-60": 0, "Above 60": 0}
            gender_dist = {"Male": 0, "Female": 0}
            bmi_dist = {"Underweight (<18.5)": 0, "Normal (18.5-24.9)": 0, "Overweight (25-29.9)": 0, "Obese (30+)": 0}
            hba1c_dist = {"Normal (<5.7)": 0, "Prediabetes (5.7-6.4)": 0, "Diabetes (6.5+)": 0}
            glucose_dist = {"Normal (<100)": 0, "Impaired (100-125)": 0, "High (126+)": 0}
            diabetes_split = {"Positive": 0, "Negative": 0}
            smoking_dist = {"never": 0, "current": 0, "former": 0, "no info": 0}
            hypertension_dist = {"Yes": 0, "No": 0}
            heart_disease_dist = {"Yes": 0, "No": 0}

            high_risk_patients = []

            for r in rows:
                if r.result == "Positive":
                    diabetes_split["Positive"] += 1
                else:
                    diabetes_split["Negative"] += 1

                if r.gender in gender_dist:
                    gender_dist[r.gender] += 1

                if r.smoking_history in smoking_dist:
                    smoking_dist[r.smoking_history] += 1

                if r.hypertension:
                    hypertension_dist["Yes"] += 1
                else:
                    hypertension_dist["No"] += 1

                if r.heart_disease:
                    heart_disease_dist["Yes"] += 1
                else:
                    heart_disease_dist["No"] += 1

                # Age
                if r.age < 30:
                    age_dist["Under 30"] += 1
                elif r.age <= 45:
                    age_dist["30-45"] += 1
                elif r.age <= 60:
                    age_dist["46-60"] += 1
                else:
                    age_dist["Above 60"] += 1

                # BMI
                if r.bmi < 18.5:
                    bmi_dist["Underweight (<18.5)"] += 1
                elif r.bmi <= 24.9:
                    bmi_dist["Normal (18.5-24.9)"] += 1
                elif r.bmi <= 29.9:
                    bmi_dist["Overweight (25-29.9)"] += 1
                else:
                    bmi_dist["Obese (30+)"] += 1

                # HbA1c
                if r.hba1c_level < 5.7:
                    hba1c_dist["Normal (<5.7)"] += 1
                elif r.hba1c_level <= 6.4:
                    hba1c_dist["Prediabetes (5.7-6.4)"] += 1
                else:
                    hba1c_dist["Diabetes (6.5+)"] += 1

                # Glucose
                if r.blood_glucose_level < 100:
                    glucose_dist["Normal (<100)"] += 1
                elif r.blood_glucose_level <= 125:
                    glucose_dist["Impaired (100-125)"] += 1
                else:
                    glucose_dist["High (126+)"] += 1

                if r.result == "Positive" or (r.probability and r.probability >= 50.0):
                    high_risk_patients.append({
                        "id": r.id,
                        "age": r.age,
                        "gender": r.gender,
                        "bmi": r.bmi,
                        "hba1c_level": r.hba1c_level,
                        "blood_glucose_level": r.blood_glucose_level,
                        "probability": r.probability,
                        "created_at": r.created_at.isoformat(),
                    })

    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({
        "age_distribution": age_dist,
        "gender_distribution": gender_dist,
        "bmi_distribution": bmi_dist,
        "hba1c_distribution": hba1c_dist,
        "glucose_distribution": glucose_dist,
        "diabetes_split": diabetes_split,
        "smoking_distribution": smoking_dist,
        "hypertension_distribution": hypertension_dist,
        "heart_disease_distribution": heart_disease_dist,
        "high_risk_patients": high_risk_patients[:10],
        "total_records": len(rows),
    })


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------
@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_users():
    q = request.args.get("q", "").strip()
    role = request.args.get("role")
    active = request.args.get("active")
    page = max(request.args.get("page", default=1, type=int), 1)
    page_size = min(request.args.get("page_size", default=20, type=int), 100)

    try:
        with get_session() as db:
            query = db.query(User)
            if q:
                pattern = f"%{q}%"
                query = query.filter((User.username.ilike(pattern)) | (User.email.ilike(pattern)) | (User.full_name.ilike(pattern)))
            if role in ("user", "admin"):
                query = query.filter(User.role == role)
            if active in ("1", "true", "True"):
                query = query.filter(User.is_active.is_(True))
            elif active in ("0", "false", "False"):
                query = query.filter(User.is_active.is_(False))

            total = query.count()
            rows = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
            items = []
            for u in rows:
                pred_count = db.query(PredictionHistory).filter_by(user_id=u.id).count()
                items.append({
                    "id": u.id,
                    "username": u.username,
                    "email": u.email,
                    "full_name": u.full_name,
                    "role": u.role,
                    "is_active": u.is_active,
                    "created_at": u.created_at.isoformat(),
                    "prediction_count": pred_count,
                })
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size else 0,
    })


@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
@admin_required
def update_user(user_id):
    payload = request.get_json(silent=True) or {}
    try:
        with get_session() as db:
            user = db.query(User).filter_by(id=user_id).first()
            if not user:
                return jsonify({"error": "User not found."}), 404

            if "full_name" in payload:
                user.full_name = payload["full_name"].strip() or None
            if "role" in payload and payload["role"] in ("user", "admin"):
                user.role = payload["role"]
            if "is_active" in payload:
                user.is_active = bool(payload["is_active"])
            if "email" in payload and payload["email"].strip().lower() != user.email:
                new_email = payload["email"].strip().lower()
                clash = db.query(User).filter(User.email == new_email, User.id != user_id).first()
                if clash:
                    return jsonify({"error": "Email is already taken."}), 409
                user.email = new_email

            db.flush()
            out = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat(),
            }
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "user_updated", f"Admin updated user {user_id}")
    return jsonify(out)


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@admin_required
def delete_user(user_id):
    if user_id == g.current_user["id"]:
        return jsonify({"error": "You cannot delete your own admin account."}), 400

    try:
        with get_session() as db:
            user = db.query(User).filter_by(id=user_id).first()
            if not user:
                return jsonify({"error": "User not found."}), 404
            db.delete(user)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "user_deactivated", f"Admin deleted user {user_id}")
    return jsonify({"deleted": user_id})


# ---------------------------------------------------------------------------
# Prediction Management
# ---------------------------------------------------------------------------
@admin_bp.route("/predictions", methods=["GET"])
@admin_required
def list_predictions():
    q = request.args.get("q", "").strip()
    result = request.args.get("result")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    page = max(request.args.get("page", default=1, type=int), 1)
    page_size = min(request.args.get("page_size", default=20, type=int), 100)

    try:
        with get_session() as db:
            query = db.query(PredictionHistory)
            if result in ("Positive", "Negative"):
                query = query.filter(PredictionHistory.result == result)
            if date_from:
                query = query.filter(PredictionHistory.created_at >= date_from)
            if date_to:
                query = query.filter(PredictionHistory.created_at <= date_to)
            if q:
                pattern = f"%{q}%"
                query = query.join(User, PredictionHistory.user_id == User.id, isouter=True).filter(
                    (PredictionHistory.id.ilike(pattern)) | (User.username.ilike(pattern)) | (User.email.ilike(pattern))
                )

            total = query.count()
            rows = query.order_by(PredictionHistory.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
            
            # Map associated usernames
            user_ids = {r.user_id for r in rows if r.user_id}
            users_by_id = {}
            if user_ids:
                for u in db.query(User).filter(User.id.in_(user_ids)).all():
                    users_by_id[u.id] = u.username

            items = []
            for r in rows:
                d = r.to_api_dict()
                d["username"] = users_by_id.get(r.user_id, "Anonymous")
                items.append(d)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size else 0,
    })


@admin_bp.route("/predictions/<prediction_id>", methods=["DELETE"])
@admin_required
def delete_prediction(prediction_id):
    try:
        with get_session() as db:
            row = db.query(PredictionHistory).filter_by(id=prediction_id).first()
            if not row:
                return jsonify({"error": "Prediction not found."}), 404
            db.delete(row)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "history_deleted", f"Admin deleted prediction {prediction_id}")
    return jsonify({"deleted": prediction_id})


# ---------------------------------------------------------------------------
# AI Chat Management
# ---------------------------------------------------------------------------
@admin_bp.route("/chats", methods=["GET"])
@admin_required
def list_all_chats():
    q = request.args.get("q", "").strip()
    page = max(request.args.get("page", default=1, type=int), 1)
    page_size = min(request.args.get("page_size", default=20, type=int), 100)

    try:
        with get_session() as db:
            query = db.query(ChatSession)
            if q:
                pattern = f"%{q}%"
                query = query.filter(ChatSession.title.ilike(pattern))

            total = query.count()
            rows = query.order_by(ChatSession.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

            user_ids = {r.user_id for r in rows if r.user_id}
            users_by_id = {}
            if user_ids:
                for u in db.query(User).filter(User.id.in_(user_ids)).all():
                    users_by_id[u.id] = u.username

            items = []
            for r in rows:
                count = db.query(ChatHistory).filter_by(session_id=r.id).count()
                last = db.query(ChatHistory).filter_by(session_id=r.id).order_by(ChatHistory.created_at.desc()).first()
                d = r.to_dict(message_count=count, last_message=last.message[:80] if last else None)
                d["username"] = users_by_id.get(r.user_id, "Anonymous")
                items.append(d)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size else 0,
    })


@admin_bp.route("/chats/<session_id>", methods=["DELETE"])
@admin_required
def delete_chat_session(session_id):
    try:
        with get_session() as db:
            row = db.query(ChatSession).filter_by(id=session_id).first()
            if not row:
                return jsonify({"error": "Chat session not found."}), 404
            db.query(ChatHistory).filter_by(session_id=session_id).delete()
            db.delete(row)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "chat_activity", f"Admin deleted chat session {session_id}")
    return jsonify({"deleted": session_id})


# ---------------------------------------------------------------------------
# Feedback & Support Ticket Management
# ---------------------------------------------------------------------------
@admin_bp.route("/feedback", methods=["GET"])
@admin_required
def list_feedback():
    page = max(request.args.get("page", default=1, type=int), 1)
    page_size = min(request.args.get("page_size", default=20, type=int), 100)

    try:
        with get_session() as db:
            query = db.query(Feedback)
            total = query.count()
            rows = query.order_by(Feedback.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
            items = [r.to_dict() for r in rows]
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size else 0,
    })


@admin_bp.route("/feedback/<int:feedback_id>", methods=["PUT"])
@admin_required
def update_feedback(feedback_id):
    payload = request.get_json(silent=True) or {}
    try:
        with get_session() as db:
            row = db.query(Feedback).filter_by(id=feedback_id).first()
            if not row:
                return jsonify({"error": "Feedback ticket not found."}), 404
            if "status" in payload:
                row.status = payload["status"]
            db.flush()
            out = row.to_dict()
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "user_updated", f"Admin updated feedback {feedback_id} status to {row.status}")
    return jsonify(out)


@admin_bp.route("/feedback/<int:feedback_id>", methods=["DELETE"])
@admin_required
def delete_feedback(feedback_id):
    try:
        with get_session() as db:
            row = db.query(Feedback).filter_by(id=feedback_id).first()
            if not row:
                return jsonify({"error": "Feedback ticket not found."}), 404
            db.delete(row)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "user_updated", f"Admin deleted feedback {feedback_id}")
    return jsonify({"deleted": feedback_id})


@admin_bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
@admin_required
def admin_reset_user_password(user_id):
    from auth import hash_password
    try:
        with get_session() as db:
            user = db.query(User).filter_by(id=user_id).first()
            if not user:
                return jsonify({"error": "User not found."}), 404
            temp_pass = "TempPassword123!"
            user.password_hash = hash_password(temp_pass)
            db.flush()
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(g.current_user["id"], "password_changed", f"Admin reset password for user {user_id}")
    return jsonify({"message": f"Password reset successfully for {user.username}.", "temp_password": temp_pass})


@admin_bp.route("/predictions/export-csv", methods=["GET"])
@admin_required
def export_predictions_csv():
    import io
    import csv

    try:
        with get_session() as db:
            rows = db.query(PredictionHistory).order_by(PredictionHistory.created_at.desc()).all()
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Prediction ID", "User ID", "Age", "Gender", "BMI", "HbA1c Level", "Blood Glucose", "Hypertension", "Heart Disease", "Smoking History", "Result", "Probability (%)", "Created At"])
            for r in rows:
                writer.writerow([
                    r.id, r.user_id, r.age, r.gender, r.bmi, r.hba1c_level, r.blood_glucose_level,
                    "Yes" if r.hypertension else "No", "Yes" if r.heart_disease else "No",
                    r.smoking_history, r.result, r.probability, r.created_at.isoformat()
                ])
            mem = io.BytesIO(output.getvalue().encode("utf-8"))
            return send_file(mem, mimetype="text/csv", as_attachment=True, download_name=f"predictions_export_{datetime.utcnow().strftime('%Y%m%d')}.csv")
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500


@admin_bp.route("/audit-logs/export-csv", methods=["GET"])
@admin_required
def export_audit_logs_csv():
    import io
    import csv

    try:
        with get_session() as db:
            rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).all()
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Log ID", "User ID", "Action", "Description", "IP Address", "Status", "Created At"])
            for r in rows:
                writer.writerow([r.id, r.user_id, r.action, r.description, r.ip_address, r.status, r.created_at.isoformat()])
            mem = io.BytesIO(output.getvalue().encode("utf-8"))
            return send_file(mem, mimetype="text/csv", as_attachment=True, download_name=f"audit_logs_{datetime.utcnow().strftime('%Y%m%d')}.csv")
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500


