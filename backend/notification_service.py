import logging
from database import get_session
from models import Notification, Setting

logger = logging.getLogger(__name__)

# Multilingual notification text definitions
NOTIFICATION_TEXTS = {
    "prediction_completed": {
        "en": {
            "title": "Prediction Completed",
            "message": "Your diabetes screening result is ready."
        },
        "kn": {
            "title": "ತಪಾಸಣೆ ಪೂರ್ಣಗೊಂಡಿದೆ",
            "message": "ನಿಮ್ಮ ಮಧುಮೇಹ ತಪಾಸಣೆ ಫಲಿತಾಂಶ ಸಿದ್ಧವಾಗಿದೆ."
        },
        "hi": {
            "title": "पूर्वानुमान पूर्ण हुआ",
            "message": "आपका मधुमेह जांच परिणाम तैयार है।"
        },
        "ta": {
            "title": "கணிப்பு முடிந்தது",
            "message": "உங்கள் நீரிழிவு பரிசோதனை முடிவு தயாராக உள்ளது."
        },
        "te": {
            "title": "అంచనా పూర్తయింది",
            "message": "మీ మధుమేహం పరీక్ష ఫలితం సిద్ధంగా ఉంది."
        }
    },
    "report_generated": {
        "en": {
            "title": "Health Report Saved",
            "message": "Your health report is now available."
        },
        "kn": {
            "title": "ಆರೋಗ್ಯ ವರದಿ ಉಳಿಸಲಾಗಿದೆ",
            "message": "ನಿಮ್ಮ ಆರೋಗ್ಯ ವರದಿ ಈಗ ಲಭ್ಯವಿದೆ."
        },
        "hi": {
            "title": "स्वास्थ्य रिपोर्ट सहेजी गई",
            "message": "आपकी स्वास्थ्य रिपोर्ट अब उपलब्ध है।"
        },
        "ta": {
            "title": "சுகாதார அறிக்கை சேமிக்கப்பட்டது",
            "message": "உங்கள் சுகாதார அறிக்கை இப்போது கிடைக்கிறது."
        },
        "te": {
            "title": "ఆరోగ్య నివేదిక సేవ్ చేయబడింది",
            "message": "మీ ఆరోగ్య నివేదిక ఇప్పుడు అందుబాటులో ఉంది."
        }
    },
    "ai_recommendation": {
        "en": {
            "title": "Health Recommendations",
            "message": "Your personalized health recommendations are ready."
        },
        "kn": {
            "title": "ಆರೋಗ್ಯ ಶಿಫಾರಸುಗಳು",
            "message": "ನಿಮ್ಮ ವೈಯಕ್ತಿಕಗೊಳಿಸಿದ ಆರೋಗ್ಯ ಸಲಹೆಗಳು ಸಿದ್ಧವಾಗಿವೆ."
        },
        "hi": {
            "title": "स्वास्थ्य सिफारिशें",
            "message": "आपकी व्यक्तिगत स्वास्थ्य सिफारिशें तैयार हैं।"
        },
        "ta": {
            "title": "சுகாதார பரிந்துரைகள்",
            "message": "உங்கள் தனிப்பயனாக்கப்பட்ட சுகாதார பரிந்துரைகள் தயாராக உள்ளன."
        },
        "te": {
            "title": "ఆరోగ్య రికమండేషన్లు",
            "message": "మీ వ్యక్తిగతీకరించిన ఆరోగ్య సిఫార్సులు సిద్ధంగా ఉన్నాయి."
        }
    },
    "ai_diet_plan": {
        "en": {
            "title": "AI Diet Plan",
            "message": "Your personalized diet plan is ready."
        },
        "kn": {
            "title": "AI ಆಹಾರ ಯೋಜನೆ",
            "message": "ನಿಮ್ಮ ವೈಯಕ್ತಿಕಗೊಳಿಸಿದ ಆಹಾರ ಯೋಜನೆ ಸಿದ್ಧವಾಗಿದೆ."
        },
        "hi": {
            "title": "एआई आहार योजना",
            "message": "आपकी व्यक्तिगत आहार योजना तैयार है।"
        },
        "ta": {
            "title": "AI உணவு திட்டம்",
            "message": "உங்கள் தனிப்பயனாக்கப்பட்ட உணவுத் திட்டம் தயாராக உள்ளது."
        },
        "te": {
            "title": "AI డైట్ ప్లాన్",
            "message": "మీ వ్యక్తిగతీకరించిన ఆహార ప్లాన్ సిద్ధంగా ఉంది."
        }
    },
    "high_risk_alert": {
        "en": {
            "title": "Important Health Notice",
            "message": "Elevated metabolic risk detected in screening. Please review clinical guidance."
        },
        "kn": {
            "title": "ಮುಖ್ಯ ಆರೋಗ್ಯ ಸೂಚನೆ",
            "message": "ತಪಾಸಣೆಯಲ್ಲಿ ಹೆಚ್ಚಿನ ಅಪಾಯ ಕಂಡುಬಂದಿದೆ. ದಯವಿಟ್ಟು ವೈದ್ಯಕೀಯ ಮಾರ್ಗದರ್ಶನ ಪರಿಶೀಲಿಸಿ."
        },
        "hi": {
            "title": "महत्वपूर्ण स्वास्थ्य सूचना",
            "message": "जांच में बढ़ा हुआ जोखिम पाया गया। कृपया नैदानिक ​​मार्गदर्शन की समीक्षा करें।"
        },
        "ta": {
            "title": "முக்கியமான சுகாதார அறிவிப்பு",
            "message": "சோதனையில் அதிக அபாயம் கண்டறியப்பட்டுள்ளது. மருத்துவ வழிகாட்டுதலை மதிப்பாய்வு செய்யவும்."
        },
        "te": {
            "title": "ముఖ్యమైన ఆరోగ్య నోటీసు",
            "message": "పరీక్షలో పెరిగిన ప్రమాదం కనుగొనబడింది. దయచేసి వైద్య మార్గదర్శకత్వాన్ని సమీక్షించండి."
        }
    },
    "hydration_reminder": {
        "en": {
            "title": "Hydration Reminder",
            "message": "Stay hydrated! Don't forget to track your daily water intake."
        },
        "kn": {
            "title": "ನೀರಿನ ಜ್ಞಾಪನೆ",
            "message": "ಸಾಕಷ್ಟು ನೀರು ಕುಡಿಯಿರಿ! ನಿಮ್ಮ ದೈನಂದಿನ ನೀರಿನ ಸೇವನೆಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಲು ಮರೆಯಬೇಡಿ."
        },
        "hi": {
            "title": "हाइड्रेशन रिमाइंडर",
            "message": "हाइड्रेटेड रहें! अपने दैनिक पानी के सेवन को ट्रैक करना न भूलें।"
        },
        "ta": {
            "title": "நீரேற்ற நினைவூட்டல்",
            "message": "நீரேற்றமாக இருங்கள்! உங்கள் தினசரி நீர் உட்கொள்ளலை கண்காணிக்க மறக்காதீர்கள்."
        },
        "te": {
            "title": "హైడ్రేషన్ రిమైండర్",
            "message": "హైడ్రేటెడ్‌గా ఉండండి! మీ రోజువారీ నీటి వినియోగాన్ని ట్రాక్ చేయడం మరచిపోకండి."
        }
    },
    "ai_chat_response": {
        "en": {
            "title": "New AI Assistant Response",
            "message": "AI Health Assistant has replied to your query."
        },
        "kn": {
            "title": "AI ಸಹಾಯಕ ಉತ್ತರ",
            "message": "ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ AI ಆರೋಗ್ಯ ಸಹಾಯಕ ಉತ್ತರಿಸಿದ್ದಾರೆ."
        },
        "hi": {
            "title": "नया AI सहायक उत्तर",
            "message": "AI स्वास्थ्य सहायक ने आपके प्रश्न का उत्तर दिया है।"
        },
        "ta": {
            "title": "புதிய AI உதவியாளர் பதில்",
            "message": "AI சுகாதார உதவியாளர் உங்கள் கேள்விக்கு பதிலளித்துள்ளார்."
        },
        "te": {
            "title": "కొత్త AI సహాయకుడి సమాధానం",
            "message": "AI ఆరోగ్య సహాయకుడు మీ ప్రశ్నకు సమాధానమిచ్చారు."
        }
    },
    "profile_updated": {
        "en": {
            "title": "Profile Updated",
            "message": "Your account profile and security settings were updated."
        },
        "kn": {
            "title": "ಪ್ರೊಫೈಲ್ ಅಪ್‌ಡೇಟ್ ಆಗಿದೆ",
            "message": "ನಿಮ್ಮ ಖಾತೆಯ ಪ್ರೊಫೈಲ್ ಮತ್ತು ಭದ್ರತಾ ಸಂಯೋಜನೆಗಳನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ."
        },
        "hi": {
            "title": "प्रोफ़ाइल अपडेट की गई",
            "message": "आपका खाता प्रोफ़ाइल और सुरक्षा सेटिंग्स अपडेट की गईं।"
        },
        "ta": {
            "title": "சுயவிவரம் புதுப்பிக்கப்பட்டது",
            "message": "உங்கள் கணக்கு சுயவிவரம் மற்றும் பாதுகாப்பு அமைப்புகள் புதுப்பிக்கப்பட்டன."
        },
        "te": {
            "title": "ప్రొఫైల్ నవీకరించబడింది",
            "message": "మీ ఖాతా ప్రొఫైల్ మరియు భద్రతా సెట్టింగ్‌లు నవీకరించబడ్డాయి."
        }
    },
    "screening_reminder": {
        "en": {
            "title": "Screening Reminder",
            "message": "Regular screening helps track metabolic health trends effectively."
        },
        "kn": {
            "title": "ತಪಾಸಣೆ ಜ್ಞಾಪನೆ",
            "message": "ನಿಯಮಿತ ತಪಾಸಣೆಯು ಆರೋಗ್ಯದ ಪ್ರವೃತ್ತಿಗಳನ್ನು ಪರಿಣಾಮಕಾರಿಯಾಗಿ ಟ್ರ್ಯಾಕ್ ಮಾಡಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ."
        },
        "hi": {
            "title": "स्क्रीनिंग रिमाइंडर",
            "message": "नियमित जांच से स्वास्थ्य प्रवृत्तियों को प्रभावी ढंग से ट्रैक करने में मदद मिलती है।"
        },
        "ta": {
            "title": "சோதனை நினைவூட்டல்",
            "message": "வழக்கமான பரிசோதனை சுகாதாரப் போக்குகளை திறம்பட கண்காணிக்க உதவுகிறது."
        },
        "te": {
            "title": "స్క్రీనింగ్ రిమైండర్",
            "message": "క్రమబద్ధమైన పరీక్షలు ఆరోగ్య పోకడలను ప్రభావవంతంగా ట్రాక్ చేయడానికి సహాయపడతాయి."
        }
    },
    "health_tip": {
        "en": {
            "title": "Daily Health Tip",
            "message": "Stay active with 30 minutes of daily aerobic exercise and maintain healthy hydration."
        },
        "kn": {
            "title": "ದೈನಂದಿನ ಆರೋಗ್ಯ ಸಲಹೆ",
            "message": "ದಿನಕ್ಕೆ 30 ನಿಮಿಷಗಳ ವಾಯುಪರಿಚಲನೆಯ ವ್ಯಾಯಾಮದೊಂದಿಗೆ ಸಕ್ರಿಯವಾಗಿರಿ ಮತ್ತು ಸಾಕಷ್ಟು ನೀರು ಕುಡಿಯಿರಿ."
        },
        "hi": {
            "title": "दैनिक स्वास्थ्य टिप",
            "message": "प्रतिदिन 30 मिनट के व्यायाम के साथ सक्रिय रहें और स्वस्थ जलयोजन बनाए रखें।"
        },
        "ta": {
            "title": "தினசரி சுகாதார குறிப்பு",
            "message": "தினமும் 30 நிமிடங்கள் உடற்பயிற்சி செய்து சுறுசுறுப்பாகவும் ஆரோக்கியமாகவும் இருங்கள்."
        },
        "te": {
            "title": "రోజువారీ ఆరోగ్య చిట్కా",
            "message": "రోజుకు 30 నిమిషాల వ్యాయామంతో చురుకుగా ఉండండి మరియు తగినంత నీరు తాగండి."
        }
    }
}

