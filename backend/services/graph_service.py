from neo4j import GraphDatabase
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import uuid

class GraphService:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def close(self):
        self.driver.close()
    
    def create_conversation_node(self, conversation_data: Dict[str, Any]) -> str:
        """Create a conversation node in the graph"""
        conversation_id = str(uuid.uuid4())
        
        with self.driver.session() as session:
            session.run("""
                CREATE (c:Conversation {
                    id: $id,
                    transcript: $transcript,
                    timestamp: datetime($timestamp),
                    source: $source,
                    audio_file_path: $audio_file_path,
                    threat_score: $threat_score,
                    decoded_terms: $decoded_terms
                })
            """, 
                id=conversation_id,
                transcript=conversation_data['transcript'],
                timestamp=conversation_data['timestamp'].isoformat(),
                source=conversation_data['source'],
                audio_file_path=conversation_data.get('audio_file_path', ''),
                threat_score=conversation_data.get('threat_score', 0.0),
                decoded_terms=str(conversation_data.get('decoded_terms', []))
            )
        
        return conversation_id
    
    def create_or_update_person(self, name: str, threat_score: float = 0.0) -> str:
        """Create or update a person node"""
        with self.driver.session() as session:
            result = session.run("""
                MERGE (p:Person {name: $name})
                ON CREATE SET 
                    p.id = randomUUID(),
                    p.threat_score = $threat_score,
                    p.first_seen = datetime(),
                    p.last_seen = datetime(),
                    p.total_mentions = 1,
                    p.aliases = []
                ON MATCH SET
                    p.threat_score = ($threat_score + p.threat_score) / 2,
                    p.last_seen = datetime(),
                    p.total_mentions = p.total_mentions + 1
                RETURN p.id as id
            """, name=name, threat_score=threat_score)
            
            record = result.single()
            return record['id'] if record else str(uuid.uuid4())
    
    def create_or_update_location(self, name: str, threat_level: int = 0) -> str:
        """Create or update a location node"""
        with self.driver.session() as session:
            result = session.run("""
                MERGE (l:Location {name: $name})
                ON CREATE SET
                    l.id = randomUUID(),
                    l.threat_level = $threat_level,
                    l.event_count = 1,
                    l.coordinates = ''
                ON MATCH SET
                    l.event_count = l.event_count + 1,
                    l.threat_level = CASE WHEN $threat_level > l.threat_level 
                                     THEN $threat_level ELSE l.threat_level END
                RETURN l.id as id
            """, name=name, threat_level=threat_level)
            
            record = result.single()
            return record['id'] if record else str(uuid.uuid4())
    
    def link_person_to_conversation(self, person_name: str, conversation_id: str, 
                                   role: str = "participant", confidence: float = 1.0):
        """Create relationship between person and conversation"""
        with self.driver.session() as session:
            session.run("""
                MATCH (p:Person {name: $person_name})
                MATCH (c:Conversation {id: $conversation_id})
                MERGE (p)-[r:MENTIONED_IN]->(c)
                SET r.role = $role,
                    r.confidence = $confidence,
                    r.timestamp = datetime()
            """, person_name=person_name, conversation_id=conversation_id, 
                role=role, confidence=confidence)
    
    def connect_dots(self, conversation_id: str, decoded_terms: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        CRITICAL: Connect the dots across conversations
        Find related conversations with same coded terms and create connections
        """
        connections = []
        
        with self.driver.session() as session:
            # Get current conversation details
            current_conv = session.run("""
                MATCH (c:Conversation {id: $conversation_id})
                RETURN c.timestamp as timestamp, c.decoded_terms as terms
            """, conversation_id=conversation_id).single()
            
            if not current_conv:
                return connections
            
            # For each decoded term, find other conversations with same term
            for term_data in decoded_terms:
                term = term_data.get('term', '')
                decoded_meaning = term_data.get('decoded_meaning', '')
                
                # Find conversations within 180 days that mention same coded term
                results = session.run("""
                    MATCH (c1:Conversation {id: $conversation_id})-[:MENTIONED_IN]-(p1:Person)
                    MATCH (c2:Conversation)-[:MENTIONED_IN]-(p2:Person)
                    WHERE c2.id <> c1.id 
                    AND c2.timestamp > c1.timestamp - duration({days: 180})
                    AND c2.transcript CONTAINS $term
                    AND NOT (p1)-[:CONNECTED_TO]-(p2)
                    WITH p1, p2, c1, c2
                    CREATE (p1)-[r:CONNECTED_TO {
                        relationship_type: 'coded_language',
                        strength: 75,
                        common_terms: [$decoded_meaning],
                        first_connection: datetime(),
                        last_connection: datetime()
                    }]->(p2)
                    RETURN p1.name as person1, p2.name as person2, 
                           c1.id as conv1, c2.id as conv2,
                           $decoded_meaning as shared_meaning
                """, conversation_id=conversation_id, term=term, decoded_meaning=decoded_meaning)
                
                for record in results:
                    connections.append({
                        'person1': record['person1'],
                        'person2': record['person2'],
                        'conversation1': record['conv1'],
                        'conversation2': record['conv2'],
                        'shared_meaning': record['shared_meaning'],
                        'strength': 75
                    })
        
        return connections
    
    def calculate_threat_score(self, conversation_id: str, base_score: float) -> float:
        """
        Calculate final threat score based on:
        - Base LLM score: 40%
        - Cross-conversation connections: 35%
        - Semantic similarity: 25%
        """
        with self.driver.session() as session:
            # Count connections
            result = session.run("""
                MATCH (c:Conversation {id: $conversation_id})-[:MENTIONED_IN]-(p:Person)
                OPTIONAL MATCH (p)-[conn:CONNECTED_TO]-()
                RETURN count(DISTINCT conn) as connection_count
            """, conversation_id=conversation_id).single()
            
            connection_count = result['connection_count'] if result else 0
            
            # Calculate components
            llm_component = base_score * 0.40
            connection_component = min(connection_count * 15, 35)  # Max 35 points
            semantic_component = 25  # Placeholder, would use Chroma similarity
            
            final_score = llm_component + connection_component + semantic_component
            
            # Update conversation with final score
            session.run("""
                MATCH (c:Conversation {id: $conversation_id})
                SET c.threat_score = $final_score
            """, conversation_id=conversation_id, final_score=final_score)
            
            return final_score
    
    def create_threat_alert(self, conversation_id: str, threat_score: float, 
                           evidence: List[str]) -> str:
        """Create a threat alert if score exceeds threshold"""
        alert_id = str(uuid.uuid4())
        
        # Determine severity
        if threat_score >= 90:
            severity = "Critical"
        elif threat_score >= 75:
            severity = "High"
        elif threat_score >= 50:
            severity = "Medium"
        else:
            severity = "Low"
        
        with self.driver.session() as session:
            session.run("""
                CREATE (a:ThreatAlert {
                    id: $id,
                    severity: $severity,
                    score: $score,
                    created_at: datetime(),
                    status: 'active',
                    evidence: $evidence
                })
                WITH a
                MATCH (c:Conversation {id: $conversation_id})
                CREATE (c)-[:TRIGGERS]->(a)
            """, id=alert_id, severity=severity, score=threat_score, 
                evidence=str(evidence), conversation_id=conversation_id)
        
        return alert_id
    
    def get_entity_connections(self, entity_id: str, depth: int = 3) -> Dict[str, Any]:
        """Get connections for an entity up to specified depth"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH path = (start)-[*1..$depth]-(connected)
                WHERE start.id = $entity_id
                RETURN path
                LIMIT 100
            """, entity_id=entity_id, depth=depth)
            
            nodes = []
            edges = []
            
            for record in result:
                path = record['path']
                for node in path.nodes:
                    nodes.append({
                        'id': node.get('id'),
                        'label': node.get('name', node.get('id')),
                        'type': list(node.labels)[0]
                    })
                
                for rel in path.relationships:
                    edges.append({
                        'source': rel.start_node.get('id'),
                        'target': rel.end_node.get('id'),
                        'type': rel.type
                    })
            
            return {'nodes': nodes, 'edges': edges}
    
    def get_all_alerts(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all threat alerts"""
        with self.driver.session() as session:
            query = """
                MATCH (a:ThreatAlert)
            """
            if status:
                query += " WHERE a.status = $status"
            query += """
                OPTIONAL MATCH (c:Conversation)-[:TRIGGERS]->(a)
                OPTIONAL MATCH (c)-[:MENTIONED_IN]-(p:Person)
                RETURN a, collect(DISTINCT p.name) as entities
                ORDER BY a.created_at DESC
            """
            
            results = session.run(query, status=status) if status else session.run(query)
            
            alerts = []
            for record in results:
                alert_node = record['a']
                alerts.append({
                    'id': alert_node['id'],
                    'severity': alert_node['severity'],
                    'score': alert_node['score'],
                    'created_at': alert_node['created_at'],
                    'status': alert_node['status'],
                    'evidence': eval(alert_node['evidence']) if isinstance(alert_node['evidence'], str) else alert_node['evidence'],
                    'connected_entities': record['entities']
                })
            
            return alerts
