"""
audit.py
---------
Helper for writing audit log entries. Import `log_action` and call it from
any route that performs a security-relevant or data-changing action.

Usage:
    from audit import log_action
    log_action(user_id=user.id, action="user_login", description="Logged in",
                request=request)
"""

import json
from flask import request as flask_request

from database import get_session
from models import AuditLog

VALID_ACTIONS = {
    "user_login", "admin_login", "admin_logout", "login_failed", "user_register",
    "user_created", "user_updated", "user_deleted", "user_viewed", "user_data_updated",
    "prediction_created", "prediction_viewed", "history_deleted", "history_cleared",
    "chat_activity", "chat_viewed", "report_download", "report_viewed", "report_generated",
    "password_changed", "settings_updated", "database_backup", "database_restore",
    "user_deactivated", "user_activated",
}


def _client_ip(req):
    if req is None:
        return None
    # Respect X-Forwarded-For if behind a proxy/load balancer.
    forwarded = req.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return req.remote_addr


def log_action(user_id, action, description=None, status="success", extra=None, request=None):
    """Writes one audit log row. Never raises — a logging failure should
    never break the calling request."""
    if action not in VALID_ACTIONS:
        action = "user_updated"  # fallback rather than raising on a typo

    req = request or flask_request  # use Flask's request context if available

    try:
        with get_session() as db:
            entry = AuditLog(
                user_id=user_id,
                action=action,
                description=description,
                ip_address=_client_ip(req) if req else None,
                status=status,
                extra_data=json.dumps(extra) if extra else None,
            )
            db.add(entry)
    except Exception:
        # Auditing must never crash the primary request. In production,
        # you'd also log this failure to a separate error tracker.
        pass
