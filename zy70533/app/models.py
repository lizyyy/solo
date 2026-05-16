from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
from .enums import FreezeStatus, ChangeType, ApprovalStatus, ExceptionType


class ExperimentFreeze(Base):
    __tablename__ = "experiment_freezes"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(String, index=True, nullable=False)
    parameter_version = Column(String, nullable=False)
    freeze_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default=FreezeStatus.PENDING)
    metric_window_start = Column(DateTime, nullable=False)
    metric_window_end = Column(DateTime, nullable=False)
    
    parameters = Column(JSON, nullable=False)
    metrics_config = Column(JSON, nullable=True)
    
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    remarks = Column(Text, nullable=True)
    
    parameter_snapshots = relationship("ParameterSnapshot", back_populates="experiment_freeze")
    change_requests = relationship("ChangeRequest", back_populates="experiment_freeze")
    exception_records = relationship("ExceptionRecord", back_populates="experiment_freeze")
    freeze_reports = relationship("FreezeReport", back_populates="experiment_freeze")
    audit_logs = relationship("AuditLog", back_populates="experiment_freeze")


class ParameterSnapshot(Base):
    __tablename__ = "parameter_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    freeze_id = Column(Integer, ForeignKey("experiment_freezes.id"))
    version = Column(String, nullable=False)
    snapshot_time = Column(DateTime, default=datetime.utcnow)
    parameters = Column(JSON, nullable=False)
    hash = Column(String, nullable=False)
    created_by = Column(String, nullable=False)
    
    experiment_freeze = relationship("ExperimentFreeze", back_populates="parameter_snapshots")


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id = Column(Integer, primary_key=True, index=True)
    freeze_id = Column(Integer, ForeignKey("experiment_freezes.id"))
    change_type = Column(String, nullable=False)
    original_parameters = Column(JSON, nullable=False)
    proposed_parameters = Column(JSON, nullable=False)
    reason = Column(Text, nullable=False)
    
    requested_by = Column(String, nullable=False)
    requested_at = Column(DateTime, default=datetime.utcnow)
    
    approval_status = Column(String, default=ApprovalStatus.PENDING)
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approval_remarks = Column(Text, nullable=True)
    
    is_blocked = Column(Boolean, default=False)
    block_reason = Column(Text, nullable=True)
    
    experiment_freeze = relationship("ExperimentFreeze", back_populates="change_requests")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    freeze_id = Column(Integer, ForeignKey("experiment_freezes.id"))
    exception_type = Column(String, nullable=False)
    error_code = Column(String, nullable=True)
    
    original_input = Column(JSON, nullable=False)
    processing_basis = Column(JSON, nullable=False)
    final_conclusion = Column(JSON, nullable=False)
    
    occurred_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, nullable=True)
    resolution_details = Column(Text, nullable=True)
    
    is_resolved = Column(Boolean, default=False)
    
    experiment_freeze = relationship("ExperimentFreeze", back_populates="exception_records")


class FreezeReport(Base):
    __tablename__ = "freeze_reports"

    id = Column(Integer, primary_key=True, index=True)
    freeze_id = Column(Integer, ForeignKey("experiment_freezes.id"))
    
    report_type = Column(String, nullable=False)
    content = Column(JSON, nullable=False)
    
    generated_by = Column(String, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    
    file_path = Column(String, nullable=True)
    file_format = Column(String, default="json")
    
    experiment_freeze = relationship("ExperimentFreeze", back_populates="freeze_reports")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    freeze_id = Column(Integer, ForeignKey("experiment_freezes.id"))
    
    action = Column(String, nullable=False)
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)
    
    operator = Column(String, nullable=False)
    operated_at = Column(DateTime, default=datetime.utcnow)
    
    remarks = Column(Text, nullable=True)
    
    experiment_freeze = relationship("ExperimentFreeze", back_populates="audit_logs")
