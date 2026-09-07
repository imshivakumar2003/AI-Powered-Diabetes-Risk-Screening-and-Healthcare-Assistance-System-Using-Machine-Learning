"""
routes/chat_routes.py
------------------------
AI Health Assistant chatbot endpoints, mounted at /api/chat/*. Purely
additive — reuses the existing `chat_history` table for messages and the
new `chat_sessions` table for metadata (title, favorite, language).

    POST   /api/chat/sessions                new chat
    GET    /api/chat/sessions                list (search, favorite filter, paginated)
    PATCH  /api/chat/sessions/<id>            rename / toggle favorite
    DELETE /api/chat/sessions/<id>            delete session + its messages
    GET    /api/chat/sessions/<id>/messages   fetch full transcript
    POST   /api/chat/sessions/<id>/messages   send a message, get AI reply
    POST   /api/chat/sessions/<id>/regenerate regenerate the last AI reply
    GET    /api/chat/sessions/<id>/export     download transcript (pdf|txt)
"""

import io
from datetime import datetime

from flask import Blueprint, jsonify, request, send_file
from sqlalchemy.exc import SQLAlchemyError

from database import get_session
from models import ChatSession, ChatHistory, PredictionHistory
from auth import get_optional_user
from audit import log_action
from groq_service import generate_chat_reply, suggest_title, is_configured

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")


def _get_user_context(db, user_id):
    if not user_id:
        return None
    latest = (
        db.query(PredictionHistory)
        .filter_by(user_id=user_id)
        .order_by(PredictionHistory.created_at.desc())
        .first()
    )
    if not latest:
        return None
    prob_val = latest.probability or 0.0
    return {
        "age": latest.age,
        "gender": latest.gender,
        "bmi": latest.bmi,
        "hba1c_level": latest.hba1c_level,
        "blood_glucose_level": latest.blood_glucose_level,
        "hypertension": "Yes" if latest.hypertension else "No",
        "heart_disease": "Yes" if latest.heart_disease else "No",
        "smoking_history": latest.smoking_history,
        "result": latest.result,
        "probability": f"{prob_val:.1f}%",
        "risk_level": "High Risk" if prob_val >= 70 else ("Moderate Risk" if prob_val >= 40 else "Low Risk"),
        "date": latest.created_at.strftime("%Y-%m-%d"),
    }


def _get_session_or_404(db, session_id, current_user):
    row = db.query(ChatSession).filter_by(id=session_id).first()
    if row is None:
        return None, (jsonify({"error": "Chat session not found."}), 404)
    if current_user and row.user_id is not None and row.user_id != current_user["id"]:
        return None, (jsonify({"error": "You do not have access to this chat."}), 403)
    if not current_user and row.user_id is not None:
        return None, (jsonify({"error": "You do not have access to this chat."}), 403)
    return row, None


@chat_bp.route("/status", methods=["GET"])
def chat_status():
    return jsonify({"configured": is_configured()})


@chat_bp.route("/sessions", methods=["POST"])
def create_session():
    current_user = get_optional_user()
    payload = request.get_json(silent=True) or {}
    language = payload.get("language", "auto")

    try:
        with get_session() as db:
            session_row = ChatSession(
                user_id=current_user["id"] if current_user else None,
                title="New Chat",
                language=language,
            )
            db.add(session_row)
            db.flush()
            out = session_row.to_dict(message_count=0, last_message=None)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify(out), 201


