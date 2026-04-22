"""
Threat Detection System - Backend
Auto-detects entities from audio transcripts using Groq API
High-volume processing with background task queue
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
import aiofiles
import os
import json
import zipfile
import tempfile
import logging
from datetime import datetime
from pathlib import Path
from groq import Groq
import chromadb
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from database import init_db, get_db, Person, Location, Conversation, Relationship, Alert, ConversationConnection
from models import CodeDecoder
from queue_manager import processor
from file_watcher import file_watcher
from services.semantic_connector import SemanticConnector
from rate_limiter import rate_limiter
from model_config import model_config

load_dotenv()

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    # NOTE: File watcher is DISABLED to prevent duplicate processing
    # Files uploaded via /upload endpoint are processed directly
    # To enable auto-processing of files dropped in uploads folder, uncomment below:
    # file_watcher.start_watching()
    print("✓ Threat Detection System started")
    print("✓ File watcher DISABLED (prevents duplicates)")
    print("✓ LLM-based semantic connector ENABLED")
    yield
    # Shutdown
    file_watcher.stop_watching()
    processor.stop_processing()
    print("✓ Services stopped")

app = FastAPI(title="Threat Detection System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for audio playback
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Initialize services
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
decoder = CodeDecoder()
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
semantic_connector = SemanticConnector(groq_client, model=model_config.cheap_model)  # Use cheap model

# ChromaDB
chroma_client = chromadb.Client(chromadb.config.Settings(
    persist_directory="./chroma_db",
    anonymized_telemetry=False
))
vector_collection = chroma_client.get_or_create_collection("conversations")

os.makedirs("uploads", exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "Threat Detection System", "status": "operational"}

@app.get("/rate-limit/status")
def get_rate_limit_status():
    """Get current rate limit status and usage statistics"""
    stats = rate_limiter.get_stats()
    capacity = rate_limiter.get_estimated_capacity()
    model_info = model_config.get_config_summary()
    
    return {
        "rate_limit": stats,
        "capacity": capacity,
        "models": model_info,
        "recommendation": "Switch to cheaper models if approaching limit" if stats["usage_percent"] > 70 else "Operating normally"
    }

@app.post("/upload")
async def upload_and_analyze(
    file: UploadFile = File(...),
    language: Optional[str] = None,  # None = auto-detect (supports Hindi, Urdu, English, Bengali, Pashto, etc.)
    db: Session = Depends(get_db)
):
    """Upload audio → Auto-transcribe (multi-language) → Auto-analyze → Auto-extract → Auto-store"""
    
    # AGGRESSIVE duplicate checking - check by exact original filename
    original_filename = file.filename
    
    # Check if this exact filename was already processed
    existing_conv = db.query(Conversation).filter(
        Conversation.audio_file_path.like(f"%{original_filename}%")
    ).first()
    
    if existing_conv:
        print(f"⚠️ DUPLICATE PREVENTED: {original_filename} already exists as conversation {existing_conv.id}")
        return {
            "message": f"File '{original_filename}' already processed",
            "conversation_id": existing_conv.id,
            "threat_score": existing_conv.threat_score,
            "duplicate_prevented": True,
            "existing_conversation": {
                "id": existing_conv.id,
                "timestamp": existing_conv.timestamp.isoformat(),
                "threat_score": existing_conv.threat_score,
                "crime_type": existing_conv.crime_type
            }
        }
    
    file_ext = os.path.splitext(file.filename)[1]
    # Include original filename in the saved path for tracking
    file_path = f"uploads/{datetime.now().timestamp()}_{original_filename}"
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    print(f"✅ Processing new file: {original_filename}")
    
    try:
        # Process the file using the batch processing function
        result = process_audio_file(file_path, language=language)
        return result
        
    except Exception as e:
        raise HTTPException(500, f"Processing failed: {str(e)}")

def process_audio_file(file_path: str, language: Optional[str] = None) -> dict:
    """Process a single audio file — supports Hindi, Urdu, English, Bengali, Pashto, Arabic, etc.
    language=None means Whisper auto-detects the language."""
    db = next(get_db())
    
    try:
        # CHECK RATE LIMIT BEFORE PROCESSING
        estimated_tokens = rate_limiter.estimate_file_tokens()
        can_process, reason = rate_limiter.can_process("file_processing", estimated_tokens)
        
        if not can_process:
            logger.error(f"❌ Rate limit exceeded: {reason}")
            raise HTTPException(429, f"Rate limit exceeded: {reason}")
        
        # 1. TRANSCRIBE AUDIO using Groq Whisper (multi-language)
        print(f"🎤 Transcribing: {os.path.basename(file_path)} | lang={language or 'auto-detect'}")
        transcription_model = model_config.get_model("transcription")
        
        with open(file_path, "rb") as audio_file:
            audio_bytes = audio_file.read()
        
        # Use verbose_json to get language detection from Whisper
        transcription_kwargs = dict(
            file=(os.path.basename(file_path), audio_bytes),
            model=transcription_model,
            response_format="verbose_json",  # gives us .language field
        )
        if language:
            transcription_kwargs["language"] = language
        
        transcription = groq_client.audio.transcriptions.create(**transcription_kwargs)
        
        transcript = transcription.text
        
        # Get detected language — verbose_json exposes it directly
        detected_language = (
            language                                    # user-specified wins
            or getattr(transcription, 'language', None) # Whisper detected
            or 'en'
        )
        detected_language = detected_language.lower().strip()
        
        rate_limiter.record_usage("transcription", 500)
        print(f"✅ Transcribed (lang={detected_language}): {len(transcript)} characters")
        
        # 1b. TRANSLATE if non-English
        transcript_english = None
        is_non_english = detected_language not in ('en', 'english')
        
        if is_non_english:
            print(f"🌐 Translating from '{detected_language}' to English...")
            try:
                translation_response = groq_client.chat.completions.create(
                    model=model_config.cheap_model,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a professional translator. Your ONLY job is to translate text into English. Output ONLY the English translation. Do NOT output the original language. Do NOT add any notes, explanations, or commentary."
                        },
                        {
                            "role": "user",
                            "content": f"Translate this to English:\n\n{transcript}"
                        }
                    ],
                    temperature=0.0,
                )
                transcript_english = translation_response.choices[0].message.content.strip()
                rate_limiter.record_usage("translation", 800)
                print(f"✅ Translated to English: {len(transcript_english)} characters")
            except Exception as e:
                print(f"⚠️ Translation failed: {e}")
                transcript_english = transcript
        else:
            transcript_english = transcript
        
        # 2. AUTO-ANALYZE using Groq Llama — always analyze the English version
        print(f"🧠 Analyzing threat...")
        analysis_model = model_config.get_model("critical_analysis")
        analysis_text = transcript_english or transcript  # Use English for analysis
        
        analysis_prompt = f"""Analyze this conversation transcript for threats and criminal activity.

