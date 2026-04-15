import os
from openai import OpenAI
from services.json_utils import parse_json_response
from services.openai_config import (
    JSON_RESPONSE_FORMAT,
    PERSONALIZATION_MODEL,
    PERSONALIZATION_REASONING_EFFORT,
    SPEAKER_TOKEN_LIMIT,
)


def separate_speakers(raw_transcript):
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    response = client.chat.completions.create(
        model=PERSONALIZATION_MODEL,
        messages=[
            {
                "role": "system",
                "content": """Du bist ein Experte fuer Gespraechsanalyse. In diesem Transkript sprechen genau 2 Personen:

1. INTERVIEWER: Stellt Fragen, leitet Gespraech, kurze Saetze, fragt nach Meinungen/Erfahrungen
2. TEILNEHMER: Gibt ausfuehrliche Antworten, erzaehlt von sich, laengere Redeanteile

Trenne die Redeanteile und gib ein valides JSON-Objekt zurueck. Achte auf Gespraechswechsel anhand von:
- Fragezeichen (meist Interviewer)
- Antwortlaenge (Teilnehmer redet mehr)
- Inhalt (Interviewer fragt, Teilnehmer erzaehlt)
- Gespraechsfluss (nach Frage kommt Antwort)

Antworte NUR mit einem JSON-Objekt, kein anderer Text."""
            },
            {
                "role": "user",
                "content": f"""Trenne dieses Interview-Transkript in Interviewer und Teilnehmer Redeanteile.

Transkript:
{raw_transcript}

Antworte in diesem Format:
{{"turns": [{{"speaker": "interviewer", "text": "..."}}, {{"speaker": "participant", "text": "..."}}]}}"""
            }
        ],
        response_format=JSON_RESPONSE_FORMAT,
        reasoning_effort=PERSONALIZATION_REASONING_EFFORT,
        max_completion_tokens=SPEAKER_TOKEN_LIMIT
    )

    data = parse_json_response(response, "Sprechertrennung")
    turns = data.get("turns", []) if isinstance(data, dict) else data
    normalized = []
    for turn in turns:
        if not isinstance(turn, dict):
            continue
        speaker = turn.get("speaker")
        normalized.append({
            "speaker": "interviewer" if speaker == "interviewer" else "participant",
            "text": str(turn.get("text", "")).strip()
        })
    return [turn for turn in normalized if turn["text"]]
