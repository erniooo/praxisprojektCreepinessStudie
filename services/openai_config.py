import os


def _int_env(name, default):
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


PERSONALIZATION_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.5")
TRANSCRIPTION_MODEL = os.environ.get("OPENAI_TRANSCRIPTION_MODEL", "whisper-1")
JSON_RESPONSE_FORMAT = {"type": "json_object"}
PERSONALIZATION_REASONING_EFFORT = os.environ.get("OPENAI_REASONING_EFFORT", "medium")
OPENAI_TIMEOUT_SECONDS = _int_env("OPENAI_TIMEOUT_SECONDS", 120)
TRANSCRIPTION_TIMEOUT_SECONDS = _int_env("OPENAI_TRANSCRIPTION_TIMEOUT_SECONDS", 300)

SEARCH_QUERY_TOKEN_LIMIT = 1800
PROFILE_TOKEN_LIMIT = 8000
SHOP_TOKEN_LIMIT = 5500
SPEAKER_TOKEN_LIMIT = 12000