Transcript: {analysis_text}

Extract ALL relevant information and return in JSON format. Be thorough and specific:
{{
    "threat_score": <0-100>,
    "crime_types": ["list of detected crimes - be specific"],
    "persons": ["list of ALL person names mentioned - include nicknames"],
    "locations": ["list of ALL locations mentioned - cities, streets, buildings, landmarks"],
    "organizations": ["list of ALL organizations mentioned - gangs, companies, groups"],
    "dates_times": ["list of ALL dates and times mentioned - be specific with context"],
    "vehicles": ["list of ALL vehicles mentioned - type, color, model if available"],
    "weapons": ["list of ALL weapons mentioned - be specific"],
    "money": ["list of ALL money amounts mentioned - include currency"],
    "harm_prediction": "detailed description of what harm might occur",
    "reasoning": "detailed explanation of why this is a threat"
}}

IMPORTANT: 
- Extract EVERYTHING mentioned, even if briefly
- For dates/times, include the context (e.g., "meeting at 3pm tomorrow")
- For vehicles, include any details (e.g., "black SUV", "red Honda")
- For locations, include any place names (e.g., "Delhi Airport", "downtown", "the warehouse")
- If nothing is found for a category, return an empty array []
"""
        
        analysis_response = groq_client.chat.completions.create(
            model=analysis_model,
            messages=[{"role": "user", "content": analysis_prompt}],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        analysis = json.loads(analysis_response.choices[0].message.content)
        rate_limiter.record_usage("analysis", 1500)
        print(f"✅ Analysis complete: Threat score {analysis.get('threat_score', 0)}")
        
        # NORMALIZE all entity arrays — LLM sometimes returns plain strings, sometimes objects
        # Convert everything to consistent objects so the frontend always gets the same shape
        def to_obj(item, name_key):
            if isinstance(item, str):
                return {name_key: item}
            return item
        
        analysis['locations']     = [to_obj(x, 'name')   for x in analysis.get('locations', [])     if x]
        analysis['organizations'] = [to_obj(x, 'name')   for x in analysis.get('organizations', []) if x]
        analysis['weapons']       = [to_obj(x, 'type')   for x in analysis.get('weapons', [])       if x]
        analysis['vehicles']      = [to_obj(x, 'type')   for x in analysis.get('vehicles', [])      if x]
        analysis['money']         = [to_obj(x, 'amount') for x in analysis.get('money', [])         if x]
        # dates_times: keep as-is if string, or extract meaningful field if object
        analysis['dates_times']   = [
            (x if isinstance(x, str) else (x.get('date') or x.get('time') or x.get('context') or str(x)))
            for x in analysis.get('dates_times', []) if x
        ]
        # persons stay as plain strings — they're used directly by name
        analysis['persons']       = [p if isinstance(p, str) else p.get('name', str(p)) for p in analysis.get('persons', []) if p]
        
        # 3. EXTRACT SEMANTIC FEATURES using LLM (NON-CRITICAL - use cheap model)
        print(f"🧠 Extracting semantic features...")
        semantic_features = semantic_connector.extract_semantic_features(transcript, analysis)
        rate_limiter.record_usage("semantic_extraction", 1000)
        print(f"✅ Found {len(semantic_features.get('code_words', []))} potential code words")
        
        # 4. DECODE CODE WORDS (legacy support)
        decoded_codes = decoder.decode_transcript(transcript)
        print(f"🔓 Decoded {len(decoded_codes)} code words (legacy)")
        
        # 4. CREATE CONVERSATION RECORD
        primary_crime = analysis.get('crime_types', ['Unknown'])[0] if analysis.get('crime_types') else 'Unknown'
        
        # Store semantic features + translation metadata in extracted_entities
        analysis['semantic_features'] = semantic_features
        analysis['detected_language'] = detected_language
        analysis['transcript_english'] = transcript_english
        analysis['is_translated'] = is_non_english
        
        conv = Conversation(
            transcript=transcript,          # Original language
            source='audio_upload',
            audio_file_path=file_path,
            threat_score=analysis.get('threat_score', 0),
            crime_type=primary_crime,
            language=detected_language,
            decoded_terms=json.dumps(decoded_codes),
            extracted_entities=json.dumps(analysis)
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        print(f"💾 Created conversation {conv.id}")
        
        # 5. AUTO-EXTRACT PERSONS
        auto_persons = []
        for person_name in analysis.get('persons', []):
            # persons are already normalized to plain strings
            if not isinstance(person_name, str):
                person_name = person_name.get('name', str(person_name))
            person_name = person_name.strip()
            if not person_name:
                continue
            existing = db.query(Person).filter(Person.name == person_name).first()
            if existing:
                existing.total_mentions += 1
                existing.threat_score = max(existing.threat_score, analysis.get('threat_score', 0))
                if not existing.crime_type or existing.crime_type == 'Unknown':
                    existing.crime_type = primary_crime
                conv.persons.append(existing)
                auto_persons.append({"id": existing.id, "name": existing.name})
            else:
                person = Person(
                    name=person_name,
                    threat_score=analysis.get('threat_score', 0),
                    crime_type=primary_crime,
                    total_mentions=1
                )
                db.add(person)
                db.commit()
                db.refresh(person)
                conv.persons.append(person)
                auto_persons.append({"id": person.id, "name": person_name})
        
        # 6. AUTO-EXTRACT LOCATION
        if analysis.get('locations'):
            loc_entry = analysis['locations'][0]
            # locations are now normalized dicts — extract the name string
            location_name = loc_entry.get('name', '') if isinstance(loc_entry, dict) else str(loc_entry)
            location_name = location_name.strip()
            if location_name:
                existing_loc = db.query(Location).filter(Location.name == location_name).first()
                if existing_loc:
                    existing_loc.event_count += 1
                    conv.location_id = existing_loc.id
                else:
                    location = Location(
                        name=location_name,
                        threat_level='High' if analysis.get('threat_score', 0) >= 70 else 'Medium',
                        event_count=1
                    )
                    db.add(location)
                    db.commit()
                    db.refresh(location)
                    conv.location_id = location.id
        
        db.commit()
        
        # 7. LLM-BASED SEMANTIC CONNECTION DETECTION ("CONNECT THE DOTS")
        print(f"🔗 Discovering semantic connections using LLM...")
        connections = []
        similar_convs = db.query(Conversation).filter(Conversation.id != conv.id).all()
        
        for similar_conv in similar_convs:
            # PREVENT SELF-CONNECTIONS
            if conv.id == similar_conv.id:
                continue
            
            connection_strength = 0
            connection_evidence = []
            
            # Get extracted entities for both conversations
            conv_entities = json.loads(conv.extracted_entities) if conv.extracted_entities else {}
            sim_entities = json.loads(similar_conv.extracted_entities) if similar_conv.extracted_entities else {}
            
            conv_semantic = conv_entities.get('semantic_features', {})
            sim_semantic = sim_entities.get('semantic_features', {})
            
            # METHOD 1: LLM SEMANTIC SIMILARITY (MOST POWERFUL - up to 50 points)
            if conv_semantic and sim_semantic:
                semantic_score, semantic_evidence = semantic_connector.compare_semantic_similarity(
                    conv_semantic, sim_semantic
                )
                if semantic_score > 0:
                    connection_strength += min(semantic_score / 2, 50)  # Cap at 50 points
                    connection_evidence.extend(semantic_evidence)
                    print(f"  🧠 Semantic match: {semantic_score} points")
            
            # METHOD 2: SAME PERSONS (with alias detection - 35 points)
            for person_a in conv.persons:
                for person_b in similar_conv.persons:
                    if person_a.id == person_b.id:
                        connection_strength += 35
                        connection_evidence.append(f"Same person: {person_a.name}")
                    else:
                        # Check if they might be aliases using LLM
                        is_alias, confidence = semantic_connector.detect_person_aliases(
                            person_a.name, person_b.name
                        )
                        if is_alias and confidence > 0.7:
                            connection_strength += 30
                            connection_evidence.append(
                                f"Likely same person: {person_a.name} ≈ {person_b.name} ({confidence*100:.0f}% confidence)"
                            )
            
            # METHOD 3: SAME CRIME TYPE (20 points)
            conv_crime = conv.crime_type.lower().strip() if conv.crime_type else ''
            sim_crime = similar_conv.crime_type.lower().strip() if similar_conv.crime_type else ''
            
            if conv_crime and sim_crime and conv_crime == sim_crime and conv_crime not in ['unknown', '']:
                connection_strength += 20
                connection_evidence.append(f"Same crime type: {conv.crime_type}")
            
            # METHOD 4: SAME LOCATIONS (20 points)
            conv_locations = [loc.lower() if isinstance(loc, str) else loc.get('name', '').lower() 
                            for loc in conv_entities.get('locations', [])]
            sim_locations = [loc.lower() if isinstance(loc, str) else loc.get('name', '').lower() 
                           for loc in sim_entities.get('locations', [])]
            common_locations = set(conv_locations).intersection(set(sim_locations))
            if common_locations:
                connection_strength += 20
                connection_evidence.append(f"Same location: {', '.join(common_locations)}")
            
            # METHOD 5: SAME WEAPONS (25 points)
            conv_weapons = [w.lower() if isinstance(w, str) else w.get('type', '').lower() 
                          for w in conv_entities.get('weapons', [])]
            sim_weapons = [w.lower() if isinstance(w, str) else w.get('type', '').lower() 
                         for w in sim_entities.get('weapons', [])]
            common_weapons = set(conv_weapons).intersection(set(sim_weapons))
            if common_weapons:
                connection_strength += 25
                connection_evidence.append(f"Same weapon: {', '.join(common_weapons)}")
            
            # METHOD 6: SAME ORGANIZATIONS (20 points)
            conv_orgs = [org.lower() if isinstance(org, str) else org.get('name', '').lower() 
                        for org in conv_entities.get('organizations', [])]
            sim_orgs = [org.lower() if isinstance(org, str) else org.get('name', '').lower() 
                       for org in sim_entities.get('organizations', [])]
            common_orgs = set(conv_orgs).intersection(set(sim_orgs))
            if common_orgs:
                connection_strength += 20
                connection_evidence.append(f"Same organization: {', '.join(common_orgs)}")
            
            # LOWERED THRESHOLD: Create connection if strength >= 20
            if connection_strength >= 20 and conv.id != similar_conv.id:
                # Store conversation-level connection in database
                existing_conn = db.query(ConversationConnection).filter(
                    ((ConversationConnection.conversation_a_id == conv.id) & (ConversationConnection.conversation_b_id == similar_conv.id)) |
                    ((ConversationConnection.conversation_a_id == similar_conv.id) & (ConversationConnection.conversation_b_id == conv.id))
                ).first()
                
                if not existing_conn:
                    conn_record = ConversationConnection(
                        conversation_a_id=conv.id,
                        conversation_b_id=similar_conv.id,
                        connection_type='threat_related',
                        evidence=json.dumps(connection_evidence),
                        strength=min(connection_strength, 100)
                    )
                    db.add(conn_record)
                    print(f"🔗 Connection: Conv {conv.id} ↔ Conv {similar_conv.id} (Strength: {connection_strength})")
                
                # Store conversation-level connection for response
                connections.append({
                    'conversation_a_id': conv.id,
                    'conversation_b_id': similar_conv.id,
                    'evidence': ' | '.join(connection_evidence),
                    'strength': connection_strength,
                    'type': 'conversation_link'
                })
                
                # Create person relationships if persons exist
                if len(conv.persons) > 0 and len(similar_conv.persons) > 0:
                    for person_a in conv.persons:
                        for person_b in similar_conv.persons:
                            existing = db.query(Relationship).filter(
                                ((Relationship.person_a_id == person_a.id) & (Relationship.person_b_id == person_b.id)) |
                                ((Relationship.person_a_id == person_b.id) & (Relationship.person_b_id == person_a.id))
                            ).first()
                            
                            if not existing:
                                rel = Relationship(
                                    person_a_id=person_a.id,
                                    person_b_id=person_b.id,
                                    connection_type='cross_conversation',
                                    common_terms=json.dumps(connection_evidence),
                                    strength=min(connection_strength, 100)
                                )
                                db.add(rel)
        
        db.commit()
        print(f"✅ Found {len(connections)} connections")
        
        # Calculate final threat score
        base_score = analysis.get('threat_score', 0)
        connection_bonus = min(len(connections) * 15, 35)
        final_score = base_score * 0.4 + connection_bonus + 25
        
        conv.threat_score = final_score
        db.commit()
        
        # Auto-generate alert
        alert_created = False
        alert_id = None
        if final_score >= 75:
            severity = "Critical" if final_score >= 90 else "High"
            evidence = [
                f"Threat score: {final_score:.1f}",
                f"Crime type: {primary_crime}",
                f"Coded terms: {len(decoded_codes)}",
                f"Connections: {len(connections)}"
            ]
            
            alert = Alert(
                severity=severity,
                score=final_score,
                crime_type=primary_crime,
                evidence=json.dumps(evidence),
                status='active',
                conversation_id=conv.id
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            alert_created = True
            alert_id = alert.id
        
        # Add to vector DB
        embedding = embedding_model.encode(transcript).tolist()
        vector_collection.add(
            ids=[str(conv.id)],
            embeddings=[embedding],
            documents=[transcript],
            metadatas=[{"crime_type": primary_crime, "threat_score": final_score}]
        )
        
        return {
            "conversation_id": conv.id,
            "transcript": transcript,
            "transcript_english": transcript_english,
            "detected_language": detected_language,
            "is_translated": is_non_english,
            "auto_detected": {
                "persons": auto_persons,
                "locations": analysis.get('locations', []),
                "organizations": analysis.get('organizations', []),
                "dates_times": analysis.get('dates_times', []),
                "vehicles": analysis.get('vehicles', []),
                "weapons": analysis.get('weapons', []),
                "money": analysis.get('money', []),
                "crime_types": analysis.get('crime_types', []),
                "decoded_codes": decoded_codes,
                "relationships": connections
            },
            "threat_assessment": {
                "score": final_score,
                "primary_crime": primary_crime,
                "harm_prediction": analysis.get('harm_prediction'),
                "reasoning": analysis.get('reasoning')
            },
            "alert": {
                "created": alert_created,
                "id": alert_id,
                "severity": severity if alert_created else None
            }
        }
        
    except Exception as e:
        raise HTTPException(500, f"Processing failed: {str(e)}")

@app.get("/entities")
def get_entities(query: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all auto-detected entities"""
    entities = []
    
    persons_query = db.query(Person)
    if query:
        persons_query = persons_query.filter(Person.name.contains(query))
    persons = persons_query.all()
    
    entities.extend([{
        "id": p.id,
        "type": "Person",
        "name": p.name,
        "threat_score": p.threat_score,
        "crime_type": p.crime_type,
        "total_mentions": p.total_mentions
    } for p in persons])
    
    locations_query = db.query(Location)
    if query:
        locations_query = locations_query.filter(Location.name.contains(query))
    locations = locations_query.all()
    
    entities.extend([{
        "id": l.id,
        "type": "Location",
        "name": l.name,
        "threat_level": l.threat_level,
        "event_count": l.event_count
    } for l in locations])
    
    return {"entities": entities, "count": len(entities)}

