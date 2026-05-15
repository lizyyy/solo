from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class TaskBatch(Base):
    __tablename__ = "task_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), unique=True, index=True)
    temp_permission_ticket = Column(String(200))
    status = Column(String(50), default="pending")
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    blocked_count = Column(Integer, default=0)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    parameters = Column(JSON)
    remarks = Column(Text)

    watermark_records = relationship("WatermarkRecord", back_populates="batch")
    failed_items = relationship("FailedItem", back_populates="batch")
    rollback_candidates = relationship("RollbackCandidate", back_populates="batch")
    reports = relationship("ProcessReport", back_populates="batch")


class WatermarkRecord(Base):
    __tablename__ = "watermark_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("task_batches.id"))
    record_no = Column(String(100))
    is_exception = Column(Boolean, default=False)
    exception_type = Column(String(100))
    exception_message = Column(Text)
    status = Column(String(50), default="processed")
    original_data = Column(JSON)
    processed_data = Column(JSON)
    parameter_combination = Column(JSON)
    is_blocked = Column(Boolean, default=False)
    block_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)

    batch = relationship("TaskBatch", back_populates="watermark_records")
    manual_corrections = relationship("ManualCorrection", back_populates="record")


class FailedItem(Base):
    __tablename__ = "failed_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("task_batches.id"))
    record_no = Column(String(100))
    failure_type = Column(String(100))
    failure_reason = Column(Text)
    original_data = Column(JSON)
    error_details = Column(JSON)
    stack_trace = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_handled = Column(Boolean, default=False)
    handled_by = Column(String(100))
    handled_at = Column(DateTime)
    handling_notes = Column(Text)
    related_ticket_id = Column(String(100))

    batch = relationship("TaskBatch", back_populates="failed_items")


class RollbackCandidate(Base):
    __tablename__ = "rollback_candidates"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("task_batches.id"))
    record_no = Column(String(100))
    operation_type = Column(String(50))
    candidate_reason = Column(Text)
    original_value = Column(JSON)
    suggested_value = Column(JSON)
    risk_level = Column(String(50))
    is_approved = Column(Boolean)
    approved_by = Column(String(100))
    approved_at = Column(DateTime)
    is_executed = Column(Boolean, default=False)
    executed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100))

    batch = relationship("TaskBatch", back_populates="rollback_candidates")


class ManualCorrection(Base):
    __tablename__ = "manual_corrections"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("watermark_records.id"))
    corrected_by = Column(String(100))
    correction_notes = Column(Text)
    original_judgment = Column(String(100))
    corrected_judgment = Column(String(100))
    review_opinion = Column(Text)
    related_ticket_id = Column(String(100))
    original_record_reference = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("WatermarkRecord", back_populates="manual_corrections")


class ProcessReport(Base):
    __tablename__ = "process_reports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("task_batches.id"))
    report_no = Column(String(100))
    before_processing_stats = Column(JSON)
    after_processing_stats = Column(JSON)
    comparison_summary = Column(Text)
    execution_time_seconds = Column(Float)
    next_step_suggestions = Column(Text)
    blocked_items_analysis = Column(Text)
    failed_items_summary = Column(Text)
    generated_by = Column(String(100))
    generated_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("TaskBatch", back_populates="reports")


class ParameterCombinationCheck(Base):
    __tablename__ = "parameter_combination_checks"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer)
    parameter_combination = Column(JSON)
    is_tested = Column(Boolean, default=False)
    is_blocked = Column(Boolean, default=False)
    block_reason = Column(Text)
    check_result = Column(String(50))
    checked_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
