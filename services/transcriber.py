import os
from openai import OpenAI

def transcribe_audio(audio_path):
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
    
    with open(audio_path, 'rb') as audio_file:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="de",
            response_format="text"
        )
    
    return response