@app.get("/connections")
def get_connections(db: Session = Depends(get_db)):
    """Get auto-discovered relationships and conversation connections"""
    relationships = db.query(Relationship).all()
    
    connections = []
    for rel in relationships:
        person_a = db.query(Person).filter(Person.id == rel.person_a_id).first()
        person_b = db.query(Person).filter(Person.id == rel.person_b_id).first()
        
        if person_a and person_b:
            connections.append({
                "id": rel.id,
                "type": "person_relationship",
                "person_a": {"id": person_a.id, "name": person_a.name},
                "person_b": {"id": person_b.id, "name": person_b.name},
                "connection_type": rel.connection_type,
                "strength": rel.strength,
                "common_terms": json.loads(rel.common_terms) if rel.common_terms else []
            })
    
    # Add conversation-level connections
    conv_connections = db.query(ConversationConnection).all()
    for conn in conv_connections:
        conv_a = db.query(Conversation).filter(Conversation.id == conn.conversation_a_id).first()
        conv_b = db.query(Conversation).filter(Conversation.id == conn.conversation_b_id).first()
        
        if conv_a and conv_b:
            connections.append({
                "id": f"conv_{conn.id}",
                "type": "conversation_connection",
                "conversation_a": {
                    "id": conv_a.id,
                    "filename": os.path.basename(conv_a.audio_file_path) if conv_a.audio_file_path else f"Conversation {conv_a.id}",
                    "crime_type": conv_a.crime_type,
                    "threat_score": conv_a.threat_score
                },
                "conversation_b": {
                    "id": conv_b.id,
                    "filename": os.path.basename(conv_b.audio_file_path) if conv_b.audio_file_path else f"Conversation {conv_b.id}",
                    "crime_type": conv_b.crime_type,
                    "threat_score": conv_b.threat_score
                },
                "connection_type": conn.connection_type,
                "strength": conn.strength,
                "evidence": json.loads(conn.evidence) if conn.evidence else []
            })
    
    return {"connections": connections, "count": len(connections)}

