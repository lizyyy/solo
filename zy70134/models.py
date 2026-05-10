from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class RecordingBatch(Base):
    __tablename__ = "recording_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200))
    agent_id = Column(String(50), nullable=False)
    record_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="pending")
    
    samplings = relationship("SamplingTask", back_populates="batch")
    assignments = relationship("Assignment", back_populates="batch")
    recordings = relationship("BatchRecording", back_populates="batch")


class BatchRecording(Base):
    __tablename__ = "batch_recordings"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("recording_batches.id"), nullable=False)
    recording_id = Column(String(100), nullable=False, index=True)
    recording_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("RecordingBatch", back_populates="recordings")


class SamplingRule(Base):
    __tablename__ = "sampling_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    sampling_ratio = Column(Float, default=0.1)
    min_samples = Column(Integer, default=1)
    max_samples = Column(Integer, default=100)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    samplings = relationship("SamplingTask", back_populates="rule")


class SamplingTask(Base):
    __tablename__ = "sampling_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("recording_batches.id"), nullable=False)
    rule_id = Column(Integer, ForeignKey("sampling_rules.id"), nullable=False)
    sample_seed = Column(String(100), nullable=False)
    sampled_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="created")
    
    batch = relationship("RecordingBatch", back_populates="samplings")
    rule = relationship("SamplingRule", back_populates="samplings")
    sample_records = relationship("SampleRecord", back_populates="sampling_task")
    assignments = relationship("Assignment", back_populates="sampling_task")


class SampleRecord(Base):
    __tablename__ = "sample_records"
    
    id = Column(Integer, primary_key=True, index=True)
    sampling_task_id = Column(Integer, ForeignKey("sampling_tasks.id"), nullable=False)
    recording_id = Column(String(100), nullable=False)
    recording_url = Column(String(500))
    sampled_at = Column(DateTime, default=datetime.utcnow)
    
    sampling_task = relationship("SamplingTask", back_populates="sample_records")
    assignment = relationship("Assignment", uselist=False, back_populates="sample_record")


class Assignment(Base):
    __tablename__ = "assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("recording_batches.id"), nullable=False)
    sampling_task_id = Column(Integer, ForeignKey("sampling_tasks.id"), nullable=False)
    sample_record_id = Column(Integer, ForeignKey("sample_records.id"), nullable=False)
    inspector_id = Column(String(50), nullable=False)
    status = Column(String(50), default="assigned")
    assigned_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    
    batch = relationship("RecordingBatch", back_populates="assignments")
    sampling_task = relationship("SamplingTask", back_populates="assignments")
    sample_record = relationship("SampleRecord", back_populates="assignment")
    inspection_result = relationship("InspectionResult", uselist=False, back_populates="assignment")


class InspectionResult(Base):
    __tablename__ = "inspection_results"
    
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    score = Column(Float, nullable=False)
    is_passed = Column(Boolean, default=True)
    comments = Column(Text)
    inspected_at = Column(DateTime, default=datetime.utcnow)
    inspector_id = Column(String(50), nullable=False)
    
    assignment = relationship("Assignment", back_populates="inspection_result")
    score_freeze = relationship("ScoreFreeze", uselist=False, back_populates="inspection_result")
    review = relationship("Review", uselist=False, back_populates="inspection_result")


class ScoreFreeze(Base):
    __tablename__ = "score_freezes"
    
    id = Column(Integer, primary_key=True, index=True)
    inspection_result_id = Column(Integer, ForeignKey("inspection_results.id"), nullable=False)
    reason = Column(Text, nullable=False)
    frozen_score = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    unfrozen_at = Column(DateTime)
    operator_id = Column(String(50), nullable=False)
    
    inspection_result = relationship("InspectionResult", back_populates="score_freeze")


class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    inspection_result_id = Column(Integer, ForeignKey("inspection_results.id"), nullable=False)
    appeal_reason = Column(Text)
    appeal_by = Column(String(50))
    appeal_at = Column(DateTime)
    status = Column(String(50), default="pending")
    review_comments = Column(Text)
    review_by = Column(String(50))
    review_at = Column(DateTime)
    original_score = Column(Float)
    adjusted_score = Column(Float)
    score_adjusted = Column(Boolean, default=False)
    
    inspection_result = relationship("InspectionResult", back_populates="review")


class HistoryRecord(Base):
    __tablename__ = "history_records"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    action = Column(String(100), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    operator_id = Column(String(50), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    comments = Column(Text)
