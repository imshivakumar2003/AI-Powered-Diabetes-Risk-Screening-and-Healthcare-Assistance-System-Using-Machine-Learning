"""
routes/report_routes.py
-------------------------
New, purely additive endpoints for:
  - AI health suggestions per prediction (Groq-powered, cached)
  - Professional PDF report generation (with QR code + AI suggestions)
  - Emailing a report
  - Report history (list / delete)

Mounted at /api/predictions/* and /api/reports. Does not modify or replace
any existing route in app.py.
"""

import os
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

from flask import Blueprint, jsonify, request, send_file, g
from sqlalchemy.exc import SQLAlchemyError

from database import get_session
from models import PredictionHistory, Suggestion, Report, Patient
from auth import get_optional_user, login_required
from audit import log_action
from suggestions_service import generate_suggestions, _fallback_suggestions
from reports_service import build_report_pdf

report_bp = Blueprint("reports", __name__, url_prefix="/api")


def _get_prediction_or_404(db, prediction_id, current_user):
    query = db.query(PredictionHistory).filter_by(id=prediction_id)
    row = query.first()
    if row is None:
        return None, (jsonify({"error": "Prediction not found."}), 404)
    # If logged in as a non-admin, patients can only touch their own records.
    if current_user and current_user.get("role") != "admin":
        if row.user_id is not None and row.user_id != current_user["id"]:
            return None, (jsonify({"error": "You do not have access to this record."}), 403)
    return row, None


@report_bp.route("/predictions/<prediction_id>/suggestions", methods=["GET"])
def get_suggestions(prediction_id):
    current_user = get_optional_user()
    try:
        with get_session() as db:
            row, err = _get_prediction_or_404(db, prediction_id, current_user)
            if err:
                return err
            suggestion = db.query(Suggestion).filter_by(prediction_id=prediction_id).first()
            if suggestion is None:
                language = "en"
                if current_user:
                    pref_setting = db.query(Setting).filter_by(user_id=current_user["id"], key="preferred_language").first()
                    if pref_setting and pref_setting.value:
                        language = pref_setting.value

                record = row.to_api_dict()
                result = generate_suggestions(record, language=language)
                suggestion = Suggestion(prediction_id=prediction_id)
                db.add(suggestion)
                suggestion.risk_analysis = result.get("risk_analysis")
                suggestion.lifestyle = json.dumps(result.get("lifestyle") or [])
                suggestion.food = json.dumps(result.get("food") or [])
                suggestion.exercise = json.dumps(result.get("exercise") or [])
                suggestion.water_intake = result.get("water_intake")
                suggestion.sleep = result.get("sleep")
                suggestion.stress_management = json.dumps(result.get("stress_management") or [])
                suggestion.next_checkup = result.get("next_checkup")
                suggestion.disclaimer = result.get("disclaimer")
                suggestion.source = result.get("source", "ai")
                suggestion.language = language

                try:
                    db.flush()
                except SQLAlchemyError:
                    db.rollback()
                    suggestion = db.query(Suggestion).filter_by(prediction_id=prediction_id).first()

            if suggestion:
                return jsonify(suggestion.to_dict())
            else:
                fallback = _fallback_suggestions(row.to_api_dict())
                fallback["prediction_id"] = prediction_id
                return jsonify(fallback)
    except Exception as exc:
        return jsonify({"error": f"Error loading suggestions: {exc}"}), 500