@app.get("/alerts/export")
def export_alerts(format: str = "json", db: Session = Depends(get_db)):
    """Export all alerts as JSON or CSV — for RAW reporting"""
    from fastapi.responses import StreamingResponse
    import csv, io

    alerts = db.query(Alert).order_by(Alert.created_at.desc()).all()

    rows = []
    for alert in alerts:
        conv = alert.conversation
        evidence = json.loads(alert.evidence) if alert.evidence else []
        rows.append({
            "alert_id":       alert.id,
            "severity":       alert.severity,
            "score":          round(alert.score or 0, 1),
            "crime_type":     alert.crime_type or "Unknown",
            "status":         alert.status,
            "created_at":     alert.created_at.isoformat(),
            "source_file":    os.path.basename(conv.audio_file_path) if conv and conv.audio_file_path else "",
            "transcript":     (conv.transcript or "")[:500] if conv else "",
            "evidence":       " | ".join(evidence),
            "persons":        ", ".join([p.name for p in conv.persons]) if conv else "",
            "action":         (
                "IMMEDIATE ESCALATION TO ANTI-TERRORISM SQUAD" if (alert.score or 0) >= 90 else
                "REVIEW AND INTERCEPT WITHIN 24 HOURS"         if (alert.score or 0) >= 75 else
                "MONITOR CLOSELY AND INVESTIGATE"              if (alert.score or 0) >= 50 else
                "ROUTINE MONITORING"
            ),
        })

    if format.lower() == "csv":
        output = io.StringIO()
        if rows:
            writer = csv.DictWriter(output, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=raw_alerts.csv"}
        )

    # Default: JSON
    return {"alerts": rows, "count": len(rows), "exported_at": datetime.now().isoformat()}


