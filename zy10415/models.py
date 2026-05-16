from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, Enum, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class EntryStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ROLLED_BACK = "rolled_back"
    NEEDS_REVIEW = "needs_review"
    MANUALLY_FIXED = "manually_fixed"

class ConflictType(enum.Enum):
    NONE = "none"
    DUPLICATE_VERSION = "duplicate_version"
    SOURCE_CHANGED = "source_changed"
    TARGET_CONFLICT = "target_conflict"
    HISTORY_MISMATCH = "history_mismatch"

class TranslationMemory(Base):
    __tablename__ = "translation_memory"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    entry_key = Column(String(500), nullable=False, index=True)
    source_language = Column(String(50), nullable=False, index=True)
    target_language = Column(String(50), nullable=False, index=True)
    source_text = Column(Text, nullable=False)
    target_text = Column(Text, nullable=False)
    version_batch = Column(String(100), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    status = Column(Enum(EntryStatus), nullable=False, default=EntryStatus.PENDING)
    rollback_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(200), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    
    reports = relationship("MemoryReport", back_populates="entry", cascade="all, delete-orphan")

class MemoryReport(Base):
    __tablename__ = "memory_report"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    entry_id = Column(Integer, ForeignKey("translation_memory.id"), nullable=False)
    report_type = Column(String(100), nullable=False)
    conflict_type = Column(Enum(ConflictType), nullable=False, default=ConflictType.NONE)
    original_input = Column(JSON, nullable=False)
    processing_result = Column(JSON, nullable=False)
    conclusion = Column(Text, nullable=False)
    severity = Column(String(50), nullable=False, default="info")
    detected_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(200), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    entry = relationship("TranslationMemory", back_populates="reports")