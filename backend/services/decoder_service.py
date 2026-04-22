from typing import List, Dict, Any
import re

class CodedLanguageDecoder:
    """Decode common coded language patterns"""
    
    CODED_PATTERNS = {
        r'\b(gift|present|parcel|delivery|package)\b': {
            'decoded': 'weapon/explosive',
            'threat_level': 'high'
        },
        r'\b(tourist|visitor|guest|traveler)\b': {
            'decoded': 'operative/attacker',
            'threat_level': 'high'
        },
        r'\b(shopping|groceries|supplies|materials)\b': {
            'decoded': 'attack materials/equipment',
            'threat_level': 'medium'
        },
        r'\b(party|celebration|wedding|event|gathering)\b': {
            'decoded': 'attack/operation',
            'threat_level': 'high'
        },
        r'\b(fruit|vegetable|produce|harvest)\b': {
            'decoded': 'explosive material',
            'threat_level': 'high'
        },
        r'\b(medicine|treatment|cure|remedy)\b': {
            'decoded': 'chemical/biological agent',
            'threat_level': 'critical'
        },
        r'\b(book|document|letter|message)\b': {
            'decoded': 'intelligence/plans',
            'threat_level': 'medium'
        },
        r'\b(meeting|appointment|visit)\b': {
            'decoded': 'coordination/planning',
            'threat_level': 'medium'
        }
    }
    
    def decode_transcript(self, transcript: str) -> List[Dict[str, Any]]:
        """Detect and decode coded language in transcript"""
        detected_codes = []
        transcript_lower = transcript.lower()
        
        for pattern, info in self.CODED_PATTERNS.items():
            matches = re.finditer(pattern, transcript_lower, re.IGNORECASE)
            
            for match in matches:
                term = match.group(0)
                start = match.start()
                end = match.end()
                
                # Get context (50 chars before and after)
                context_start = max(0, start - 50)
                context_end = min(len(transcript), end + 50)
                context = transcript[context_start:context_end]
                
                # Calculate confidence based on context
                confidence = self._calculate_confidence(context, term)
                
                detected_codes.append({
                    'term': term,
                    'decoded_meaning': info['decoded'],
                    'confidence': confidence,
                    'context': context.strip(),
                    'threat_level': info['threat_level']
                })
        
        return detected_codes
    
    def _calculate_confidence(self, context: str, term: str) -> float:
        """Calculate confidence score based on context"""
        # Start with base confidence
        confidence = 0.6
        
        # Increase confidence if suspicious words nearby
        suspicious_words = ['secret', 'hidden', 'careful', 'secure', 'safe', 
                          'border', 'route', 'transport', 'deliver', 'receive',
                          'ready', 'prepared', 'arranged', 'planned']
        
        context_lower = context.lower()
        for word in suspicious_words:
            if word in context_lower:
                confidence += 0.05
        
        # Cap at 0.95
        return min(confidence, 0.95)
    
    def get_threat_keywords(self) -> List[str]:
        """Get list of all monitored coded terms"""
        keywords = []
        for pattern in self.CODED_PATTERNS.keys():
            # Extract words from regex pattern
            words = re.findall(r'\w+', pattern)
            keywords.extend(words)
        return list(set(keywords))
