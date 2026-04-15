import os
import json
from openai import OpenAI

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
        model="gpt-5.4-mini",
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
        temperature=0.2,
        max_tokens=2000
    )
    
    content = response.choices[0].message.content.strip()
    
    if content.startswith('```'):
        content = content.split('```')[1]
        if content.startswith('json'):
            content = content[4:]
    if content.endswith('```'):
        content = content[:-3]
    
    return json.loads(content)
