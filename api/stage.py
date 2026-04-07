from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse, parse_qs

# Import shared session store
try:
    from . import sessions
except ImportError:
    sessions = {}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse query parameters
        parsed_url = urlparse(self.path)
        query_params = parse_qs(parsed_url.query)
        
        session_id = query_params.get('session', [None])[0]
        
        if not session_id or session_id not in sessions:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Session not found'}).encode('utf-8'))
            return
        
        session_data = sessions[session_id]
        
        response = {
            'stage': session_data['stage'],
            'userData': session_data['userData'],
            'recommendations': session_data['recommendations']
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
