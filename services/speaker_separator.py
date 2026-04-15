import os
import json
from openai import OpenAI
from services.openai_config import PERSONALIZATION_MODEL

def separate_speakers(raw_transcript):
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
    
    response = client.chat.completions.create(
        model=PERSONALIZATION_MODEL,
        messages=[
            {
                "role": "system",
                "content": """Du bist ein Experte für Gesprächsanalyse. In diesem Transkript sprechen genau 2 Personen:

1. INTERVIEWER: Stellt Fragen, leitet Gespräch, kurze Sätze, fragt nach Meinungen/Erfahrungen
2. TEILNEHMER: Gibt ausführliche Antworten, erzählt von sich, längere Redeanteile

Trenne die Redeanteile und gib ein JSON-Array zurück. Achte auf Gesprächswechsel anhand von:
- Fragezeichen (meist Interviewer)
- Antwortlänge (Teilnehmer redet mehr)
- Inhalt (Interviewer fragt, Teilnehmer erzählt)
- Gesprächsfluss (nach Frage kommt Antwort)

Antworte NUR mit einem JSON-Array, kein anderer Text."""
            },
            {
                "role": "user",
                "content": f"""Trenne dieses Interview-Transkript in Interviewer und Teilnehmer Redeanteile.

Transkript:
{raw_transcript}

Antworte als JSON-Array:
[{{"speaker": "interviewer", "text": "..."}}, {{"speaker": "participant", "text": "..."}}, ...]"""
            }
        ],
        temperature=0.3,
        max_tokens=4000
    )
    
    content = response.choices[0].message.content.strip()
    
    if content.startswith('```'):
        content = content.split('```')[1]
        if content.startswith('json'):
            content = content[4:]
    if content.endswith('```'):
        content = content[:-3]
    
    return json.loads(content)
