"""
LLM-Based Semantic Connection Service
"CONNECT THE DOTS" - No hardcoded code words
Uses LLM to understand context and find semantic similarities
"""
import json
from typing import List, Dict, Any, Tuple
from groq import Groq
import os

class SemanticConnector:
    """Uses LLM to find semantic connections between conversations"""
    
    def __init__(self, groq_client: Groq, model: str = "llama-3.1-8b-instant"):
        self.groq_client = groq_client
        self.model = model  # Use cheaper model for semantic tasks
    
    def extract_semantic_features(self, transcript: str, entities: dict) -> dict:
        """
        Extract semantic features from a conversation using LLM
        Returns: code words with meanings, themes, intent
        """
        prompt = f"""Analyze this conversation and extract semantic features for connection detection.

Transcript: {transcript}

Already detected entities: {json.dumps(entities)}

Extract and return in JSON format:
{{
    "code_words": [
        {{
            "term": "the actual word/phrase used",
            "likely_meaning": "what it probably means in this context",
            "confidence": 0.0-1.0,
            "category": "weapons/drugs/money/location/person/other"
        }}
    ],
    "main_theme": "overall topic of conversation",
    "intent": "what the speakers are trying to accomplish",
    "urgency_level": "low/medium/high/critical",
    "temporal_markers": ["phrases indicating time: 'tomorrow', 'next week', etc"],
    "action_items": ["specific actions mentioned"],
    "semantic_tags": ["keywords that capture the essence"]
}}

IMPORTANT:
- Identify ANY unusual terms that might be code words
- Infer meaning from CONTEXT, not from a dictionary
- "Diwali gifts" in a threat context likely means weapons/drugs
- "Package" or "delivery" in suspicious context = illegal shipment
- Be thorough - extract everything that could help connect conversations
"""
        
        try:
            response = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            features = json.loads(response.choices[0].message.content)
            return features
        
        except Exception as e:
            print(f"❌ Semantic feature extraction failed: {e}")
            return {
                "code_words": [],
                "main_theme": "unknown",
                "intent": "unknown",
                "urgency_level": "low",
                "temporal_markers": [],
                "action_items": [],
                "semantic_tags": []
            }
    
    def compare_semantic_similarity(self, conv_a_features: dict, conv_b_features: dict) -> Tuple[float, List[str]]:
        """
        Use LLM to compare two conversations semantically
        Returns: (similarity_score 0-100, list of evidence)
        """
        prompt = f"""Compare these two conversations and determine if they are discussing the SAME thing using DIFFERENT words.

Conversation A Features:
{json.dumps(conv_a_features, indent=2)}

Conversation B Features:
{json.dumps(conv_b_features, indent=2)}

Analyze and return in JSON format:
{{
    "are_related": true/false,
    "similarity_score": 0-100,
    "evidence": [
        "specific reasons why they are connected",
        "e.g., 'Both discuss weapons using code words: gifts vs package'",
        "e.g., 'Same intent: planning illegal shipment'"
    ],
    "semantic_connections": [
        {{
            "term_a": "term from conversation A",
            "term_b": "term from conversation B", 
            "connection_type": "synonym/same_meaning/related_concept",
            "explanation": "why these terms connect"
        }}
    ],
    "confidence": 0.0-1.0
}}

EXAMPLES OF CONNECTIONS:
- "Diwali gifts" (A) and "festival package" (B) = SAME (weapons shipment)
- "Send via Nepal" (A) and "Nepal route" (B) = SAME (smuggling route)
- "Tomorrow" (A) and "next day" (B) = SAME (timing)
- "The boss" (A) and "our leader" (B) = SAME (person reference)

Be intelligent about context. Don't just match exact words.
"""
        
        try:
            response = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            
            if result.get('are_related', False):
                score = result.get('similarity_score', 0)
                evidence = result.get('evidence', [])
                
                # Add semantic connection details to evidence
                for conn in result.get('semantic_connections', []):
                    evidence.append(
                        f"'{conn['term_a']}' ↔ '{conn['term_b']}': {conn['explanation']}"
                    )
                
                return (score, evidence)
            else:
                return (0, [])
        
        except Exception as e:
            print(f"❌ Semantic comparison failed: {e}")
            return (0, [])
    
    def detect_person_aliases(self, name_a: str, name_b: str) -> Tuple[bool, float]:
        """
        Use LLM to detect if two names refer to the same person
        Handles: Muhammad = Mohd = Md, different languages, nicknames
        Returns: (is_same_person, confidence)
        """
        # Quick check: if names are identical, skip LLM call
        if name_a.lower() == name_b.lower():
            return (True, 1.0)
        
        # Quick check: if names are very different, skip LLM call
        if len(set(name_a.lower()) & set(name_b.lower())) < 2:
            return (False, 0.0)
        
        prompt = f"""Are these two names referring to the SAME person?

Name A: {name_a}
Name B: {name_b}

Consider:
- Abbreviations (Muhammad = Mohd = Md)
- Nicknames (Robert = Bob, William = Bill)
- Different spellings (Mohammed = Muhammad)
- Titles (Mr. Khan = Khan)
- Different languages (same person, different script)

Return JSON:
{{
    "is_same_person": true/false,
    "confidence": 0.0-1.0,
    "reasoning": "why you think they are/aren't the same"
}}
"""
        
        try:
            response = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            return (result.get('is_same_person', False), result.get('confidence', 0.0))
        
        except Exception as e:
            print(f"❌ Person alias detection failed: {e}")
            # Fallback: simple string matching
            return (name_a.lower() == name_b.lower(), 1.0 if name_a.lower() == name_b.lower() else 0.0)
    
    def analyze_temporal_pattern(self, conversations: List[dict]) -> dict:
        """
        Analyze temporal patterns across multiple connected conversations
        Detects: planning → execution → aftermath patterns
        """
        if len(conversations) < 2:
            return {"pattern_detected": False}
        
        # Sort by timestamp
        sorted_convs = sorted(conversations, key=lambda x: x.get('timestamp', ''))
        
        conv_summaries = []
        for conv in sorted_convs:
            conv_summaries.append({
                "id": conv.get('id'),
                "date": conv.get('timestamp', '')[:10],
                "theme": conv.get('semantic_features', {}).get('main_theme', 'unknown'),
                "intent": conv.get('semantic_features', {}).get('intent', 'unknown'),
                "urgency": conv.get('semantic_features', {}).get('urgency_level', 'low')
            })
        
        prompt = f"""Analyze this sequence of connected conversations for temporal patterns.

Conversations (chronological order):
{json.dumps(conv_summaries, indent=2)}

Detect patterns like:
- Planning → Preparation → Execution → Aftermath
- Initial contact → Negotiation → Deal → Delivery
- Threat → Warning → Action

Return JSON:
{{
    "pattern_detected": true/false,
    "pattern_type": "planning_to_execution/negotiation/escalation/other",
    "pattern_description": "plain English explanation",
    "threat_level": "low/medium/high/critical",
    "predicted_next_step": "what might happen next",
    "time_sensitivity": "how urgent is this"
}}
"""
        
        try:
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            return json.loads(response.choices[0].message.content)
        
        except Exception as e:
            print(f"❌ Temporal pattern analysis failed: {e}")
            return {"pattern_detected": False}
