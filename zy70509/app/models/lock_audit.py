from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, ForeignKey, JSON, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class LockStatus(str, enum.Enum):
    ACQUIRED = "acquired"
    RENEWING = "renewing"
    RENEW_FAILED = "renew_failed"
    EXECUTING = "executing"
    EXECUTED = "executed"
    RELEASING = "releasing"
    RELEASED = "released"
    TIMEOUT_RELEASED = "timeout_released"
    MANUALLY_RELEASED = "manually_released"
    EXPIRED = "expired"


class ExecutionPhase(str, enum.Enum):
    LOCK_ACQUIRE = "lock_acquire"
    LOCK_RENEW = "lock_renew"
    BUSINESS_LOGIC = "business_logic"
    DANGEROUS_STEP = "dangerous_step"
    LOCK_RELEASE = "lock_release"


class ReleaseReason(str, enum.Enum):
    NORMAL = "normal"
    TIMEOUT = "timeout"
    MANUAL = "manual"
    EXCEPTION = "exception"
    RENEWAL_FAILURE = "renewal_failure"


class LockAudit(Base):
    __tablename__ = "lock_audits"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(255), index=True, nullable=False)
    lock_key = Column(String(500), index=True, nullable=False)
    status = Column(Enum(LockStatus), index=True, nullable=False)
    execution_phase = Column(Enum(ExecutionPhase), index=True)
    acquired_at = Column(DateTime(timezone=True), server_default=func.now())
    last_renewed_at = Column(DateTime(timezone=True))
    expired_at = Column(DateTime(timezone=True), index=True)
    release_reason = Column(Enum(ReleaseReason))
    release_time = Column(DateTime(timezone=True))
    audit_summary = Column(Text)
    is_dangerous_step_executed = Column(Boolean, default=False)
    dangerous_step_executed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    renew_history = relationship("RenewHistory", back_populates="lock_audit", cascade="all, delete-orphan")
    phase_history = relationship("PhaseHistory", back_populates="lock_audit", cascade="all, delete-orphan")
    failure_records = relationship("FailureRecord", back_populates="lock_audit", cascade="all, delete-orphan")


class RenewHistory(Base):
    __tablename__ = "renew_history"

    id = Column(Integer, primary_key=True, index=True)
    lock_audit_id = Column(Integer, ForeignKey("lock_audits.id"), nullable=False)
    renew_time = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Boolean, nullable=False)
    previous_expire_time = Column(DateTime(timezone=True))
    new_expire_time = Column(DateTime(timezone=True))
    error_message = Column(Text)
    client_info = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lock_audit = relationship("LockAudit", back_populates="renew_history")


class PhaseHistory(Base):
    __tablename__ = "phase_history"

    id = Column(Integer, primary_key=True, index=True)
    lock_audit_id = Column(Integer, ForeignKey("lock_audits.id"), nullable=False)
    phase = Column(Enum(ExecutionPhase), nullable=False)
    entered_at = Column(DateTime(timezone=True), server_default=func.now())
    exited_at = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    phase_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lock_audit = relationship("LockAudit", back_populates="phase_history")


class FailureRecord(Base):
    __tablename__ = "failure_records"

    id = Column(Integer, primary_key=True, index=True)
    lock_audit_id = Column(Integer, ForeignKey("lock_audits.id"), nullable=False)
    failure_type = Column(String(100), nullable=False)
    original_input = Column(JSON)
    processing_basis = Column(JSON)
    final_conclusion = Column(Text)
    error_message = Column(Text)
    stack_trace = Column(Text)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(String(255))
    resolution_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lock_audit = relationship("LockAudit", back_populates="failure_records")


class ManualCorrection(Base):
    __tablename__ = "manual_corrections"

    id = Column(Integer, primary_key=True, index=True)
    lock_audit_id = Column(Integer, ForeignKey("lock_audits.id"), nullable=False)
    corrected_by = Column(String(255), nullable=False)
    correction_type = Column(String(100), nullable=False)
    previous_status = Column(Enum(LockStatus))
    new_status = Column(Enum(LockStatus))
    previous_phase = Column(Enum(ExecutionPhase))
    new_phase = Column(Enum(ExecutionPhase))
    reason = Column(Text, nullable=False)
    correction_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
