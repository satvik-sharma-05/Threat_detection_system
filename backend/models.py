import re
from typing import List, Dict, Any

class CodeDecoder:
    """Decode coded language patterns"""
    
    CODE_PATTERNS = {
        'terrorism': {
            r'\b(gift|present|parcel|package)\b': 'weapons/explosives',
            r'\b(party|celebration|wedding)\b': 'attack/operation',
            r'\b(tourist|visitor|guest)\b': 'attacker/operative',
        },
        'drugs': {
            r'\b(sugar|flour|salt)\b': 'cocaine/heroin',
            r'\b(cooking|baking)\b': 'drug production',
        },
        'money_laundering': {
            r'\b(donation|charity)\b': 'laundered money',
            r'\b(investment|portfolio)\b': 'shell company',
        },
        'weapons': {
            r'\b(tool|hardware)\b': 'weapons',
            r'\b(machinery|equipment)\b': 'weapon parts',
        },
        'human_trafficking': {
            r'\b(worker|laborer)\b': 'trafficked person',
            r'\b(document|paper|visa)\b': 'fake ID',
        }
    }
    
    def decode_transcript(self, transcript: str) -> List[Dict[str, Any]]:
        """Detect and decode coded language"""
        detected_codes = []
        transcript_lower = transcript.lower()
        
        for crime_type, patterns in self.CODE_PATTERNS.items():
            for pattern, decoded_meaning in patterns.items():
                matches = re.finditer(pattern, transcript_lower, re.IGNORECASE)
                
                for match in matches:
                    term = match.group(0)
                    start = match.start()
                    end = match.end()
                    
                    context_start = max(0, start - 50)
                    context_end = min(len(transcript), end + 50)
                    context = transcript[context_start:context_end]
                    
                    confidence = 0.75
                    
                    detected_codes.append({
                        'term': term,
                        'decoded_meaning': decoded_meaning,
                        'crime_type': crime_type,
                        'confidence': confidence,
                        'context': context.strip()
                    })
        
        return detected_codes