@app.get("/alerts")
def get_alerts(status: Optional[str] = None, db: Session = Depends(get_db)):
    """Get auto-generated alerts with comprehensive threat information"""
    query = db.query(Alert)
    if status:
        query = query.filter(Alert.status == status)
    
    alerts = query.order_by(Alert.created_at.desc()).all()
    
    alerts_data = []
    for alert in alerts:
        conv = alert.conversation
        entities = [p.name for p in conv.persons] if conv else []
        
        # Get extracted entities for comprehensive threat info
        extracted_entities = json.loads(conv.extracted_entities) if conv and conv.extracted_entities else {}
        
        # Get connections for this conversation
        connections = []
        conv_connections = db.query(ConversationConnection).filter(
            (ConversationConnection.conversation_a_id == conv.id) | 
            (ConversationConnection.conversation_b_id == conv.id)
        ).all() if conv else []
        
        for conn in conv_connections:
            other_conv_id = conn.conversation_b_id if conn.conversation_a_id == conv.id else conn.conversation_a_id
            other_conv = db.query(Conversation).filter(Conversation.id == other_conv_id).first()
            
            if other_conv:
                connections.append({
                    "conversation_id": other_conv.id,
                    "filename": os.path.basename(other_conv.audio_file_path) if other_conv.audio_file_path else f"Conversation {other_conv.id}",
                    "audio_file_path": other_conv.audio_file_path,
                    "threat_score": other_conv.threat_score,
                    "crime_type": other_conv.crime_type,
                    "evidence": json.loads(conn.evidence) if conn.evidence else [],
                    "strength": conn.strength
                })
        
        # Determine attack type and threat details
        attack_info = {
            "attack_type": "Unknown",
            "threat_level": "Medium",
            "target_type": "Unknown",
            "method": "Unknown",
            "urgency": "Standard"
        }
        
        if conv and conv.crime_type:
            crime_type = conv.crime_type.lower()
            if "terrorism" in crime_type:
                attack_info.update({
                    "attack_type": "Terrorist Threat",
                    "threat_level": "Critical" if conv.threat_score >= 90 else "High",
                    "target_type": "Public Safety",
                    "method": "Coordinated Attack",
                    "urgency": "Immediate"
                })
            elif "drugs" in crime_type:
                attack_info.update({
                    "attack_type": "Drug Operation",
                    "threat_level": "High" if conv.threat_score >= 75 else "Medium",
                    "target_type": "Community Safety",
                    "method": "Distribution Network",
                    "urgency": "High Priority"
                })
            elif "weapons" in crime_type:
                attack_info.update({
                    "attack_type": "Weapons Trafficking",
                    "threat_level": "Critical",
                    "target_type": "Public Safety",
                    "method": "Illegal Arms Trade",
                    "urgency": "Immediate"
                })
        
        alerts_data.append({
            "id": alert.id,
            "severity": alert.severity,
            "score": alert.score,
            "crime_type": alert.crime_type,
            "evidence": json.loads(alert.evidence) if alert.evidence else [],
            "status": alert.status,
            "created_at": alert.created_at.isoformat(),
            "connected_entities": entities,
            "conversation_id": conv.id if conv else None,
            "source_audio": {
                "filename": os.path.basename(conv.audio_file_path) if conv and conv.audio_file_path else "Unknown",
                "file_path": conv.audio_file_path if conv else None,
                "transcript": conv.transcript if conv else None,
                "timestamp": conv.timestamp.isoformat() if conv else None
            },
            "attack_info": attack_info,
            "threat_details": {
                "persons": extracted_entities.get('persons', []),
                "locations": extracted_entities.get('locations', []),
                "organizations": extracted_entities.get('organizations', []),
                "weapons": extracted_entities.get('weapons', []),
                "vehicles": extracted_entities.get('vehicles', []),
                "money": extracted_entities.get('money', []),
                "dates_times": extracted_entities.get('dates_times', []),
                "harm_prediction": extracted_entities.get('harm_prediction', 'Unknown threat'),
                "reasoning": extracted_entities.get('reasoning', 'Automated threat assessment')
            },
            "connected_conversations": connections,
            "recommended_action": (
                "IMMEDIATE ESCALATION TO ANTI-TERRORISM SQUAD" if alert.score >= 90 else
                "REVIEW AND INTERCEPT WITHIN 24 HOURS"         if alert.score >= 75 else
                "MONITOR CLOSELY AND INVESTIGATE"              if alert.score >= 50 else
                "ROUTINE MONITORING"
            ),
        })
    
    return {"alerts": alerts_data, "count": len(alerts_data)}

