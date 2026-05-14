from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./rag_quality.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class SliceRule(Base):
    __tablename__ = "slice_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    min_length = Column(Integer, default=50)
    max_length = Column(Integer, default=500)
    overlap = Column(Integer, default=50)
    separator = Column(String(50), default="\n\n")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    records = relationship("QualityRecord", back_populates="slice_rule")

class QualityRecord(Base):
    __tablename__ = "quality_records"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(String(100))
    document_name = Column(String(500))
    original_content = Column(Text)
    sliced_content = Column(Text)
    slice_rule_id = Column(Integer, ForeignKey("slice_rules.id"))
    recall_score = Column(Float)
    has_answer = Column(Boolean)
    status = Column(String(50))
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    slice_rule = relationship("SliceRule", back_populates="records")
    approvals = relationship("ApprovalRecord", back_populates="quality_record")

class ApprovalRecord(Base):
    __tablename__ = "approval_records"
    
    id = Column(Integer, primary_key=True, index=True)
    quality_record_id = Column(Integer, ForeignKey("quality_records.id"))
    action = Column(String(50))
    comment = Column(Text)
    operator = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)
    
    quality_record = relationship("QualityRecord", back_populates="approvals")

Base.metadata.create_all(bind=engine)
