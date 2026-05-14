from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./ws_monitor.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class WSSession(Base):
    __tablename__ = "ws_sessions"
    
    id = Column(String(64), primary_key=True, index=True)
    client_id = Column(String(64), index=True)
    channel = Column(String(128), index=True)
    owner = Column(String(64), index=True)
    connected_at = Column(DateTime, default=datetime.utcnow)
    disconnected_at = Column(DateTime, nullable=True)
    heartbeat_status = Column(String(20), default="active")
    message_backlog = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    permissions = Column(Text, default="")
    reconnect_count = Column(Integer, default=0)
    last_heartbeat = Column(DateTime, default=datetime.utcnow)

class SubscriptionReport(Base):
    __tablename__ = "subscription_reports"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), index=True)
    client_id = Column(String(64), index=True)
    channel = Column(String(128))
    owner = Column(String(64))
    event_type = Column(String(50))
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(Text, default="")
    heartbeat_status = Column(String(20))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)