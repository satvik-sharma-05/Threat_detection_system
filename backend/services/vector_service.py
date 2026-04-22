import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any
import uuid

class VectorService:
    def __init__(self, persist_directory: str):
        self.client = chromadb.Client(Settings(
            persist_directory=persist_directory,
            anonymized_telemetry=False
        ))
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Create or get collection
        self.collection = self.client.get_or_create_collection(
            name="conversation_embeddings",
            metadata={"description": "Semantic search across threat conversations"}
        )
    
    def add_conversation(self, conversation_id: str, transcript: str, 
                        metadata: Dict[str, Any]) -> str:
        """Add conversation to vector database"""
        embedding = self.model.encode(transcript).tolist()
        
        self.collection.add(
            ids=[conversation_id],
            embeddings=[embedding],
            documents=[transcript],
            metadatas=[{
                "timestamp": metadata.get('timestamp', ''),
                "source": metadata.get('source', ''),
                "threat_score": metadata.get('threat_score', 0.0),
                "entities": str(metadata.get('entities', [])),
                "coded_terms": str(metadata.get('coded_terms', []))
            }]
        )
        
        return conversation_id
    
    def find_similar_conversations(self, transcript: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Find semantically similar conversations"""
        embedding = self.model.encode(transcript).tolist()
        
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=n_results
        )
        
        similar = []
        if results['ids']:
            for i, conv_id in enumerate(results['ids'][0]):
                similar.append({
                    'conversation_id': conv_id,
                    'similarity': 1 - results['distances'][0][i],  # Convert distance to similarity
                    'transcript': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i]
                })
        
        return similar
    
    def search_by_term(self, term: str, n_results: int = 10) -> List[Dict[str, Any]]:
        """Search conversations containing specific term"""
        results = self.collection.query(
            query_texts=[term],
            n_results=n_results
        )
        
        matches = []
        if results['ids']:
            for i, conv_id in enumerate(results['ids'][0]):
                matches.append({
                    'conversation_id': conv_id,
                    'transcript': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i]
                })
        
        return matches
