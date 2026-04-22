"""
Database initialization script
Creates indexes and constraints for optimal performance
"""
from neo4j import GraphDatabase
from config import config

def init_database():
    driver = GraphDatabase.driver(
        config.NEO4J_URI,
        auth=(config.NEO4J_USER, config.NEO4J_PASSWORD)
    )
    
    with driver.session() as session:
        # Create constraints
        constraints = [
            "CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE",
            "CREATE CONSTRAINT location_id IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE",
            "CREATE CONSTRAINT conversation_id IF NOT EXISTS FOR (c:Conversation) REQUIRE c.id IS UNIQUE",
            "CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE",
            "CREATE CONSTRAINT alert_id IF NOT EXISTS FOR (a:ThreatAlert) REQUIRE a.id IS UNIQUE"
        ]
        
        for constraint in constraints:
            try:
                session.run(constraint)
                print(f"✓ Created constraint: {constraint.split()[2]}")
            except Exception as e:
                print(f"✗ Constraint already exists or error: {e}")
        
        # Create indexes for performance
        indexes = [
            "CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.name)",
            "CREATE INDEX location_name IF NOT EXISTS FOR (l:Location) ON (l.name)",
            "CREATE INDEX conversation_timestamp IF NOT EXISTS FOR (c:Conversation) ON (c.timestamp)",
            "CREATE INDEX alert_severity IF NOT EXISTS FOR (a:ThreatAlert) ON (a.severity)"
        ]
        
        for index in indexes:
            try:
                session.run(index)
                print(f"✓ Created index: {index.split()[2]}")
            except Exception as e:
                print(f"✗ Index already exists or error: {e}")
    
    driver.close()
    print("\n✓ Database initialization complete!")

if __name__ == "__main__":
    init_database()
