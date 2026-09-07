"""
models.py
----------
SQLAlchemy ORM models for the diabetes prediction app.

Tables:
    - users              application users (optional auth)
    - patients           patient records a screening can be linked to
    - prediction_history  every diabetes screening result (core table, used
                          by the existing /api/predict, /api/history routes)
    - chat_history        AI assistant conversation log (for future use)
    - reports             generated report files linked to a prediction
    - settings            per-user or global key/value app settings
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, DateTime,
    ForeignKey, UniqueConstraint, CheckConstraint, Index
)
from sqlalchemy.orm import relationship

from database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=True)
    role = Column(String(20), nullable=False, default="user")
    is_active = Column(Boolean, nullable=False, default=True)
    reset_token = Column(String(255), nullable=True, index=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    patients = relationship("Patient", back_populates="owner", cascade="all, delete-orphan")
    predictions = relationship("PredictionHistory", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("Setting", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("role IN ('user','admin','doctor')", name="ck_users_role"),
    )

    def __repr__(self):
        return f"<User id={self.id} username={self.username!r}>"


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    full_name = Column(String(150), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(10), nullable=True)
    contact_number = Column(String(30), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="patients")
    predictions = relationship("PredictionHistory", back_populates="patient", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("gender IN ('Male','Female','Other') OR gender IS NULL", name="ck_patients_gender"),
        CheckConstraint("age IS NULL OR (age >= 0 AND age <= 120)", name="ck_patients_age"),
    )

    def __repr__(self):
        return f"<Patient id={self.id} name={self.full_name!r}>"


class PredictionHistory(Base):
    """Core table backing the existing /api/predict and /api/history routes."""
    __tablename__ = "prediction_history"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="SET NULL"), nullable=True, index=True)

    # --- model inputs (mirrors the original app.py form fields exactly) ---
    age = Column(Integer, nullable=False)
    gender = Column(String(10), nullable=False)
    hypertension = Column(Boolean, nullable=False, default=False)
    heart_disease = Column(Boolean, nullable=False, default=False)
    bmi = Column(Float, nullable=False)
    hba1c_level = Column(Float, nullable=False)
    blood_glucose_level = Column(Float, nullable=False)
    smoking_history = Column(String(20), nullable=False)

    # --- model output ---
    result = Column(String(10), nullable=False)
    probability = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="predictions")
    patient = relationship("Patient", back_populates="predictions")
    reports = relationship("Report", back_populates="prediction", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("gender IN ('Male','Female')", name="ck_pred_gender"),
        CheckConstraint("result IN ('Positive','Negative')", name="ck_pred_result"),
        CheckConstraint(
            "smoking_history IN ('never','former','current','not current','ever')",
            name="ck_pred_smoking",
        ),
        CheckConstraint("bmi >= 0 AND bmi <= 100", name="ck_pred_bmi"),
        CheckConstraint("hba1c_level >= 0 AND hba1c_level <= 20", name="ck_pred_hba1c"),
        CheckConstraint("blood_glucose_level >= 0 AND blood_glucose_level <= 600", name="ck_pred_glucose"),
        Index("ix_prediction_result_created", "result", "created_at"),
    )

    def to_api_dict(self):
        """Serializes back to the exact JSON shape the frontend already expects."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "timestamp": self.created_at.replace(tzinfo=None).isoformat() + "+00:00",
            "input": {
                "age": self.age,
                "hypertension": "Yes" if self.hypertension else "No",
                "heart_disease": "Yes" if self.heart_disease else "No",
                "bmi": self.bmi,
                "HbA1c_level": self.hba1c_level,
                "blood_glucose_level": self.blood_glucose_level,
                "gender": self.gender,
                "smoking_history": self.smoking_history,
            },
            "result": self.result,
            "probability": self.probability,
        }

    def __repr__(self):
        return f"<PredictionHistory id={self.id} result={self.result}>"


class ChatHistory(Base):
    """AI assistant conversation log (for a future chat/assistant feature)."""
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id = Column(String(64), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="chat_messages")

    __table_args__ = (
        CheckConstraint("role IN ('user','assistant','system')", name="ck_chat_role"),
        Index("ix_chat_session_created", "session_id", "created_at"),
    )

    def __repr__(self):
        return f"<ChatHistory id={self.id} session={self.session_id!r} role={self.role!r}>"


