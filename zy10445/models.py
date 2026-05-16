import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    owner = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    branch_rules = relationship("BranchRule", back_populates="repository")
    exception_requests = relationship("ExceptionRequest", back_populates="repository")


class BranchRule(Base):
    __tablename__ = "branch_rules"

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    branch_pattern = Column(String, nullable=False)
    require_pull_request = Column(Boolean, default=True)
    require_code_owner_review = Column(Boolean, default=False)
    required_approving_review_count = Column(Integer, default=1)
    dismiss_stale_reviews = Column(Boolean, default=True)
    require_status_checks = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository = relationship("Repository", back_populates="branch_rules")


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACTIVE = "active"
    EXPIRED = "expired"
    RESTORED = "restored"
    CANCELLED = "cancelled"


class ExceptionRequest(Base):
    __tablename__ = "exception_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_idempotency_key = Column(String, unique=True, index=True, nullable=False)
    repository_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    branch_pattern = Column(String, nullable=False)
    requester = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    requested_duration_minutes = Column(Integer, nullable=False)
    status = Column(String, default=RequestStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository = relationship("Repository", back_populates="exception_requests")
    approval = relationship("Approval", uselist=False, back_populates="request")
    release_window = relationship("ReleaseWindow", uselist=False, back_populates="request")
    restore_actions = relationship("RestoreAction", back_populates="request")
    audit_records = relationship("AuditRecord", back_populates="request")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("exception_requests.id"), nullable=False, unique=True)
    approver = Column(String, nullable=False)
    comment = Column(Text)
    approved_at = Column(DateTime, default=datetime.utcnow)

    request = relationship("ExceptionRequest", back_populates="approval")


class ReleaseWindow(Base):
    __tablename__ = "release_windows"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("exception_requests.id"), nullable=False, unique=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ends_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    original_settings_snapshot = Column(Text, nullable=False)

    request = relationship("ExceptionRequest", back_populates="release_window")


class RestoreAction(Base):
    __tablename__ = "restore_actions"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("exception_requests.id"), nullable=False)
    restored_by = Column(String, nullable=False)
    restored_at = Column(DateTime, default=datetime.utcnow)
    is_manual = Column(Boolean, default=False)
    comment = Column(Text)
    success = Column(Boolean, default=True)

    request = relationship("ExceptionRequest", back_populates="restore_actions")


class AuditConclusion(str, enum.Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    NEEDS_REVIEW = "needs_review"


class AuditRecord(Base):
    __tablename__ = "audit_records"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("exception_requests.id"), nullable=False)
    action = Column(String, nullable=False)
    actor = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    original_input = Column(Text)
    conclusion = Column(String, default=AuditConclusion.NORMAL)
    details = Column(Text)

    request = relationship("ExceptionRequest", back_populates="audit_records")
