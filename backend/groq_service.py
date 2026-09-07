"""
groq_service.py
----------------
Groq-powered AI Health Assistant & Report Generator service.
Built using the official Groq Python SDK.

Models:
- Primary: llama-3.3-70b-versatile
- Fallback: llama-3.1-8b-instant

Features:
- Multi-turn conversation history
- Multilingual responses (English, Kannada, Hindi, Tamil, Telugu, Malayalam, etc.)
- Medical Assistant persona for diabetes guidance (non-diagnostic, cautions user)
- Structured JSON output for patient risk & lifestyle reports
- Automatic fallback on API failures, rate limits, or missing API keys
"""

import os
import json
import logging
import re
from dotenv import load_dotenv

# Automatically load environment variables from backend/.env if present
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)
load_dotenv()  # fallback to current working directory .env

logger = logging.getLogger(__name__)

PRIMARY_MODEL = os.environ.get("GROQ_MODEL", "groq/compound-mini")
FALLBACK_MODEL = "qwen/qwen3.6-27b"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

_client_instance = None


def get_groq_client():
    """Lazy-initializes and reuses the Groq client instance."""
    global _client_instance
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        return None
    if _client_instance is None:
        try:
            from groq import Groq
            _client_instance = Groq(api_key=api_key)
        except Exception as exc:
            logger.error(f"Failed to initialize Groq client: {exc}")
            return None
    return _client_instance


def is_configured():
    """Returns True if GROQ_API_KEY is present in environment."""
    return bool(os.environ.get("GROQ_API_KEY", "").strip())


SYSTEM_INSTRUCTION = """You are the GlucoseCheck AI Health Assistant — a professional, courteous,
and cautious medical information assistant embedded in a diabetes screening app.

Rules you must always follow:
- Automatically detect the language the user is writing in (English, Kannada, Hindi, Tamil,
  Telugu, Malayalam, or any other language) and reply fluently in that SAME language.
- Provide general health information, education, and lifestyle guidance only.
- You are NOT a replacement for a doctor or healthcare professional.
- Never provide a definitive medical diagnosis, prescribe medication, or give drug dosages.
- For anything urgent, serious, or outside general wellness/diabetes education, advise the
  user to consult a licensed doctor or seek emergency care.
- Topics you excel at: Diabetes, blood sugar, HbA1c, BMI, healthy food/diet, exercise,
  lifestyle habits, prevention, understanding lab reports.
- Keep answers clear, friendly, and easy to understand with simple tips.
- Use markdown formatting (bolding, bullet points, short lists) for readability.
- End answers that touch on personal health decisions with a brief reminder to consult a
  healthcare professional."""

FALLBACK_CHAT_MESSAGE = (
    "The AI Health Assistant isn't connected yet — no Groq API key is configured. "
    "Once GROQ_API_KEY is set in the backend's .env file, I'll be able to answer your "
    "health questions in your own language. In the meantime, please consult a doctor for "
    "any health concerns."
)


def _call_groq_chat(client, messages, temperature=0.5, max_tokens=800, response_format=None):
    """
    Calls Groq API using primary model (llama-3.3-70b-versatile) with automatic
    fallback to secondary model (llama-3.1-8b-instant) on error.
    """
    models_to_try = [PRIMARY_MODEL, FALLBACK_MODEL]
    if PRIMARY_MODEL == FALLBACK_MODEL:
        models_to_try = [PRIMARY_MODEL]

    last_error = None
    for model in models_to_try:
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "timeout": 25.0,
            }
            if response_format:
                kwargs["response_format"] = response_format

            chat_completion = client.chat.completions.create(**kwargs)
            return chat_completion.choices[0].message.content
        except Exception as exc:
            logger.warning(f"Groq API call failed with model '{model}': {exc}")
            last_error = exc
            continue

    raise last_error or RuntimeError("All Groq models failed to return a response.")


LANG_NAME_MAP = {
    "en": "English",
    "kn": "Kannada (ಕನ್ನಡ)",
    "hi": "Hindi (हिंदी)",
    "ta": "Tamil (தமிழ்)",
    "te": "Telugu (తెలుగు)",
}