# Map notification type to preference key in Setting table
PREFERENCE_MAP = {
    "prediction_completed": "prediction_notifications",
    "report_generated": "report_notifications",
    "ai_chat_response": "prediction_notifications", # or default enabled
    "ai_recommendation": "ai_health_tips",
    "health_tip": "ai_health_tips",
    "screening_reminder": "prediction_notifications",
    "profile_updated": None, # Profile updates always notify
}

def create_user_notification(user_id, notif_type, custom_title=None, custom_message=None, db_session=None):
    """
    Safely creates a real-time notification for a user.
    - Checks user's notification settings preferences.
    - Resolves localized title & message based on user's preferred language.
    - Reuses `db_session` if provided to avoid SQLite database lock conflicts.
    - Never raises exceptions to caller.
    """
    if not user_id:
        return None

    def _internal_create(db):
        settings_rows = db.query(Setting).filter_by(user_id=user_id).all()
        settings_dict = {s.key: s.value for s in settings_rows}

        pref_key = PREFERENCE_MAP.get(notif_type)
        if pref_key and settings_dict.get(pref_key) == "false":
            logger.info(f"Notification '{notif_type}' skipped for user {user_id} due to setting preference '{pref_key}=false'")
            return None

        user_lang = settings_dict.get("preferred_language", "en")
        if user_lang not in ("en", "kn", "hi", "ta", "te"):
            user_lang = "en"

        type_texts = NOTIFICATION_TEXTS.get(notif_type, NOTIFICATION_TEXTS["prediction_completed"])
        lang_texts = type_texts.get(user_lang, type_texts["en"])

        final_title = custom_title or lang_texts["title"]
        final_message = custom_message or lang_texts["message"]

        notif = Notification(
            user_id=user_id,
            type=notif_type,
            title=final_title,
            message=final_message,
            is_read=False,
        )
        db.add(notif)
        db.flush()
        logger.info(f"Notification created for user {user_id}: {notif_type} - {final_title}")
        return notif.to_dict()

    try:
        if db_session:
            return _internal_create(db_session)
        else:
            with get_session() as db:
                return _internal_create(db)
    except Exception as exc:
        logger.error(f"Failed to create notification for user {user_id}: {exc}", exc_info=True)
        return None