@chat_bp.route("/sessions", methods=["GET"])
def list_sessions():
    current_user = get_optional_user()
    q = request.args.get("q", "").strip()
    favorite_only = request.args.get("favorite") in ("1", "true", "True")
    page = max(request.args.get("page", default=1, type=int), 1)
    page_size = min(request.args.get("page_size", default=20, type=int), 100)

    try:
        with get_session() as db:
            query = db.query(ChatSession)
            if current_user:
                query = query.filter(ChatSession.user_id == current_user["id"])
            else:
                query = query.filter(ChatSession.user_id.is_(None))
            if q:
                query = query.filter(ChatSession.title.ilike(f"%{q}%"))
            if favorite_only:
                query = query.filter(ChatSession.is_favorite.is_(True))

            total = query.count()
            rows = (
                query.order_by(ChatSession.updated_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
                .all()
            )

            items = []
            for r in rows:
                last = (
                    db.query(ChatHistory)
                    .filter_by(session_id=r.id)
                    .order_by(ChatHistory.created_at.desc())
                    .first()
                )
                count = db.query(ChatHistory).filter_by(session_id=r.id).count()
                items.append(r.to_dict(message_count=count, last_message=last.message[:80] if last else None))
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({
        "items": items, "total": total, "page": page, "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size else 0,
    })


@chat_bp.route("/sessions/<session_id>", methods=["PATCH"])
def update_session(session_id):
    current_user = get_optional_user()
    payload = request.get_json(silent=True) or {}

    try:
        with get_session() as db:
            row, err = _get_session_or_404(db, session_id, current_user)
            if err:
                return err
            if "title" in payload and payload["title"].strip():
                row.title = payload["title"].strip()[:150]
            if "is_favorite" in payload:
                row.is_favorite = bool(payload["is_favorite"])
            row.updated_at = datetime.utcnow()
            db.flush()
            out = row.to_dict()
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify(out)


@chat_bp.route("/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    current_user = get_optional_user()
    try:
        with get_session() as db:
            row, err = _get_session_or_404(db, session_id, current_user)
            if err:
                return err
            db.query(ChatHistory).filter_by(session_id=session_id).delete()
            db.delete(row)
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({"deleted": session_id})


@chat_bp.route("/sessions/<session_id>/messages", methods=["GET"])
def get_messages(session_id):
    current_user = get_optional_user()
    try:
        with get_session() as db:
            row, err = _get_session_or_404(db, session_id, current_user)
            if err:
                return err
            msgs = (
                db.query(ChatHistory)
                .filter_by(session_id=session_id)
                .order_by(ChatHistory.created_at.asc())
                .all()
            )
            session_dict = row.to_dict()
            items = [
                {"id": m.id, "role": m.role, "message": m.message, "created_at": m.created_at.isoformat()}
                for m in msgs
            ]
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify({"session": session_dict, "messages": items})


@chat_bp.route("/sessions/<session_id>/messages", methods=["POST"])
def post_message(session_id):
    current_user = get_optional_user()
    payload = request.get_json(silent=True) or {}
    text = (payload.get("message") or "").strip()
    if not text:
        return jsonify({"error": "message is required."}), 400

    try:
        with get_session() as db:
            row, err = _get_session_or_404(db, session_id, current_user)
            if err:
                return err

            language = payload.get("language") or row.language or "en"

            prior = (
                db.query(ChatHistory)
                .filter_by(session_id=session_id)
                .order_by(ChatHistory.created_at.asc())
                .all()
            )
            history_for_ai = [{"role": m.role, "message": m.message} for m in prior]

            user_msg = ChatHistory(user_id=row.user_id, session_id=session_id, role="user", message=text)
            db.add(user_msg)
            db.flush()

            user_ctx = _get_user_context(db, row.user_id)
            reply_text, source = generate_chat_reply(history_for_ai, text, language=language, user_context=user_ctx)

            if source == "fallback" and ("Unable to connect" in reply_text or "isn't connected" in reply_text):
                db.rollback()
                return jsonify({
                    "error": reply_text,
                    "details": "AI service model failure."
                }), 503

            assistant_msg = ChatHistory(
                user_id=row.user_id, session_id=session_id, role="assistant", message=reply_text
            )
            db.add(assistant_msg)

            if row.title == "New Chat" and not prior:
                row.title = suggest_title(text)
            row.language = language
            row.updated_at = datetime.utcnow()
            db.flush()

            if row.user_id:
                try:
                    from notification_service import create_user_notification
                    create_user_notification(row.user_id, "ai_chat_response", db_session=db)
                except Exception:
                    pass

            out = {
                "user_message": {"id": user_msg.id, "role": "user", "message": text,
                                   "created_at": user_msg.created_at.isoformat()},
                "assistant_message": {"id": assistant_msg.id, "role": "assistant", "message": reply_text,
                                        "created_at": assistant_msg.created_at.isoformat(), "source": source},
                "session": row.to_dict(),
            }
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    log_action(current_user["id"] if current_user else None, "chat_activity",
               f"Message sent in chat session {session_id}")
    return jsonify(out)


@chat_bp.route("/sessions/<session_id>/regenerate", methods=["POST"])
def regenerate_reply(session_id):
    current_user = get_optional_user()
    payload = request.get_json(silent=True) or {}
    try:
        with get_session() as db:
            row, err = _get_session_or_404(db, session_id, current_user)
            if err:
                return err

            language = payload.get("language") or row.language or "en"

            msgs = (
                db.query(ChatHistory)
                .filter_by(session_id=session_id)
                .order_by(ChatHistory.created_at.asc())
                .all()
            )
            if not msgs or msgs[-1].role != "assistant":
                return jsonify({"error": "Nothing to regenerate yet."}), 400

            last_user_msg = None
            for m in reversed(msgs[:-1]):
                if m.role == "user":
                    last_user_msg = m
                    break
            if last_user_msg is None:
                return jsonify({"error": "No prior user message found."}), 400

            history_for_ai = [{"role": m.role, "message": m.message} for m in msgs[:-1]]
            user_ctx = _get_user_context(db, row.user_id)
            reply_text, source = generate_chat_reply(history_for_ai, last_user_msg.message, language=language, user_context=user_ctx)

            db.delete(msgs[-1])
            db.flush()
            new_msg = ChatHistory(user_id=row.user_id, session_id=session_id, role="assistant", message=reply_text)
            db.add(new_msg)
            row.updated_at = datetime.utcnow()
            db.flush()

            out = {"id": new_msg.id, "role": "assistant", "message": reply_text,
                   "created_at": new_msg.created_at.isoformat(), "source": source}
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    return jsonify(out)


@chat_bp.route("/sessions/<session_id>/export", methods=["GET"])
def export_session(session_id):
    current_user = get_optional_user()
    fmt = request.args.get("format", "pdf").lower()

    try:
        with get_session() as db:
            row, err = _get_session_or_404(db, session_id, current_user)
            if err:
                return err
            msgs = (
                db.query(ChatHistory)
                .filter_by(session_id=session_id)
                .order_by(ChatHistory.created_at.asc())
                .all()
            )
            transcript = [(m.role, m.message, m.created_at) for m in msgs]
            title = row.title
    except SQLAlchemyError as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    if fmt == "txt":
        lines = [f"GlucoseCheck AI Assistant — {title}", ""]
        for role, message, created_at in transcript:
            speaker = "You" if role == "user" else "Assistant"
            lines.append(f"[{created_at.strftime('%Y-%m-%d %H:%M')}] {speaker}: {message}")
        mem = io.BytesIO("\n".join(lines).encode("utf-8"))
        return send_file(mem, mimetype="text/plain", as_attachment=True,
                          download_name=f"chat_{session_id[:8]}.txt")

    # default: pdf
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("ChatTitle", parent=styles["Heading1"], fontSize=16,
                               textColor=colors.HexColor("#0f1b2d")))
    styles.add(ParagraphStyle("UserMsg", parent=styles["Normal"], fontSize=10, leading=14,
                               textColor=colors.HexColor("#0f1b2d"), spaceBefore=8))
    styles.add(ParagraphStyle("AiMsg", parent=styles["Normal"], fontSize=10, leading=14,
                               textColor=colors.HexColor("#0a5d65"), spaceBefore=8))
    styles.add(ParagraphStyle("Meta", parent=styles["Normal"], fontSize=7.5,
                               textColor=colors.HexColor("#6c7d97")))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
                             leftMargin=18 * mm, rightMargin=18 * mm)
    elements = [Paragraph(f"GlucoseCheck AI Assistant — {title}", styles["ChatTitle"]), Spacer(1, 6),
                HRFlowable(width="100%", color=colors.HexColor("#e3e8ee")), Spacer(1, 10)]

    for role, message, created_at in transcript:
        speaker = "You" if role == "user" else "AI Assistant"
        style = styles["UserMsg"] if role == "user" else styles["AiMsg"]
        safe_msg = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        elements.append(Paragraph(f"<b>{speaker}</b>", styles["Meta"]))
        elements.append(Paragraph(safe_msg.replace("\n", "<br/>"), style))

    doc.build(elements)
    buf.seek(0)

    log_action(current_user["id"] if current_user else None, "report_download",
               f"Chat {session_id} exported as PDF")

    return send_file(buf, mimetype="application/pdf", as_attachment=True,
                      download_name=f"chat_{session_id[:8]}.pdf")