@report_bp.route("/predictions/<prediction_id>/suggestions", methods=["POST"])
def create_suggestions(prediction_id):
    """Generates (or regenerates, with ?force=1) AI suggestions for a
    prediction and caches them in the suggestions table."""
    current_user = get_optional_user()
    force = request.args.get("force") in ("1", "true", "True")
    req_lang = (request.get_json(silent=True) or {}).get("language")

    try:
        with get_session() as db:
            row, err = _get_prediction_or_404(db, prediction_id, current_user)
            if err:
                return err

            language = req_lang
            if not language and current_user:
                pref_setting = db.query(Setting).filter_by(user_id=current_user["id"], key="preferred_language").first()
                if pref_setting and pref_setting.value:
                    language = pref_setting.value
            if not language:
                language = "en"

            existing = db.query(Suggestion).filter_by(prediction_id=prediction_id).first()
            if existing and not force:
                return jsonify(existing.to_dict())

            record = row.to_api_dict()
            result = generate_suggestions(record, language=language)

            if not existing:
                existing = db.query(Suggestion).filter_by(prediction_id=prediction_id).first()

            if existing:
                target = existing
            else:
                target = Suggestion(prediction_id=prediction_id)
                db.add(target)

            target.risk_analysis = result.get("risk_analysis")
            target.lifestyle = json.dumps(result.get("lifestyle") or [])
            target.food = json.dumps(result.get("food") or [])
            target.exercise = json.dumps(result.get("exercise") or [])
            target.water_intake = result.get("water_intake")
            target.sleep = result.get("sleep")
            target.stress_management = json.dumps(result.get("stress_management") or [])
            target.next_checkup = result.get("next_checkup")
            target.disclaimer = result.get("disclaimer")
            target.source = result.get("source", "ai")
            target.language = language

            try:
                db.flush()
            except SQLAlchemyError:
                db.rollback()
                target = db.query(Suggestion).filter_by(prediction_id=prediction_id).first()
                if not target:
                    target = Suggestion(prediction_id=prediction_id)
                    db.add(target)
                target.risk_analysis = result.get("risk_analysis")
                target.lifestyle = json.dumps(result.get("lifestyle") or [])
                target.food = json.dumps(result.get("food") or [])
                target.exercise = json.dumps(result.get("exercise") or [])
                target.water_intake = result.get("water_intake")
                target.sleep = result.get("sleep")
                target.stress_management = json.dumps(result.get("stress_management") or [])
                target.next_checkup = result.get("next_checkup")
                target.disclaimer = result.get("disclaimer")
                target.source = result.get("source", "ai")
                target.language = language
                db.flush()

            out = target.to_dict()
    except Exception as exc:
        return jsonify({"error": f"Failed to process suggestions: {exc}"}), 500

    log_action(current_user["id"] if current_user else None, "chat_activity",
               f"AI suggestions generated for prediction {prediction_id}")
    return jsonify(out)


def _generate_pdf_bytes(db, row, current_user):
    """Shared helper: ensures suggestions exist, builds the PDF, records a
    Report row. Returns (BytesIO, filename)."""
    record = row.to_api_dict()
    suggestion = db.query(Suggestion).filter_by(prediction_id=row.id).first()
    if suggestion is None:
        result = generate_suggestions(record, language="en")
        suggestion = Suggestion(
            prediction_id=row.id,
            risk_analysis=result.get("risk_analysis"),
            lifestyle=json.dumps(result.get("lifestyle") or []),
            food=json.dumps(result.get("food") or []),
            exercise=json.dumps(result.get("exercise") or []),
            water_intake=result.get("water_intake"),
            sleep=result.get("sleep"),
            stress_management=json.dumps(result.get("stress_management") or []),
            next_checkup=result.get("next_checkup"),
            disclaimer=result.get("disclaimer"),
            source=result.get("source", "ai"),
            language="en",
        )
        db.add(suggestion)
        db.flush()

    patient_name = None
    if row.patient_id:
        patient = db.query(Patient).filter_by(id=row.patient_id).first()
        patient_name = patient.full_name if patient else None
    elif current_user:
        patient_name = current_user.get("full_name") or current_user.get("username")

    pdf_buf = build_report_pdf(record, suggestion.to_dict(), patient_name=patient_name)

    report_row = Report(
        prediction_id=row.id,
        user_id=current_user["id"] if current_user else None,
        report_type="pdf",
        file_path=None,  # streamed, not persisted to disk
    )
    db.add(report_row)
    db.flush()

    filename = f"GlucoseCheck_Report_{row.id[:8]}.pdf"
    return pdf_buf, filename


@report_bp.route("/predictions/<prediction_id>/report/pdf", methods=["GET"])
def download_report_pdf(prediction_id):
    current_user = get_optional_user()
    try:
        with get_session() as db:
            row, err = _get_prediction_or_404(db, prediction_id, current_user)
            if err:
                return err
            pdf_buf, filename = _generate_pdf_bytes(db, row, current_user)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(current_user["id"] if current_user else None, "report_download",
               f"PDF report generated for prediction {prediction_id}")

    return send_file(pdf_buf, mimetype="application/pdf", as_attachment=True,
                      download_name=filename)


