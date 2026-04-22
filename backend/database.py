from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

Base = declarative_base()

person_conversation = Table('person_conversation', Base.metadata,
    Column('person_id', Integer, ForeignKey('persons.id')),
    Column('conversation_id', Integer, ForeignKey('conversations.id'))
)

class Person(Base):
    __tablename__ = 'persons'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, index=True)
    aliases = Column(Text)
    threat_score = Column(Float, default=0.0)
    crime_type = Column(String)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    total_mentions = Column(Integer, default=1)
    
    conversations = relationship('Conversation', secondary=person_conversation, back_populates='persons')
    relationships_from = relationship('Relationship', foreign_keys='Relationship.person_a_id', back_populates='person_a')
    relationships_to = relationship('Relationship', foreign_keys='Relationship.person_b_id', back_populates='person_b')

class Location(Base):
    __tablename__ = 'locations'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, index=True)
    coordinates = Column(String)
    threat_level = Column(Integer, default=0)
    event_count = Column(Integer, default=0)
    
    conversations = relationship('Conversation', back_populates='location')

class Conversation(Base):
    __tablename__ = 'conversations'
    
    id = Column(Integer, primary_key=True)
    transcript = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    source = Column(String, index=True)
    audio_file_path = Column(String)
    threat_score = Column(Float, default=0.0)
    crime_type = Column(String, index=True)
    decoded_terms = Column(Text)  # Keep for backward compatibility
    language = Column(String)
    extracted_entities = Column(Text)  # NEW: Store all extracted entities as JSON
    
    location_id = Column(Integer, ForeignKey('locations.id'))
    location = relationship('Location', back_populates='conversations')
    
    persons = relationship('Person', secondary=person_conversation, back_populates='conversations')
    alerts = relationship('Alert', back_populates='conversation')

class Relationship(Base):
    __tablename__ = 'relationships'
    
    id = Column(Integer, primary_key=True)
    person_a_id = Column(Integer, ForeignKey('persons.id'))
    person_b_id = Column(Integer, ForeignKey('persons.id'))
    connection_type = Column(String)
    common_terms = Column(Text)
    strength = Column(Integer, default=50)
    first_connection = Column(DateTime, default=datetime.utcnow)
    last_connection = Column(DateTime, default=datetime.utcnow)
    
    person_a = relationship('Person', foreign_keys=[person_a_id], back_populates='relationships_from')
    person_b = relationship('Person', foreign_keys=[person_b_id], back_populates='relationships_to')

class ConversationConnection(Base):
    __tablename__ = 'conversation_connections'
    
    id = Column(Integer, primary_key=True)
    conversation_a_id = Column(Integer, ForeignKey('conversations.id'))
    conversation_b_id = Column(Integer, ForeignKey('conversations.id'))
    connection_type = Column(String, default='related')
    evidence = Column(Text)
    strength = Column(Integer, default=50)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    conversation_a = relationship('Conversation', foreign_keys=[conversation_a_id])
    conversation_b = relationship('Conversation', foreign_keys=[conversation_b_id])

class Alert(Base):
    __tablename__ = 'alerts'
    
    id = Column(Integer, primary_key=True)
    severity = Column(String, index=True)
    score = Column(Float)
    crime_type = Column(String, index=True)
    evidence = Column(Text)
    status = Column(String, default='active', index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)
    
    conversation_id = Column(Integer, ForeignKey('conversations.id'))
    conversation = relationship('Conversation', back_populates='alerts')

engine = create_engine('sqlite:///threat_detection.db', echo=False)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    print("✓ Database initialized")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