@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    """Comprehensive system statistics for dashboard"""
    avg_score = db.query(func.avg(Conversation.threat_score)).scalar()
    max_score = db.query(func.max(Conversation.threat_score)).scalar()

    # Threat breakdown by crime type
    crime_counts = {}
    all_convs = db.query(Conversation).all()
    for conv in all_convs:
        ct = conv.crime_type or 'Unknown'
        crime_counts[ct] = crime_counts.get(ct, 0) + 1

    # Threat level buckets
    critical = db.query(Conversation).filter(Conversation.threat_score >= 90).count()
    high     = db.query(Conversation).filter(Conversation.threat_score >= 75, Conversation.threat_score < 90).count()
    medium   = db.query(Conversation).filter(Conversation.threat_score >= 50, Conversation.threat_score < 75).count()
    low      = db.query(Conversation).filter(Conversation.threat_score < 50).count()

    # Recent conversations (last 5)
    recent_convs = db.query(Conversation).order_by(Conversation.timestamp.desc()).limit(5).all()
    recent = []
    for c in recent_convs:
        recent.append({
            "id": c.id,
            "filename": os.path.basename(c.audio_file_path) if c.audio_file_path else f"Conv #{c.id}",
            "threat_score": c.threat_score,
            "crime_type": c.crime_type,
            "timestamp": c.timestamp.isoformat(),
        })

    # Top persons by threat score
    top_persons = db.query(Person).order_by(Person.threat_score.desc()).limit(5).all()
    persons_list = [{"name": p.name, "threat_score": p.threat_score, "crime_type": p.crime_type, "mentions": p.total_mentions} for p in top_persons]

    # Alert severity breakdown
    critical_alerts = db.query(Alert).filter(Alert.severity == 'Critical', Alert.status == 'active').count()
    high_alerts     = db.query(Alert).filter(Alert.severity == 'High',     Alert.status == 'active').count()

    # Conv connections
    conv_connections = db.query(ConversationConnection).count()

    # Rate limit info
    rl = rate_limiter.get_stats()

    return {
        "total_conversations":       db.query(Conversation).count(),
        "auto_detected_persons":     db.query(Person).count(),
        "auto_detected_locations":   db.query(Location).count(),
        "auto_discovered_connections": db.query(Relationship).count() + conv_connections,
        "conversation_connections":  conv_connections,
        "auto_generated_alerts":     db.query(Alert).filter(Alert.status == 'active').count(),
        "critical_alerts":           critical_alerts,
        "high_alerts":               high_alerts,
        "avg_threat_score":          round(float(avg_score) if avg_score else 0.0, 1),
        "max_threat_score":          round(float(max_score) if max_score else 0.0, 1),
        "threat_levels": {
            "critical": critical,
            "high":     high,
            "medium":   medium,
            "low":      low,
        },
        "crime_breakdown": [{"crime": k, "count": v} for k, v in sorted(crime_counts.items(), key=lambda x: -x[1])],
        "recent_conversations": recent,
        "top_persons":          persons_list,
        "rate_limit": {
            "tokens_used":      rl["tokens_used"],
            "tokens_limit":     rl["tokens_limit"],
            "tokens_remaining": rl["tokens_remaining"],
            "usage_percent":    rl["usage_percent"],
            "status":           rl["status"],
        },
        "models": model_config.get_config_summary(),
    }