class Report(Base):
    """Generated report files (e.g. PDF export) linked to a prediction."""
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prediction_id = Column(String(36), ForeignKey("prediction_history.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    report_type = Column(String(20), nullable=False, default="pdf")
    file_path = Column(String(500), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    prediction = relationship("PredictionHistory", back_populates="reports")
    user = relationship("User", back_populates="reports")

    __table_args__ = (
        CheckConstraint("report_type IN ('pdf','csv','json')", name="ck_report_type"),
    )

    def __repr__(self):
        return f"<Report id={self.id} type={self.report_type!r}>"


class AuditLog(Base):
    """Tracks security-relevant and data-changing activity across the app."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    status = Column(String(20), nullable=False, default="success")
    extra_data = Column(Text, nullable=True)  # JSON-encoded extra context
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User")

    __table_args__ = (
        CheckConstraint("status IN ('success','failure')", name="ck_audit_status"),
        Index("ix_audit_action_created", "action", "created_at"),
    )

    def to_dict(self):
        admin_name = "Admin"
        if self.user:
            admin_name = self.user.full_name or self.user.username or "Admin"

        target_type = "System"
        if "user" in self.action or "profile" in self.action:
            target_type = "User"
        elif "prediction" in self.action:
            target_type = "Prediction"
        elif "report" in self.action:
            target_type = "Report"
        elif "chat" in self.action:
            target_type = "Chat"

        return {
            "id": self.id,
            "user_id": self.user_id,
            "admin_name": admin_name,
            "action": self.action,
            "target_type": target_type,
            "description": self.description or "Admin system action recorded",
            "ip_address": self.ip_address or "127.0.0.1",
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<AuditLog id={self.id} action={self.action!r}>"


class ChatSession(Base):
    """Metadata for one AI Assistant conversation. Individual messages are
    stored in the existing `chat_history` table, linked by session_id.
    Purely additive — chat_history itself is untouched."""
    __tablename__ = "chat_sessions"

    id = Column(String(64), primary_key=True, default=gen_uuid)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(150), nullable=False, default="New Chat")
    is_favorite = Column(Boolean, nullable=False, default=False)
    language = Column(String(10), nullable=False, default="auto")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self, message_count=None, last_message=None):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "is_favorite": self.is_favorite,
            "language": self.language,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "message_count": message_count,
            "last_message": last_message,
        }

    def __repr__(self):
        return f"<ChatSession id={self.id!r} title={self.title!r}>"


class Suggestion(Base):
    """AI-generated health suggestions linked to one prediction.

    Purely additive table — does not touch prediction_history or any
    existing table/route. Generated once per prediction (cached), can be
    regenerated on demand.
    """
    __tablename__ = "suggestions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prediction_id = Column(String(36), ForeignKey("prediction_history.id", ondelete="CASCADE"),
                            nullable=False, unique=True, index=True)
    risk_analysis = Column(Text, nullable=True)
    lifestyle = Column(Text, nullable=True)         # JSON-encoded list of tips
    food = Column(Text, nullable=True)               # JSON-encoded list of tips
    exercise = Column(Text, nullable=True)            # JSON-encoded list of tips
    water_intake = Column(Text, nullable=True)
    sleep = Column(Text, nullable=True)
    stress_management = Column(Text, nullable=True)   # JSON-encoded list of tips
    next_checkup = Column(Text, nullable=True)
    disclaimer = Column(Text, nullable=True)
    source = Column(String(20), nullable=False, default="ai")  # 'ai' or 'fallback'
    language = Column(String(10), nullable=False, default="en")
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    prediction = relationship("PredictionHistory")

    def to_dict(self):
        import json as _json

        def _load(v):
            if not v:
                return []
            try:
                return _json.loads(v)
            except (ValueError, TypeError):
                return [v]

        return {
            "id": self.id,
            "prediction_id": self.prediction_id,
            "risk_analysis": self.risk_analysis,
            "lifestyle": _load(self.lifestyle),
            "food": _load(self.food),
            "exercise": _load(self.exercise),
            "water_intake": self.water_intake,
            "sleep": self.sleep,
            "stress_management": _load(self.stress_management),
            "next_checkup": self.next_checkup,
            "disclaimer": self.disclaimer,
            "source": self.source,
            "language": self.language,
            "generated_at": self.generated_at.isoformat(),
        }

    def __repr__(self):
        return f"<Suggestion id={self.id} prediction_id={self.prediction_id!r}>"


class Setting(Base):
    """Per-user (or global, when user_id is NULL) key/value settings."""
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="settings")

    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_settings_user_key"),
    )

    def __repr__(self):
        return f"<Setting key={self.key!r} user_id={self.user_id}>"


class Feedback(Base):
    """User submitted support tickets, bug reports, and feedback."""
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    category = Column(String(50), nullable=False, default="feedback")
    subject = Column(String(200), nullable=True)
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="open")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else "Anonymous",
            "category": self.category,
            "subject": self.subject,
            "message": self.message,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Feedback id={self.id} category={self.category!r}>"


class Notification(Base):
    """User notifications table for real-time alerts."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False) # e.g. "prediction_completed", "ai_chat_response", "profile_updated"
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Notification id={self.id} user_id={self.user_id} type={self.type!r}>"


