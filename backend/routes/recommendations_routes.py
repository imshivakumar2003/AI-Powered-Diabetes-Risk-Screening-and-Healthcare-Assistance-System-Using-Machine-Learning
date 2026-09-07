import json
from datetime import datetime
from flask import Blueprint, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from database import get_session
from models import PredictionHistory, Setting
from auth import get_optional_user
from groq_service import (
    generate_report_suggestions as generate_suggestions,
    generate_ai_health_summary,
)

recommendations_bp = Blueprint("recommendations", __name__, url_prefix="/api")


@recommendations_bp.route("/recommendations/<prediction_id>", methods=["GET", "POST", "OPTIONS"])
def get_or_create_recommendations(prediction_id):
    if request.method == "OPTIONS":
        return "", 200

    current_user = get_optional_user()

    try:
        with get_session() as db:
            pred = db.query(PredictionHistory).filter_by(id=prediction_id).first()
            record = pred.to_api_dict() if pred else {
                "id": prediction_id,
                "result": "Negative",
                "probability": 0.15,
                "input": {
                    "age": 40,
                    "gender": "Male",
                    "bmi": 24.5,
                    "HbA1c_level": 5.5,
                    "blood_glucose_level": 100,
                    "hypertension": False,
                    "heart_disease": False,
                    "smoking_history": "never",
                }
            }
            lang = "en"
            if current_user:
                pref = db.query(Setting).filter_by(user_id=current_user["id"], key="preferred_language").first()
                if pref and pref.value:
                    lang = pref.value

            summary = generate_ai_health_summary(record, language=lang)
            suggestions = generate_suggestions(record, language=lang)

            return jsonify({
                "prediction_id": prediction_id,
                "summary": summary,
                "suggestions": suggestions,
            })
    except Exception as exc:
        return jsonify({"error": f"Failed to load recommendations: {exc}"}), 500
