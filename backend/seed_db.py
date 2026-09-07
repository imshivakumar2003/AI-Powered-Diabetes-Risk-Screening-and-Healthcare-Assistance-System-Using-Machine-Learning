"""
seed_db.py
-----------
Populates the database with realistic sample data for development/demo
purposes: a couple of users, patients, prediction history records, a chat
history thread, a report, and default settings.

Safe to re-run: it checks for existing seeded rows (by a fixed marker
username/id) before inserting, so it won't create duplicates.

Usage:
    python seed_db.py
"""

import uuid
from datetime import datetime, timedelta

from database import init_engine_tables, get_session
from models import User, Patient, PredictionHistory, ChatHistory, Report, Setting
from auth import hash_password


def seed():
    init_engine_tables()

    with get_session() as db:
        existing = db.query(User).filter_by(username="dr_mehta").first()
        if existing:
            print("Seed data already present — skipping.")
            return

        # --- Users -----------------------------------------------------
        admin = User(
            username="admin",
            email="admin@example.com",
            password_hash=hash_password("AdminPass123!"),
            full_name="System Administrator",
            role="admin",
        )
        doctor = User(
            username="dr_mehta",
            email="dr.mehta@example.com",
            password_hash=hash_password("ChangeMe123!"),
            full_name="Dr. Anjali Mehta",
            role="doctor",
        )
        patient_user = User(
            username="rahul_k",
            email="rahul.k@example.com",
            password_hash=hash_password("ChangeMe123!"),
            full_name="Rahul Kapoor",
            role="user",
        )
        db.add_all([admin, doctor, patient_user])
        db.flush()  # get IDs before using them below

        # --- Patients ----------------------------------------------------
        patient1 = Patient(
            user_id=doctor.id,
            full_name="Meena Sharma",
            age=52,
            gender="Female",
            contact_number="+91-98765-43210",
        )
        patient2 = Patient(
            user_id=doctor.id,
            full_name="Arjun Nair",
            age=61,
            gender="Male",
            contact_number="+91-91234-56789",
        )
        db.add_all([patient1, patient2])
        db.flush()

        # --- Prediction history -----------------------------------------
        now = datetime.utcnow()
        predictions = [
            PredictionHistory(
                id=str(uuid.uuid4()),
                user_id=doctor.id,
                patient_id=patient1.id,
                age=52, gender="Female",
                hypertension=True, heart_disease=False,
                bmi=31.4, hba1c_level=7.2, blood_glucose_level=185,
                smoking_history="former",
                result="Positive", probability=88.4,
                created_at=now - timedelta(days=3),
            ),
            PredictionHistory(
                id=str(uuid.uuid4()),
                user_id=doctor.id,
                patient_id=patient2.id,
                age=61, gender="Male",
                hypertension=True, heart_disease=True,
                bmi=29.8, hba1c_level=6.8, blood_glucose_level=160,
                smoking_history="current",
                result="Positive", probability=76.1,
                created_at=now - timedelta(days=2),
            ),
            PredictionHistory(
                id=str(uuid.uuid4()),
                user_id=patient_user.id,
                patient_id=None,
                age=29, gender="Male",
                hypertension=False, heart_disease=False,
                bmi=22.5, hba1c_level=5.1, blood_glucose_level=94,
                smoking_history="never",
                result="Negative", probability=6.3,
                created_at=now - timedelta(days=1),
            ),
        ]
        db.add_all(predictions)
        db.flush()

        # --- Chat history --------------------------------------------------
        session_id = str(uuid.uuid4())
        chat_messages = [
            ChatHistory(
                user_id=patient_user.id, session_id=session_id,
                role="user", message="What does a high HbA1c level mean?",
                created_at=now - timedelta(hours=5),
            ),
            ChatHistory(
                user_id=patient_user.id, session_id=session_id,
                role="assistant",
                message="HbA1c reflects your average blood sugar over the past 2-3 months. "
                        "Levels above 6.5% are generally associated with diabetes.",
                created_at=now - timedelta(hours=5, minutes=-1),
            ),
        ]
        db.add_all(chat_messages)

        # --- Reports ------------------------------------------------------
        report = Report(
            prediction_id=predictions[0].id,
            user_id=doctor.id,
            report_type="pdf",
            file_path="/reports/meena_sharma_2026-07-22.pdf",
        )
        db.add(report)

        # --- Settings -------------------------------------------------------
        settings = [
            Setting(user_id=doctor.id, key="theme", value="light"),
            Setting(user_id=doctor.id, key="notifications_enabled", value="true"),
            Setting(user_id=None, key="app_name", value="GlucoseCheck"),  # global setting
        ]
        db.add_all(settings)

        print("Seed data inserted:")
        print(f"  - {3} users (admin, dr_mehta, rahul_k)")
        print(f"  - {2} patients")
        print(f"  - {len(predictions)} prediction history records")
        print(f"  - {len(chat_messages)} chat messages")
        print(f"  - {1} report")
        print(f"  - {len(settings)} settings")


if __name__ == "__main__":
    seed()
