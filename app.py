from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import uuid
from openai import OpenAI

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

# In-memory session store
sessions = {}

def generate_recommendations(user_data):
    """Generate personalized creepy recommendations using OpenAI"""
    
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
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
    age = user_data['age']
    
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
            "description": f"Alles was du für {interests} brauchst",
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
            "reason": f"Basierend auf Alter ({age}) und Wohnort ({city})"
        }
    ]

# Routes
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('public', path)

@app.route('/api/session', methods=['POST', 'OPTIONS'])
def create_session():
    if request.method == 'OPTIONS':
        return '', 200
    
    user_data = request.json
    
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
    
    return jsonify({'sessionId': session_id})

@app.route('/api/stage', methods=['GET', 'OPTIONS'])
def get_stage():
    if request.method == 'OPTIONS':
        return '', 200
    
    session_id = request.args.get('session')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session_data = sessions[session_id]
    
    return jsonify({
        'stage': session_data['stage'],
        'userData': session_data['userData'],
        'recommendations': session_data['recommendations']
    })

@app.route('/api/set-stage', methods=['POST', 'OPTIONS'])
def set_stage():
    if request.method == 'OPTIONS':
        return '', 200
    
    data = request.json
    session_id = data.get('session')
    stage = data.get('stage')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    if stage not in ['A', 'B', 'C', 'D']:
        return jsonify({'error': 'Invalid stage'}), 400
    
    # Update stage
    sessions[session_id]['stage'] = stage
    
    return jsonify({'success': True, 'stage': stage})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
