from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./slow_queries.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class SlowQuery(Base):
    __tablename__ = "slow_queries"
    
    id = Column(Integer, primary_key=True, index=True)
    fingerprint = Column(String(500), index=True)
    sql_content = Column(Text)
    execution_time = Column(Float)
    rows_examined = Column(Integer)
    rows_sent = Column(Integer)
    database = Column(String(100))
    affected_endpoints = Column(Text)
    execution_plan = Column(Text)
    index_suggestion = Column(Text)
    owner = Column(String(100))
    status = Column(String(50), default="pending")
    priority = Column(String(50), default="medium")
    is_valid = Column(Boolean, default=True)
    validation_error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    optimized_at = Column(DateTime, nullable=True)
    optimization_notes = Column(Text)

class OptimizationHistory(Base):
    __tablename__ = "optimization_history"
    
    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(Integer, index=True)
    old_status = Column(String(50))
    new_status = Column(String(50))
    notes = Column(Text)
    changed_by = Column(String(100))
    changed_at = Column(DateTime, default=datetime.utcnow)

class ErrorLog(Base):
    __tablename__ = "error_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    error_type = Column(String(100))
    error_message = Column(Text)
    context = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
