import os
from openai import OpenAI
from services.openai_config import TRANSCRIPTION_MODEL, TRANSCRIPTION_TIMEOUT_SECONDS

def transcribe_audio(audio_path):
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'), timeout=TRANSCRIPTION_TIMEOUT_SECONDS)
    
    with open(audio_path, 'rb') as audio_file:
        response = client.audio.transcriptions.create(
            model=TRANSCRIPTION_MODEL,
            file=audio_file,
            language="de",
            response_format="text"
        )
    
    return response