@chat_bp.route("/speech-to-text", methods=["POST", "OPTIONS"])
@chat_bp.route("/stt", methods=["POST", "OPTIONS"])
def transcribe_audio():
    if request.method == "OPTIONS":
        return "", 200

    audio_file = request.files.get("audio") or request.files.get("file")
    if not audio_file:
        return jsonify({"error": "No audio file provided."}), 400

    language = request.form.get("language", "en")

    whisper_lang_map = {
        "en": "en",
        "hi": "hi",
        "kn": "kn",
        "ta": "ta",
        "te": "te",
    }
    target_lang = whisper_lang_map.get(language, "en")

    try:
        from groq_service import get_groq_client
        client = get_groq_client()

        if client:
            filename = audio_file.filename or "recording.webm"
            audio_bytes = audio_file.read()

            if len(audio_bytes) == 0:
                return jsonify({"error": "Audio recording is empty."}), 400

            transcription = client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3",
                language=target_lang,
                response_format="json",
            )
            text = transcription.text.strip() if hasattr(transcription, "text") else str(transcription).strip()
            return jsonify({"text": text, "transcript": text, "engine": "groq-whisper"})

    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"Groq Whisper STT failed: {exc}")

    return jsonify({"error": "Groq Whisper API transcription failed. Please retry."}), 500


@chat_bp.route("/text-to-speech", methods=["POST", "OPTIONS"])
@chat_bp.route("/tts", methods=["POST", "OPTIONS"])
def generate_tts_audio():
    if request.method == "OPTIONS":
        return "", 200

    payload = request.get_json(silent=True) or {}
    text = payload.get("text", "").strip()
    language = payload.get("language", "en")

    if not text:
        return jsonify({"error": "No text provided."}), 400

    import re
    clean_text = re.sub(r'[*#`_-]', '', text)
    lang_map = {"en": "en", "hi": "hi", "kn": "kn", "ta": "ta", "te": "te"}
    target_lang = lang_map.get(language, "en")

    try:
        from gtts import gTTS
        import io

        tts = gTTS(text=clean_text[:1200], lang=target_lang, slow=False)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        return send_file(fp, mimetype="audio/mp3", as_attachment=False)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"TTS synthesis error: {exc}")
        return jsonify({"error": "Text-to-Speech synthesis failed."}), 500



