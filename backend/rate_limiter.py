"""
Smart Rate Limiter for Groq API
Prevents hitting daily token limits
"""
import json
import os
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class SmartRateLimiter:
    """
    Manages Groq API rate limits intelligently
    - Tracks daily token usage
    - Prevents exceeding limits
    - Resets automatically at midnight
    - Saves state to file
    """
    
    def __init__(self, 
                 daily_token_limit: int = 95000,  # Leave 5k buffer
                 state_file: str = "rate_limiter_state.json"):
        self.daily_token_limit = daily_token_limit
        self.state_file = state_file
        
        # Load saved state or initialize
        self.state = self._load_state()
        
        # Check if we need to reset (new day)
        self._check_and_reset()
    
    def _load_state(self) -> dict:
        """Load rate limiter state from file"""
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        
        # Default state
        return {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "tokens_used": 0,
            "transcriptions": 0,
            "analyses": 0,
            "semantic_extractions": 0,
            "comparisons": 0
        }
    
    def _save_state(self):
        """Save rate limiter state to file"""
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.state, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save rate limiter state: {e}")
    
    def _check_and_reset(self):
        """Check if it's a new day and reset counters"""
        today = datetime.now().strftime("%Y-%m-%d")
        if self.state["date"] != today:
            logger.info(f"🔄 New day detected. Resetting rate limiter. Previous usage: {self.state['tokens_used']} tokens")
            self.state = {
                "date": today,
                "tokens_used": 0,
                "transcriptions": 0,
                "analyses": 0,
                "semantic_extractions": 0,
                "comparisons": 0
            }
            self._save_state()
    
    def can_process(self, operation: str, estimated_tokens: int) -> tuple[bool, str]:
        """
        Check if we can process this operation
        Returns: (can_process, reason)
        """
        self._check_and_reset()
        
        if self.state["tokens_used"] + estimated_tokens > self.daily_token_limit:
            remaining = self.daily_token_limit - self.state["tokens_used"]
            return (False, f"Daily token limit reached. Used: {self.state['tokens_used']}/{self.daily_token_limit}. Remaining: {remaining}. Resets at midnight.")
        
        return (True, "OK")
    
    def record_usage(self, operation: str, tokens_used: int):
        """Record token usage for an operation"""
        self.state["tokens_used"] += tokens_used
        
        # Track operation counts
        if operation == "transcription":
            self.state["transcriptions"] += 1
        elif operation == "analysis":
            self.state["analyses"] += 1
        elif operation == "semantic_extraction":
            self.state["semantic_extractions"] += 1
        elif operation == "comparison":
            self.state["comparisons"] += 1
        
        self._save_state()
        
        # Log warning if approaching limit
        usage_percent = (self.state["tokens_used"] / self.daily_token_limit) * 100
        if usage_percent > 80:
            logger.warning(f"⚠️ Rate limit warning: {usage_percent:.1f}% of daily tokens used ({self.state['tokens_used']}/{self.daily_token_limit})")
    
    def get_stats(self) -> dict:
        """Get current usage statistics"""
        self._check_and_reset()
        
        remaining = self.daily_token_limit - self.state["tokens_used"]
        usage_percent = (self.state["tokens_used"] / self.daily_token_limit) * 100
        
        return {
            "date": self.state["date"],
            "tokens_used": self.state["tokens_used"],
            "tokens_limit": self.daily_token_limit,
            "tokens_remaining": remaining,
            "usage_percent": round(usage_percent, 1),
            "operations": {
                "transcriptions": self.state["transcriptions"],
                "analyses": self.state["analyses"],
                "semantic_extractions": self.state["semantic_extractions"],
                "comparisons": self.state["comparisons"]
            },
            "status": "OK" if usage_percent < 90 else "WARNING" if usage_percent < 100 else "LIMIT_REACHED"
        }
    
    def estimate_file_tokens(self, audio_duration_seconds: Optional[int] = None) -> int:
        """
        Estimate total tokens needed to process one audio file
        """
        # Transcription: ~100 tokens per minute of audio
        transcription_tokens = 500 if audio_duration_seconds is None else (audio_duration_seconds / 60) * 100
        
        # Analysis: ~1500 tokens
        analysis_tokens = 1500
        
        # Semantic extraction: ~1000 tokens
        semantic_tokens = 1000
        
        # Connection comparison (per existing conversation): ~800 tokens
        # Assume average 5 existing conversations
        comparison_tokens = 800 * 5
        
        total = transcription_tokens + analysis_tokens + semantic_tokens + comparison_tokens
        return int(total)
    
    def get_estimated_capacity(self) -> dict:
        """Get estimated remaining file processing capacity"""
        self._check_and_reset()
        
        remaining_tokens = self.daily_token_limit - self.state["tokens_used"]
        avg_tokens_per_file = self.estimate_file_tokens()
        estimated_files = remaining_tokens // avg_tokens_per_file
        
        return {
            "remaining_tokens": remaining_tokens,
            "avg_tokens_per_file": avg_tokens_per_file,
            "estimated_files_remaining": max(0, estimated_files),
            "warning": "This is an estimate. Actual usage may vary." if estimated_files > 0 else "Daily limit reached. Wait for reset."
        }

# Global rate limiter instance
rate_limiter = SmartRateLimiter()
