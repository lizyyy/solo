from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class EvaluationFragment(Base):
    __tablename__ = "evaluation_fragments"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True, nullable=False)
    source_system = Column(String, index=True, nullable=False)
    model_name = Column(String, index=True, nullable=False)
    task_type = Column(String, index=True)
    original_input = Column(JSON, nullable=False)
    response_data = Column(JSON, nullable=False)
    handler = Column(String, index=True)
    department = Column(String)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    processed = Column(Boolean, default=False)
    has_error = Column(Boolean, default=False)
    error_type = Column(String)
    error_message = Column(Text)
    processing_notes = Column(Text)

    processing_records = relationship("ProcessingRecord", back_populates="fragment")
    field_traces = relationship("FieldTrace", back_populates="fragment")


class ProcessingRecord(Base):
    __tablename__ = "processing_records"

    id = Column(Integer, primary_key=True, index=True)
    fragment_id = Column(Integer, ForeignKey("evaluation_fragments.id"))
    handler = Column(String, index=True)
    action = Column(String)
    result = Column(String)
    notes = Column(Text)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())

    fragment = relationship("EvaluationFragment", back_populates="processing_records")


class FieldTrace(Base):
    __tablename__ = "field_traces"

    id = Column(Integer, primary_key=True, index=True)
    fragment_id = Column(Integer, ForeignKey("evaluation_fragments.id"))
    field_path = Column(String, nullable=False)
    original_value = Column(Text)
    trimmed_value = Column(Text)
    trim_reason = Column(String)
    traced_at = Column(DateTime(timezone=True), server_default=func.now())

    fragment = relationship("EvaluationFragment", back_populates="field_traces")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    report_name = Column(String, nullable=False)
    report_type = Column(String)
    batch_number = Column(String, index=True)
    total_records = Column(Integer)
    error_count = Column(Integer)
    conflict_count = Column(Integer)
    content_summary = Column(JSON)
    file_path = Column(String)
    generated_by = Column(String)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())


class BatchConflict(Base):
    __tablename__ = "batch_conflicts"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True, nullable=False)
    conflict_type = Column(String)
    fragment_ids = Column(JSON)
    source_systems = Column(JSON)
    description = Column(Text)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String)
    resolved_at = Column(DateTime(timezone=True))
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
