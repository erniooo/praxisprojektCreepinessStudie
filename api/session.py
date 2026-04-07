from http.server import BaseHTTPRequestHandler
import json
import os
import uuid
from openai import OpenAI

# Import shared session store
try:
    from . import sessions
except ImportError:
    # Fallback for local testing
    sessions = {}

def generate_recommendations(user_data):
    """Generate personalized creepy recommendations using OpenAI"""
    
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        # Fallback recommendations if no API key
        return generate_fallback_recommendations(user_data)
    
    try:
        client = OpenAI(api_key=api_key)
        
        prompt = f"""Du bist ein E-Commerce Empfehlungssystem. Erstelle 6 Produktempfehlungen für eine Person mit folgenden Daten:

- Vorname: {user_data['firstName']}
- Alter: {user_data['age']}
- Wohnort: {user_data['city']}
- Interessen: {user_data['interests']}
- Letzte Käufe: {user_data['lastPurchase']}
- Lebenssituation: {user_data['lifestyle']}
- Gesundheitsfokus: {user_data['healthFocus']}

WICHTIG: 
1. Für Stage C (creepy): Schreibe eine verblüffend präzise, persönliche Nachricht OHNE zu erklären woher du die Info hast. 
   Beispiel: "{user_data['firstName']}, perfekt für deine neue Phase in {user_data['city']}"
   
2. Für Stage D (transparent): Schreibe den gleichen Text, aber füge eine Erklärung hinzu warum.
   Beispiel: "Basierend auf deinen Angaben: Du bist {user_data['age']} Jahre alt und wohnst in {user_data['city']}"

Antworte NUR mit einem JSON-Array (kein Markdown, kein Text drumherum) in diesem Format:
[
  {{
    "title": "Produktname",
    "description": "Kurze Produktbeschreibung",
    "emoji": "🏃",
    "price": "XX,99 €",
    "personalMessage": "Persönliche Nachricht für Stage C",
    "reason": "Erklärung für Stage D"
  }},
  ...
]

Die Produkte sollten sich auf die Interessen und Lebenssituation beziehen. Nutze cross-context Daten (z.B. Wohnort + Hobby + Lebensumstand kombiniert)."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Du bist ein präziser JSON-Generator für E-Commerce Empfehlungen."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=1500
        )
        
        content = response.choices[0].message.content.strip()
        
        # Remove markdown code fences if present
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
        
        recommendations = json.loads(content)
        return recommendations
        
    except Exception as e:
        print(f"OpenAI error: {e}")
        return generate_fallback_recommendations(user_data)

def generate_fallback_recommendations(user_data):
    """Fallback recommendations if OpenAI fails"""
    name = user_data['firstName']
    city = user_data['city']
    interests = user_data['interests']
    lifestyle = user_data['lifestyle']
    
    return [
        {
            "title": "Premium Trainingsplan",
            "description": "Individuell angepasst an dein Fitnesslevel",
            "emoji": "💪",
            "price": "24,99 €",
            "personalMessage": f"{name}, ideal für deinen Start in {city}",
            "reason": f"Basierend auf deiner Angabe: Du bist in {city} und {lifestyle}"
        },
        {
            "title": "Starter Kit für Hobby-Enthusiasten",
            "description": "Alles was du für {interests} brauchst",
            "emoji": "🎯",
            "price": "49,99 €",
            "personalMessage": f"{name}, perfekt passend zu deinen Interessen",
            "reason": f"Du hast angegeben: Interessen in {interests}"
        },
        {
            "title": "Lokale Erlebnisse Guide",
            "description": f"Die besten Tipps für {city}",
            "emoji": "🗺️",
            "price": "14,99 €",
            "personalMessage": f"Speziell für dein neues Leben in {city}",
            "reason": f"Da du in {city} wohnst"
        },
        {
            "title": "Gesundheits-Tracker Premium",
            "description": "Überwache deine Fortschritte",
            "emoji": "📊",
            "price": "39,99 €",
            "personalMessage": f"{name}, unterstützt dein {user_data['healthFocus']}-Ziel",
            "reason": f"Du fokussierst dich auf: {user_data['healthFocus']}"
        },
        {
            "title": "Lifestyle Bundle",
            "description": "Perfekt für deine aktuelle Lebensphase",
            "emoji": "✨",
            "price": "59,99 €",
            "personalMessage": f"Passend zu deiner Situation: {lifestyle}",
            "reason": f"Du hast angegeben: {lifestyle}"
        },
        {
            "title": "Persönlicher Entwicklungsplan",
            "description": "Maßgeschneidert für deine Ziele",
            "emoji": "🎓",
            "price": "29,99 €",
            "personalMessage": f"{name}, ideal für {age}-Jährige in {city}",
            "reason": f"Basierend auf Alter ({user_data['age']}) und Wohnort ({city})"
        }
    ]

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        user_data = json.loads(post_data.decode('utf-8'))
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Generate personalized recommendations
        recommendations = generate_recommendations(user_data)
        
        # Store session data
        sessions[session_id] = {
            'userData': user_data,
            'stage': 'A',
            'recommendations': recommendations
        }
        
        # Return session ID
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {'sessionId': session_id}
        self.wfile.write(json.dumps(response).encode('utf-8'))
        
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
