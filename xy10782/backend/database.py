from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./audio_quality.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class AudioRecord(Base):
    __tablename__ = "audio_records"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), index=True)
    duration = Column(Float)
    transcription = Column(Text)
    noise_tags = Column(Text)
    status = Column(String(50), default="pending")
    sampling_rate = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    quality_checks = relationship("QualityCheck", back_populates="audio_record", cascade="all, delete-orphan")
    approval_records = relationship("ApprovalRecord", back_populates="audio_record", cascade="all, delete-orphan")
    time_lines = relationship("TimeLine", back_populates="audio_record", cascade="all, delete-orphan")

class QualityCheck(Base):
    __tablename__ = "quality_checks"
    
    id = Column(Integer, primary_key=True, index=True)
    audio_record_id = Column(Integer, ForeignKey("audio_records.id"))
    check_type = Column(String(50))
    result = Column(String(50))
    error_reason = Column(Text)
    confidence = Column(Float)
    checked_at = Column(DateTime, default=datetime.utcnow)
    operator = Column(String(100))
    
    audio_record = relationship("AudioRecord", back_populates="quality_checks")

class ApprovalRecord(Base):
    __tablename__ = "approval_records"
    
    id = Column(Integer, primary_key=True, index=True)
    audio_record_id = Column(Integer, ForeignKey("audio_records.id"))
    action = Column(String(50))
    approver = Column(String(100))
    comment = Column(Text)
    approved_at = Column(DateTime, default=datetime.utcnow)
    
    audio_record = relationship("AudioRecord", back_populates="approval_records")

class TimeLine(Base):
    __tablename__ = "time_lines"
    
    id = Column(Integer, primary_key=True, index=True)
    audio_record_id = Column(Integer, ForeignKey("audio_records.id"))
    event_type = Column(String(50))
    event_description = Column(Text)
    operator = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    audio_record = relationship("AudioRecord", back_populates="time_lines")

class ExportRecord(Base):
    __tablename__ = "export_records"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255))
    export_type = Column(String(50))
    record_count = Column(Integer)
    exported_by = Column(String(100))
    exported_at = Column(DateTime, default=datetime.utcnow)
    file_path = Column(String(500))

class QualityStatistics(Base):
    __tablename__ = "quality_statistics"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(20), unique=True)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    blocked_count = Column(Integer, default=0)
    compensation_count = Column(Integer, default=0)
    manual_review_count = Column(Integer, default=0)
    avg_confidence = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
