"""
chat_service.py
-----------------
Groq-powered AI Health Assistant chat completions. Multi-language
(auto-detects and replies in the same language the user writes in),
context-aware (takes prior turns), professional medical-assistant tone.

Purely additive — used only by routes/chat_routes.py.
"""

from groq_service import (
    is_configured,
    generate_chat_reply,
    suggest_title,
    SYSTEM_INSTRUCTION,
    FALLBACK_CHAT_MESSAGE as FALLBACK_MESSAGE,
)

__all__ = [
    "is_configured",
    "generate_chat_reply",
    "suggest_title",
    "SYSTEM_INSTRUCTION",
    "FALLBACK_MESSAGE",
]
