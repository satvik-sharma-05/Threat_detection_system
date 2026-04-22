"""
Smart Model Configuration
Uses cheaper models for non-critical tasks
"""
import os
from typing import Literal

ModelType = Literal["transcription", "critical_analysis", "semantic_extraction", "comparison"]

class ModelConfig:
    """
    Smart model selection based on task criticality
    """
    
    # Model costs (approximate tokens per call)
    MODEL_COSTS = {
        "whisper-large-v3": 100,  # Per minute of audio
        "llama-3.3-70b-versatile": 2000,  # Large, accurate, expensive
        "llama-3.1-70b-versatile": 1800,  # Large, accurate
        "llama-3.1-8b-instant": 500,  # Small, fast, cheap
        "llama-3.2-3b-preview": 300,  # Tiny, very cheap
    }
    
    def __init__(self):
        # Get from env or use defaults
        self.whisper_model = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3")
        
        # Critical tasks: Use best model
        self.critical_model = os.getenv("GROQ_CRITICAL_MODEL", "llama-3.3-70b-versatile")
        
        # Non-critical tasks: Use cheaper model
        self.cheap_model = os.getenv("GROQ_CHEAP_MODEL", "llama-3.1-8b-instant")
        
        # Fallback if rate limited
        self.fallback_model = os.getenv("GROQ_FALLBACK_MODEL", "llama-3.1-8b-instant")
    
    def get_model(self, task: ModelType, rate_limited: bool = False) -> str:
        """
        Get appropriate model for task
        
        Args:
            task: Type of task
            rate_limited: If True, use cheapest model
        
        Returns:
            Model name
        """
        if rate_limited:
            return self.fallback_model
        
        if task == "transcription":
            return self.whisper_model
        
        elif task == "critical_analysis":
            # Threat analysis is critical - use best model
            return self.critical_model
        
        elif task == "semantic_extraction":
            # Semantic extraction can use cheaper model
            return self.cheap_model
        
        elif task == "comparison":
            # Comparison can use cheaper model
            return self.cheap_model
        
        else:
            return self.cheap_model
    
    def get_estimated_tokens(self, task: ModelType, audio_duration_seconds: int = 60) -> int:
        """Estimate tokens for a task"""
        model = self.get_model(task)
        
        if task == "transcription":
            # ~100 tokens per minute
            return int((audio_duration_seconds / 60) * self.MODEL_COSTS[model])
        else:
            return self.MODEL_COSTS.get(model, 500)
    
    def get_config_summary(self) -> dict:
        """Get current model configuration"""
        return {
            "transcription": self.whisper_model,
            "critical_analysis": self.critical_model,
            "semantic_extraction": self.cheap_model,
            "comparison": self.cheap_model,
            "fallback": self.fallback_model,
            "strategy": "Critical tasks use best model, non-critical use cheaper models"
        }

# Global model config
model_config = ModelConfig()
