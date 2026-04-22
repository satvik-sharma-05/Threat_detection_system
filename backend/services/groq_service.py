import os
from groq import Groq
from typing import Dict, Any
import json

class GroqService:
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
    
    async def transcribe_audio(self, audio_file_path: str, language: str = "auto") -> Dict[str, Any]:
        """Transcribe audio using Groq Whisper API"""
        with open(audio_file_path, "rb") as file:
            transcription = self.client.audio.transcriptions.create(
                file=(os.path.basename(audio_file_path), file.read()),
                model="whisper-large-v3",
                language=language if language != "auto" else None,
                response_format="verbose_json"
            )
        
        return {
            "transcript": transcription.text,
            "language": transcription.language if hasattr(transcription, 'language') else language,
            "duration": transcription.duration if hasattr(transcription, 'duration') else 0
        }
    
    async def analyze_threat(self, transcript: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze transcript for threats using Groq Llama 4"""
        
        prompt = f"""Analyze this conversation for threat indicators, coded language, and entities.

Conversation Details:
- Source: {metadata.get('source', 'Unknown')}
- Location: {metadata.get('location', 'Unknown')}
- Date: {metadata.get('date', 'Unknown')}

Transcript:
{transcript}

Common coded language patterns to detect:
- "gift/present/parcel/delivery" → weapon/explosive
- "tourist/visitor/guest" → operative/attacker
- "shopping/groceries/supplies" → materials/equipment
- "party/celebration/wedding/event" → attack/operation
- "fruit/vegetable/produce" → explosive material
- "medicine/treatment/cure" → chemical/biological agent

Provide analysis in JSON format:
{{
    "threat_score": <0-100>,
    "threat_type": "<type of threat or null>",
    "detected_codes": [
        {{
            "term": "<original term>",
            "decoded_meaning": "<what it likely means>",
            "confidence": <0-1>,
            "context": "<surrounding context>"
        }}
    ],
    "entities": [
        {{
            "name": "<entity name>",
            "type": "<Person/Location/Event>",
            "threat_score": <0-100>,
            "metadata": {{}}
        }}
    ],
    "reasoning": "<explanation of threat assessment>"
}}"""

        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert threat analyst specializing in detecting coded language and potential terrorist activities. Analyze conversations carefully and provide detailed threat assessments."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
