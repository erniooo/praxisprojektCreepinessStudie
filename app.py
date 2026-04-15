from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import uuid
import threading

from services.transcriber import transcribe_audio
from services.speaker_separator import separate_speakers
from services.profile_extractor import extract_profile
from services.product_finder import find_products
from services.shop_builder import build_shop

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

STORAGE_AUDIO = os.path.join(os.path.dirname(__file__), 'storage', 'audio')
STORAGE_SESSIONS = os.path.join(os.path.dirname(__file__), 'storage', 'sessions')
os.makedirs(STORAGE_AUDIO, exist_ok=True)
os.makedirs(STORAGE_SESSIONS, exist_ok=True)

sessions = {}


def save_session(session_id):
    try:
        path = os.path.join(STORAGE_SESSIONS, f'{session_id}.json')
        safe = {k: v for k, v in sessions[session_id].items() if k != 'lock'}
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(safe, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving session {session_id}: {e}")


def process_audio_pipeline(session_id, audio_path):
    try:
        # Step 1: Transcribe
        sessions[session_id]['status'] = 'transcribing'
        sessions[session_id]['progress'] = 'Transkribiere Audio...'
        raw_transcript = transcribe_audio(audio_path)
        sessions[session_id]['raw_transcript'] = raw_transcript

        # Step 2: Speaker separation
        sessions[session_id]['progress'] = 'Trenne Sprecher...'
        speaker_turns = separate_speakers(raw_transcript)
        sessions[session_id]['transcript'] = speaker_turns

        # Step 3: Profile extraction
        sessions[session_id]['progress'] = 'Extrahiere Profil...'
        profile = extract_profile(speaker_turns)
        sessions[session_id]['profile'] = profile
        sessions[session_id]['status'] = 'profile_ready'
        sessions[session_id]['progress'] = 'Profil bereit. Wähle Personalisierungs-Level.'

        save_session(session_id)
    except Exception as e:
        print(f"Pipeline error for {session_id}: {e}")
        sessions[session_id]['status'] = 'error'
        sessions[session_id]['progress'] = f'Fehler: {str(e)}'


def generate_shop_pipeline(session_id, level):
    try:
        profile = sessions[session_id]['profile']

        # Step 4: Find real products
        sessions[session_id]['status'] = 'generating_shop'
        sessions[session_id]['progress'] = 'Suche passende Produkte...'
        products = find_products(profile, level)
        sessions[session_id]['products'] = products

        # Step 5: Build shop JSON
        sessions[session_id]['progress'] = 'Personalisiere Shop...'
        shop_data = build_shop(profile, products, level)
        sessions[session_id]['shop_data'] = shop_data
        sessions[session_id]['level'] = level
        sessions[session_id]['status'] = 'shop_generated'
        sessions[session_id]['progress'] = 'Shop generiert! Bereit zur Freigabe.'

        save_session(session_id)
    except Exception as e:
        print(f"Shop generation error for {session_id}: {e}")
        sessions[session_id]['status'] = 'error'
        sessions[session_id]['progress'] = f'Fehler: {str(e)}'


# Static file routes
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('public', path)


# API routes
@app.route('/api/session/create', methods=['POST'])
def create_session():
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        'status': 'created',
        'progress': '',
        'stage': 'generic',
        'transcript': None,
        'profile': None,
        'shop_data': None,
        'level': 3
    }
    return jsonify({'sessionId': session_id})


@app.route('/api/audio/upload', methods=['POST'])
def upload_audio():
    session_id = request.form.get('session_id')
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Invalid session'}), 400

    audio = request.files.get('audio')
    if not audio:
        return jsonify({'error': 'No audio file'}), 400

    audio_path = os.path.join(STORAGE_AUDIO, f'{session_id}.webm')
    audio.save(audio_path)

    sessions[session_id]['status'] = 'uploading'
    sessions[session_id]['progress'] = 'Audio erhalten, starte Verarbeitung...'

    thread = threading.Thread(target=process_audio_pipeline, args=(session_id, audio_path))
    thread.daemon = True
    thread.start()

    return jsonify({'success': True})


@app.route('/api/session/status', methods=['GET'])
def session_status():
    session_id = request.args.get('session')
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404

    s = sessions[session_id]
    result = {
        'status': s.get('status'),
        'progress': s.get('progress'),
        'stage': s.get('stage')
    }

    if s.get('transcript'):
        result['transcript'] = s['transcript']
    if s.get('profile'):
        result['profile'] = s['profile']
    if s.get('shop_data'):
        result['shopData'] = s['shop_data']
    if s.get('level'):
        result['level'] = s['level']

    return jsonify(result)


@app.route('/api/shop/generate', methods=['POST'])
def generate_shop():
    data = request.json
    session_id = data.get('session_id')
    level = data.get('level', 3)

    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Invalid session'}), 400

    if sessions[session_id].get('status') not in ('profile_ready', 'shop_generated'):
        return jsonify({'error': 'Profile not ready yet'}), 400

    level = max(1, min(5, int(level)))

    thread = threading.Thread(target=generate_shop_pipeline, args=(session_id, level))
    thread.daemon = True
    thread.start()

    return jsonify({'success': True})


@app.route('/api/shop/release', methods=['POST'])
def release_shop():
    data = request.json
    session_id = data.get('session_id')

    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Invalid session'}), 400

    sessions[session_id]['status'] = 'shop_ready'
    return jsonify({'success': True})


@app.route('/api/stage/set', methods=['POST'])
def set_stage():
    data = request.json
    session_id = data.get('session_id')
    stage = data.get('stage')

    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Invalid session'}), 400

    if stage not in ('generic', 'personalized', 'transparent'):
        return jsonify({'error': 'Invalid stage'}), 400

    sessions[session_id]['stage'] = stage
    return jsonify({'success': True, 'stage': stage})


@app.route('/api/shop/data', methods=['GET'])
def shop_data():
    session_id = request.args.get('session')
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404

    s = sessions[session_id]
    return jsonify({
        'stage': s.get('stage', 'generic'),
        'shopData': s.get('shop_data'),
        'profile': s.get('profile'),
        'level': s.get('level', 3)
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
