from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(String, primary_key=True)
    batch_no = Column(String, unique=True, nullable=False)
    source_type = Column(String, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    content_hash = Column(String, unique=True, nullable=False)
    
    records = relationship("RecordingRecord", back_populates="batch")
    corrections = relationship("ManualCorrection", back_populates="batch")

class RecordingRecord(Base):
    __tablename__ = "recording_records"
    
    id = Column(String, primary_key=True)
    batch_id = Column(String, ForeignKey("batches.id"))
    recording_id = Column(String, nullable=False)
    customer_id = Column(String)
    agent_id = Column(String)
    call_time = Column(DateTime, nullable=False)
    duration = Column(Integer)
    source_channel = Column(String)
    issue_type = Column(String)
    content_summary = Column(Text)
    is_mixed_source = Column(Boolean, default=False)
    original_status = Column(String)
    compensated_status = Column(String)
    compensation_amount = Column(Float, default=0)
    processed = Column(Boolean, default=False)
    conflict_note = Column(Text)
    
    batch = relationship("Batch", back_populates="records")

class CompensationResult(Base):
    __tablename__ = "compensation_results"
    
    id = Column(String, primary_key=True)
    batch_id = Column(String, ForeignKey("batches.id"))
    record_id = Column(String, ForeignKey("recording_records.id"))
    result_type = Column(String)
    amount = Column(Float, default=0)
    reason = Column(Text)
    evidence = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    execution_time_ms = Column(Integer)

class ManualCorrection(Base):
    __tablename__ = "manual_corrections"
    
    id = Column(String, primary_key=True)
    batch_id = Column(String, ForeignKey("batches.id"))
    record_id = Column(String, ForeignKey("recording_records.id"))
    operator = Column(String, nullable=False)
    correction_type = Column(String)
    original_value = Column(Text)
    corrected_value = Column(Text)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("Batch", back_populates="corrections")

class ProcessingReport(Base):
    __tablename__ = "processing_reports"
    
    id = Column(String, primary_key=True)
    batch_id = Column(String, ForeignKey("batches.id"))
    batch_no = Column(String)
    total_records = Column(Integer)
    success_count = Column(Integer)
    failed_count = Column(Integer)
    total_execution_time_ms = Column(Integer)
    before_summary = Column(Text)
    after_summary = Column(Text)
    next_steps = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
