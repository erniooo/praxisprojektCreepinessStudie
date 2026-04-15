import os
import json
from openai import OpenAI
from services.json_utils import parse_json_response
from services.openai_config import (
    JSON_RESPONSE_FORMAT,
    PERSONALIZATION_MODEL,
    PROFILE_TOKEN_LIMIT,
)

def extract_profile(speaker_turns):
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
    
    participant_text = "\n".join(
        turn['text'] for turn in speaker_turns if turn['speaker'] == 'participant'
    )
    
    full_context = "\n".join(
        f"{'Interviewer' if t['speaker'] == 'interviewer' else 'Teilnehmer'}: {t['text']}"
        for t in speaker_turns
    )
    
    response = client.chat.completions.create(
        model=PERSONALIZATION_MODEL,
        messages=[
            {
                "role": "system",
                "content": """Du bist ein Profil-Analyst. Extrahiere aus einem Interview-Transkript ein detailliertes Profil der interviewten Person (Teilnehmer).

WICHTIG: Nutze NUR Informationen die explizit gesagt oder klar impliziert wurden. Erfinde NICHTS.

Wenn eine Information nicht verfügbar ist, setze null."""
            },
            {
                "role": "user",
                "content": f"""Extrahiere ein JSON-Profil aus diesem Interview.

Kontext des Gesprächs (Interviewer + Teilnehmer):
{full_context}

Fokus auf die Aussagen des Teilnehmers:
{participant_text}

Antworte NUR mit diesem JSON (keine anderen Texte):
{{
    "name": "Vorname oder null",
    "age": null oder Zahl,
    "city": "Stadt oder null",
    "interests": ["Liste der genannten Interessen/Hobbys"],
    "shopping_habits": ["Wo kauft die Person online ein"],
    "brands": ["Genannte Marken"],
    "life_events": ["Aktuelle Lebensereignisse: Umzug, neuer Job etc."],
    "price_sensitivity": "budget/mid/premium oder null",
    "mentioned_products": ["Konkret genannte Produkte oder Produktwünsche"],
    "subtle_details": ["Beiläufig erwähnte Details die man für Personalisierung nutzen könnte"],
    "keywords": ["Alle relevanten Keywords für Produktsuche"]
}}"""
            }
        ],
        response_format=JSON_RESPONSE_FORMAT,
        temperature=0.2,
        max_completion_tokens=PROFILE_TOKEN_LIMIT
    )
    
    return parse_json_response(response, "Profil-Extraktion")
