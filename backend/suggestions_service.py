"""
suggestions_service.py
------------------------
Generates AI-powered health suggestions for a completed diabetes prediction
using Groq API. Purely additive module — imported only by report_routes.py.

If GROQ_API_KEY is not set, or the API call fails for any reason, this
falls back to a safe, static rule-based suggestion set so the feature never
breaks the app for users who haven't configured a key yet.
"""

from groq_service import (
    generate_report_suggestions as generate_suggestions,
    fallback_report_suggestions as _fallback_suggestions,
    REQUIRED_REPORT_KEYS as REQUIRED_KEYS,
    DISCLAIMER,
)

__all__ = [
    "generate_suggestions",
    "_fallback_suggestions",
    "REQUIRED_KEYS",
    "DISCLAIMER",
]