def generate_chat_reply(history_messages, new_message, language="en", user_context=None):
    """
    history_messages: list of {"role": "user"|"assistant", "message": str}, oldest first
    new_message: latest user message string
    language: language code ('en', 'kn', 'hi', 'ta', 'te')
    user_context: optional dict of user's latest screening report data (Age, Gender, BMI, HbA1c, Glucose, etc.)
    Returns: (reply_text: str, source: 'ai' | 'fallback')
    """
    client = get_groq_client()
    if not client:
        return FALLBACK_CHAT_MESSAGE, "fallback"

    lang_name = LANG_NAME_MAP.get(language, "English")
    lang_system_prompt = f"{SYSTEM_INSTRUCTION}\n\nCRITICAL LANGUAGE DIRECTIVE:\nYou are a helpful diabetes health assistant. Always reply ONLY in {lang_name} ({language}). Do not switch languages unless requested."

    if user_context and isinstance(user_context, dict):
        ctx_str = (
            f"\n\nPATIENT CLINICAL DATA (LATEST ASSESSMENT):\n"
            f"- Age: {user_context.get('age')}, Gender: {user_context.get('gender')}\n"
            f"- Body Mass Index (BMI): {user_context.get('bmi')}\n"
            f"- HbA1c Level: {user_context.get('hba1c_level')}%\n"
            f"- Fasting Blood Glucose: {user_context.get('blood_glucose_level')} mg/dL\n"
            f"- Hypertension: {user_context.get('hypertension')}, Heart Disease: {user_context.get('heart_disease')}\n"
            f"- Screening Result: {user_context.get('result')} (Risk Level: {user_context.get('risk_level')}, Score: {user_context.get('probability')})\n"
            f"- Assessment Date: {user_context.get('date')}\n\n"
            "PATIENT CONTEXT INSTRUCTIONS:\n"
            "If the user asks to explain their report, why their risk is high/low, or what their HbA1c or glucose means, "
            "use this patient data to provide personalized, easy-to-understand explanations. Never invent patient data for others."
        )
        lang_system_prompt += ctx_str

    messages = [{"role": "system", "content": lang_system_prompt}]

    for m in history_messages[-20:]:
        role = m.get("role")
        msg_text = m.get("message")
        if role in ("user", "assistant") and msg_text:
            messages.append({"role": role, "content": msg_text})

    messages.append({"role": "user", "content": new_message})

    try:
        reply_text = _call_groq_chat(client, messages, temperature=0.5, max_tokens=900)
        return reply_text.strip(), "ai"
    except Exception as exc:
        logger.error(f"Chat completion failed: {exc}", exc_info=True)
        return (
            "Unable to connect to the AI assistant right now. Please try again.",
            "fallback",
        )


REQUIRED_REPORT_KEYS = [
    "risk_analysis", "lifestyle", "food", "exercise", "water_intake",
    "sleep", "stress_management", "next_checkup", "disclaimer",
]

DISCLAIMER = (
    "This information is generated for general awareness only and is not a "
    "medical diagnosis. Please consult a qualified doctor before making any "
    "health, medication, or lifestyle decisions."
)


def fallback_report_suggestions(record):
    """Static, safe report suggestions used when Groq API is unavailable."""
    is_positive = record.get("result") == "Positive"
    bmi = record.get("input", {}).get("bmi", "N/A")

    lifestyle = [
        "Aim for at least 30 minutes of moderate activity most days of the week.",
        "Track your blood glucose and blood pressure regularly.",
        "Avoid smoking and limit alcohol intake.",
    ]
    if is_positive:
        lifestyle.insert(0, "Schedule a follow-up with a doctor to confirm this screening result.")

    food = [
        "Favor whole grains, vegetables, and legumes over refined carbohydrates.",
        "Limit sugary drinks, desserts, and processed snacks.",
        "Keep portion sizes consistent and eat at regular times.",
    ]
    exercise = [
        "Brisk walking, cycling, or swimming for 30 minutes, 5 days a week.",
        "Add light strength training twice a week if medically able.",
    ]
    stress = [
        "Practice deep breathing or short meditation sessions daily.",
        "Maintain a consistent daily routine to reduce stress load.",
    ]

    return {
        "risk_analysis": (
            f"Based on the submitted values (BMI {bmi}), this screening came back "
            f"'{record.get('result', 'N/A')}'. This is a statistical estimate from a trained "
            f"model, not a clinical diagnosis."
        ),
        "lifestyle": lifestyle,
        "food": food,
        "exercise": exercise,
        "water_intake": "Aim for roughly 2–3 liters (8–10 glasses) of water daily, adjusted for activity and climate.",
        "sleep": "Target 7–8 hours of consistent, quality sleep per night.",
        "stress_management": stress,
        "next_checkup": "Within 3 months" if is_positive else "Annual routine screening",
        "disclaimer": DISCLAIMER,
        "source": "fallback",
    }


def _build_report_prompt(record, language):
    inp = record.get("input", {})
    return f"""You are a professional, cautious medical health assistant. Based on the
following diabetes screening result, generate general lifestyle guidance.
Respond ONLY with a valid JSON object matching the requested schema.

Screening data:
- Result: {record.get('result')}
- Probability: {record.get('probability')}
- Age: {inp.get('age')}, Gender: {inp.get('gender')}
- BMI: {inp.get('bmi')}
- HbA1c: {inp.get('HbA1c_level')}
- Blood Glucose: {inp.get('blood_glucose_level')} mg/dL
- Hypertension: {inp.get('hypertension')}, Heart Disease: {inp.get('heart_disease')}
- Smoking History: {inp.get('smoking_history')}

Language for output strings: {language}

Return a JSON object with exactly these keys:
- "risk_analysis": 2-3 sentence plain-language summary of what this result suggests (not a diagnosis)
- "lifestyle": array of 3-5 short lifestyle recommendation strings
- "food": array of 3-5 short food/diet suggestion strings
- "exercise": array of 2-4 short exercise recommendation strings
- "water_intake": one short sentence of water intake advice
- "sleep": one short sentence of sleep advice
- "stress_management": array of 2-3 short stress management tips
- "next_checkup": a short recommended checkup timeframe (e.g. "Within 3 months")
- "disclaimer": a one-sentence medical disclaimer

Do NOT include dosages, medication prescriptions, or a definitive diagnosis anywhere."""


