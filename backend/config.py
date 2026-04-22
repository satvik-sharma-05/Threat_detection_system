import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
    CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
    ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg"}
    THREAT_THRESHOLD = 75.0

config = Config()