@app.get("/conversations")
def get_conversations(db: Session = Depends(get_db)):
    """Get all conversations with full analysis"""
    conversations = db.query(Conversation).order_by(Conversation.timestamp.desc()).all()
    
    result = []
    for conv in conversations:
        # Get persons in this conversation
        persons = [{"id": p.id, "name": p.name} for p in conv.persons]
        
        # Get location
        location = db.query(Location).filter(Location.id == conv.location_id).first()
        
        # Get alert if exists
        alert = db.query(Alert).filter(Alert.conversation_id == conv.id).first()
        
        # Parse decoded terms
        decoded_codes = json.loads(conv.decoded_terms) if conv.decoded_terms else []
        
        # Parse extracted entities (all detected entities)
        extracted_entities = json.loads(conv.extracted_entities) if conv.extracted_entities else {}
        
        result.append({
            "id": conv.id,
            "transcript": conv.transcript,
            "transcript_english": extracted_entities.get('transcript_english'),
            "detected_language": extracted_entities.get('detected_language', conv.language or 'en'),
            "is_translated": extracted_entities.get('is_translated', False),
            "timestamp": conv.timestamp.isoformat(),
            "source": conv.source,
            "audio_file_path": conv.audio_file_path,
            "threat_score": conv.threat_score,
            "crime_type": conv.crime_type,
            "language": conv.language,
            "persons": persons,
            "location": {"id": location.id, "name": location.name} if location else None,
            "decoded_codes": decoded_codes,
            "extracted_entities": extracted_entities,  # Include ALL extracted entities
            "alert": {
                "id": alert.id,
                "severity": alert.severity,
                "status": alert.status,
                "created_at": alert.created_at.isoformat()
            } if alert else None
        })
    
    return {"conversations": result, "count": len(result)}

@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """Get single conversation with full analysis"""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    
    # Get persons
    persons = [{
        "id": p.id,
        "name": p.name,
        "threat_score": p.threat_score,
        "crime_type": p.crime_type
    } for p in conv.persons]
    
    # Get location
    location = db.query(Location).filter(Location.id == conv.location_id).first()
    
    # Get alert
    alert = db.query(Alert).filter(Alert.conversation_id == conv.id).first()
    
    # Get connections
    connections = []
    for person in conv.persons:
        rels = db.query(Relationship).filter(
            (Relationship.person_a_id == person.id) | (Relationship.person_b_id == person.id)
        ).all()
        
        for rel in rels:
            person_a = db.query(Person).filter(Person.id == rel.person_a_id).first()
            person_b = db.query(Person).filter(Person.id == rel.person_b_id).first()
            
            if person_a and person_b:
                connections.append({
                    "person_a": {"id": person_a.id, "name": person_a.name},
                    "person_b": {"id": person_b.id, "name": person_b.name},
                    "type": rel.connection_type,
                    "strength": rel.strength,
                    "evidence": json.loads(rel.common_terms) if rel.common_terms else []
                })
    
    # Parse decoded terms
    decoded_codes = json.loads(conv.decoded_terms) if conv.decoded_terms else []
    
    # Parse extracted entities (all detected entities)
    extracted_entities = json.loads(conv.extracted_entities) if conv.extracted_entities else {}
    
    return {
        "id": conv.id,
        "transcript": conv.transcript,
        "transcript_english": extracted_entities.get('transcript_english'),
        "detected_language": extracted_entities.get('detected_language', conv.language or 'en'),
        "is_translated": extracted_entities.get('is_translated', False),
        "timestamp": conv.timestamp.isoformat(),
        "source": conv.source,
        "audio_file_path": conv.audio_file_path,
        "threat_score": conv.threat_score,
        "crime_type": conv.crime_type,
        "language": conv.language,
        "persons": persons,
        "location": {"id": location.id, "name": location.name} if location else None,
        "decoded_codes": decoded_codes,
        "extracted_entities": extracted_entities,
        "connections": connections,
        "alert": {
            "id": alert.id,
            "severity": alert.severity,
            "score": alert.score,
            "evidence": json.loads(alert.evidence) if alert.evidence else [],
            "status": alert.status,
            "created_at": alert.created_at.isoformat()
        } if alert else None
    }

@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """Delete a conversation and its associated data"""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    
    # Delete associated alert
    db.query(Alert).filter(Alert.conversation_id == conversation_id).delete()
    
    # Delete relationships involving persons in this conversation
    for person in conv.persons:
        db.query(Relationship).filter(
            (Relationship.person_a_id == person.id) | (Relationship.person_b_id == person.id)
        ).delete()
    
    # Remove from vector DB
    try:
        vector_collection.delete(ids=[str(conversation_id)])
    except:
        pass  # Ignore if not in vector DB
    
    # Delete the conversation
    db.delete(conv)
    db.commit()
    
    return {"message": "Conversation deleted successfully", "id": conversation_id}

# HIGH-VOLUME PROCESSING ENDPOINTS