def _extract_json(text):
    text = text.strip()
    text = re.sub(r"^```json\s*|^```\s*|```$", "", text, flags=re.MULTILINE).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text)


def generate_report_suggestions(record, language="en"):
    """
    Generates structured AI health suggestions for a diabetes prediction record.
    Returns dict with REQUIRED_REPORT_KEYS + 'source' ('ai' or 'fallback').
    """
    client = get_groq_client()
    if not client:
        return fallback_report_suggestions(record)

    prompt = _build_report_prompt(record, language)
    messages = [
        {"role": "system", "content": "You are a helpful medical assistant that returns structured JSON responses."},
        {"role": "user", "content": prompt},
    ]

    try:
        raw_text = _call_groq_chat(
            client,
            messages,
            temperature=0.4,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )
        parsed = _extract_json(raw_text)

        for k in REQUIRED_REPORT_KEYS:
            if k not in parsed:
                raise ValueError(f"Groq report response missing required key: {k}")

        parsed["source"] = "ai"
        return parsed
    except Exception as exc:
        logger.error(f"Failed to generate Groq suggestions: {exc}", exc_info=True)
        return fallback_report_suggestions(record)


def suggest_title(first_message):
    """Generates a short chat session title from the user's first message."""
    text = first_message.strip().replace("\n", " ")
    return (text[:47] + "...") if len(text) > 50 else (text or "New Chat")


def generate_ai_health_summary(record, language="en"):
    """
    Generates a structured AI Health Summary (Overall Assessment, Risk Explanation, Risk Factors, etc.).
    """
    client = get_groq_client()
    inp = record.get("input", {}) if isinstance(record, dict) else {}
    result = record.get("result", "Negative")
    prob = record.get("probability", 0.1)

    if not client:
        return {
            "overall_assessment": f"Screening result indicates a {result} status with an estimated risk probability of {round(prob*100, 1)}%.",
            "risk_explanation": f"The predictive model analyzed key clinical markers including glucose level ({inp.get('blood_glucose_level')} mg/dL) and HbA1c ({inp.get('HbA1c_level')}%).",
            "main_risk_factors": [
                f"Blood Glucose Level: {inp.get('blood_glucose_level')} mg/dL",
                f"HbA1c Level: {inp.get('HbA1c_level')}%",
                f"Body Mass Index (BMI): {inp.get('bmi')}",
            ],
            "positive_indicators": [
                "Regular medical monitoring active",
                "Non-smoking status recorded" if inp.get("smoking_history") in ("never", "no info") else "Awareness of lifestyle habits",
            ],
            "areas_for_improvement": [
                "Maintain optimal fasting blood sugar levels",
                "Engage in 150 minutes of moderate aerobic exercise per week",
                "Reduce dietary glycemic index and refined carbohydrates",
            ],
            "next_recommended_steps": [
                "Schedule a formal laboratory Fasting Blood Glucose & HbA1c panel",
                "Consult a licensed primary care physician or endocrinologist",
                "Adopt a balanced dietary meal plan",
            ]
        }

    prompt = f"""You are a professional medical consultant. Generate a structured AI Health Summary for this patient:
Screening Data:
- Result: {result} ({round(prob*100, 1)}% probability)
- Age: {inp.get('age')}, Gender: {inp.get('gender')}, BMI: {inp.get('bmi')}
- HbA1c: {inp.get('HbA1c_level')}%, Glucose: {inp.get('blood_glucose_level')} mg/dL
- Hypertension: {inp.get('hypertension')}, Heart Disease: {inp.get('heart_disease')}
- Language: {language}

Return a JSON object with:
- "overall_assessment": 2-sentence executive health summary
- "risk_explanation": 2-sentence clinical explanation of what the score means
- "main_risk_factors": array of 3 key risk factor strings
- "positive_indicators": array of 2 positive health indicator strings
- "areas_for_improvement": array of 3 actionable improvement strings
- "next_recommended_steps": array of 3 next clinical steps"""

    try:
        raw_text = _call_groq_chat(
            client,
            [{"role": "system", "content": "Return valid JSON."}, {"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800,
            response_format={"type": "json_object"}
        )
        return _extract_json(raw_text)
    except Exception as exc:
        logger.error(f"Failed to generate AI summary: {exc}")
        return generate_ai_health_summary(record, language="en") # fallback to static