@report_bp.route("/predictions/<prediction_id>/report/email", methods=["POST"])
def email_report(prediction_id):
    current_user = get_optional_user()
    payload = request.get_json(silent=True) or {}
    to_email = payload.get("email") or (current_user or {}).get("email")

    if not to_email:
        return jsonify({"error": "An email address is required."}), 400

    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASSWORD")
    from_email = os.environ.get("SMTP_FROM_EMAIL", smtp_user or "no-reply@glucosecheck.app")

    if not smtp_host or not smtp_user or not smtp_pass:
        try:
            with get_session() as db:
                row, err = _get_prediction_or_404(db, prediction_id, current_user)
                if err:
                    return err
                report_row = Report(
                    prediction_id=row.id,
                    user_id=current_user["id"] if current_user else None,
                    report_type="email",
                    file_path=to_email,
                )
                db.add(report_row)
                db.flush()
            log_action(current_user["id"] if current_user else None, "report_email",
                       f"Report emailed (dev simulation) to {to_email} for prediction {prediction_id}")
            return jsonify({"sent": True, "to": to_email, "simulated": True})
        except Exception as exc:
            return jsonify({"error": f"Database error: {exc}"}), 500

    try:
        with get_session() as db:
            row, err = _get_prediction_or_404(db, prediction_id, current_user)
            if err:
                return err
            pdf_buf, filename = _generate_pdf_bytes(db, row, current_user)

            report_row = Report(
                prediction_id=row.id,
                user_id=current_user["id"] if current_user else None,
                report_type="email",
                file_path=to_email,
            )
            db.add(report_row)
            db.flush()

        msg = MIMEMultipart()
        msg["Subject"] = "Your GlucoseCheck Screening Report"
        msg["From"] = from_email
        msg["To"] = to_email
        msg.attach(MIMEText(
            "Hello,\n\nYour diabetes screening report is attached.\n\n"
            "This is an automated message from GlucoseCheck.", "plain"
        ))
        attachment = MIMEApplication(pdf_buf.read(), _subtype="pdf")
        attachment.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(attachment)

        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500
    except Exception as exc:
        return jsonify({"error": f"Could not send email: {exc}"}), 502

    log_action(current_user["id"] if current_user else None, "report_download",
               f"Report emailed to {to_email} for prediction {prediction_id}")
    return jsonify({"sent": True, "to": to_email})


@report_bp.route("/reports", methods=["GET"])
def list_reports():
    current_user = get_optional_user()
    page = max(request.args.get("page", default=1, type=int), 1)
    page_size = min(request.args.get("page_size", default=500, type=int), 1000)

    try:
        with get_session() as db:
            query = db.query(PredictionHistory)
            if current_user and current_user.get("role") != "admin":
                query = query.filter(PredictionHistory.user_id == current_user["id"])

            total = query.count()
            rows = (
                query.order_by(PredictionHistory.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
                .all()
            )
            items = []
            for pred in rows:
                p_dict = pred.to_api_dict()
                prob = pred.probability or 0
                risk_level = "High Risk" if prob >= 70 else ("Moderate Risk" if prob >= 40 else "Low Risk")

                patient_name = "Patient"
                if pred.patient_id:
                    patient = db.query(Patient).filter_by(id=pred.patient_id).first()
                    patient_name = patient.full_name if patient else "Patient"
                elif current_user:
                    patient_name = current_user.get("full_name") or current_user.get("username") or "Patient"

                items.append({
                    "id": f"REP-{pred.id[:8].upper()}",
                    "prediction_id": pred.id,
                    "patient_name": patient_name,
                    "report_type": "pdf",
                    "generated_at": pred.created_at.isoformat() if pred.created_at else "",
                    "result": pred.result,
                    "probability": prob,
                    "risk_level": risk_level,
                    "status": "Generated",
                    "record": p_dict,
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


@report_bp.route("/reports/<report_id>", methods=["DELETE"])
def delete_report(report_id):
    current_user = get_optional_user()
    try:
        with get_session() as db:
            pred = None
            if str(report_id).isdigit():
                rep = db.query(Report).filter_by(id=int(report_id)).first()
                if rep:
                    pred = db.query(PredictionHistory).filter_by(id=rep.prediction_id).first()
                    db.delete(rep)

            if pred is None:
                pred = db.query(PredictionHistory).filter_by(id=str(report_id)).first()

            if pred:
                if current_user and current_user.get("role") != "admin" and pred.user_id and pred.user_id != current_user["id"]:
                    return jsonify({"error": "Unauthorized"}), 403
                db.delete(pred)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({"deleted": True})