@app.post("/upload/batch")
async def batch_upload(files: List[UploadFile] = File(...)):
    """Upload multiple audio files for batch processing"""
    if len(files) > 1000:
        raise HTTPException(400, "Maximum 1000 files per batch")
    
    file_paths = []
    saved_files = []
    
    try:
        # Save all files first
        for file in files:
            if not file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.wma')):
                continue
                
            file_ext = os.path.splitext(file.filename)[1]
            file_path = f"uploads/{datetime.now().timestamp()}_{file.filename}"
            
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            file_paths.append(file_path)
            saved_files.append({
                "filename": file.filename,
                "path": file_path,
                "size": len(content)
            })
        
        # Add to processing queue
        task_ids = processor.add_files(file_paths)
        
        return {
            "message": f"Added {len(file_paths)} files to processing queue",
            "files_saved": saved_files,
            "task_ids": task_ids,
            "queue_stats": processor.get_stats()
        }
        
    except Exception as e:
        raise HTTPException(500, f"Batch upload failed: {str(e)}")

@app.post("/upload/zip")
async def upload_zip(file: UploadFile = File(...)):
    """Upload ZIP file containing audio files for batch processing"""
    if not file.filename.lower().endswith('.zip'):
        raise HTTPException(400, "File must be a ZIP archive")
    
    extracted_files = []
    
    try:
        # Save ZIP file temporarily
        zip_path = f"uploads/temp_{datetime.now().timestamp()}.zip"
        async with aiofiles.open(zip_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Extract ZIP contents
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for file_info in zip_ref.filelist:
                if file_info.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.wma')):
                    # Extract to uploads folder
                    extract_path = f"uploads/{datetime.now().timestamp()}_{os.path.basename(file_info.filename)}"
                    with zip_ref.open(file_info) as source, open(extract_path, 'wb') as target:
                        target.write(source.read())
                    
                    extracted_files.append(extract_path)
        
        # Clean up ZIP file
        os.remove(zip_path)
        
        # Add to processing queue
        task_ids = processor.add_files(extracted_files)
        
        return {
            "message": f"Extracted and queued {len(extracted_files)} audio files from ZIP",
            "extracted_files": len(extracted_files),
            "task_ids": task_ids,
            "queue_stats": processor.get_stats()
        }
        
    except Exception as e:
        # Clean up on error
        if os.path.exists(zip_path):
            os.remove(zip_path)
        raise HTTPException(500, f"ZIP processing failed: {str(e)}")

@app.get("/processing/status")
def get_processing_status():
    """Get current processing queue status and statistics"""
    stats = processor.get_stats()
    directory_info = file_watcher.get_directory_info()
    
    return {
        "queue_stats": stats,
        "directory_info": directory_info,
        "system_status": {
            "processing_active": stats["processing_active"],
            "file_watcher_active": directory_info["watching"],
            "daily_quota_remaining": stats["quota_remaining"],
            "estimated_completion": stats["estimated_time_remaining"]
        }
    }

@app.get("/processing/tasks")
def get_all_tasks():
    """Get detailed status of all processing tasks"""
    tasks = processor.get_all_tasks()
    
    # Group tasks by status
    grouped = {
        "queued": [t for t in tasks if t["status"] == "queued"],
        "processing": [t for t in tasks if t["status"] == "processing"],
        "completed": [t for t in tasks if t["status"] == "completed"],
        "failed": [t for t in tasks if t["status"] == "failed"]
    }
    
    return {
        "tasks": grouped,
        "summary": {
            "total": len(tasks),
            "queued": len(grouped["queued"]),
            "processing": len(grouped["processing"]),
            "completed": len(grouped["completed"]),
            "failed": len(grouped["failed"])
        }
    }

@app.get("/processing/tasks/{task_id}")
def get_task_status(task_id: str):
    """Get status of specific processing task"""
    task = processor.get_task_status(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    
    return {"task": task}

@app.post("/processing/clear-completed")
def clear_completed_tasks():
    """Clear completed and failed tasks to free memory"""
    processor.clear_completed_tasks()
    return {"message": "Cleared completed and failed tasks"}

@app.post("/processing/start")
def start_processing():
    """Manually start processing queue"""
    processor.start_processing()
    return {"message": "Processing started", "status": processor.get_stats()}

@app.post("/processing/stop")
def stop_processing():
    """Stop processing queue"""
    processor.stop_processing()
    return {"message": "Processing stopped", "status": processor.get_stats()}

@app.get("/files/directory")
def get_directory_contents():
    """Get contents of uploads directory"""
    directory_info = file_watcher.get_directory_info()
    
    # List all files in uploads directory
    files = []
    uploads_path = Path("uploads")
    
    if uploads_path.exists():
        for file_path in uploads_path.rglob("*"):
            if file_path.is_file():
                stat = file_path.stat()
                files.append({
                    "name": file_path.name,
                    "path": str(file_path),
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "is_audio": file_path.suffix.lower() in {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.wma'}
                })
    
    return {
        "directory_info": directory_info,
        "files": files,
        "audio_files": [f for f in files if f["is_audio"]]
    }

@app.post("/files/process-existing")
def process_existing_files():
    """Process all existing files in uploads directory"""
    task_ids = file_watcher.process_existing_files()
    
    return {
        "message": f"Added {len(task_ids)} existing files to processing queue",
        "task_ids": task_ids,
        "queue_stats": processor.get_stats()
    }

@app.post("/files/watch/start")
def start_file_watcher():
    """Start automatic file monitoring"""
    file_watcher.start_watching()
    return {
        "message": "File watcher started",
        "directory_info": file_watcher.get_directory_info()
    }

@app.post("/files/watch/stop")
def stop_file_watcher():
    """Stop automatic file monitoring"""
    file_watcher.stop_watching()
    return {
        "message": "File watcher stopped",
        "directory_info": file_watcher.get_directory_info()
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Threat Detection System")
    print("🌐 Server: http://localhost:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
