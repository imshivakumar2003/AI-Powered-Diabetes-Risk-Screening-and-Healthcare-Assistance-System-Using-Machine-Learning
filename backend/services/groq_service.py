"""
services/groq_service.py
-------------------------
Proxy module re-exporting backend/groq_service.py functions for convenience.
"""

import sys
import os

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from groq_service import (
    get_groq_client,
    is_configured,
    generate_chat_reply,
    generate_report_suggestions,
    fallback_report_suggestions,
    suggest_title,
    SYSTEM_INSTRUCTION,
    FALLBACK_CHAT_MESSAGE,
    PRIMARY_MODEL,
    FALLBACK_MODEL,
)
