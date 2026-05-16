from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ToolStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DEPRECATED = "deprecated"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AnomalyStatus(str, enum.Enum):
    OPEN = "open"
    REVIEWING = "reviewing"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class AnomalyType(str, enum.Enum):
    PERMISSION_MISMATCH = "permission_mismatch"
    SCOPE_EXCEEDED = "scope_exceeded"
    UNAUTHORIZED_CALL = "unauthorized_call"
    DECLARATION_MISSING = "declaration_missing"
    OTHER = "other"


class Tool(Base):
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    server_name = Column(String(255), index=True, nullable=False)
    description = Column(Text)
    version = Column(String(50))
    status = Column(Enum(ToolStatus), default=ToolStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    declared_permissions = relationship("DeclaredPermission", back_populates="tool", cascade="all, delete-orphan")
    actual_calls = relationship("ActualCall", back_populates="tool", cascade="all, delete-orphan")
    anomalies = relationship("Anomaly", back_populates="tool", cascade="all, delete-orphan")


class DeclaredPermission(Base):
    __tablename__ = "declared_permissions"

    id = Column(Integer, primary_key=True, index=True)
    tool_id = Column(Integer, ForeignKey("tools.id"), nullable=False)
    permission_scope = Column(String(500), nullable=False)
    description = Column(Text)
    approved_by = Column(String(255))
    approved_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tool = relationship("Tool", back_populates="declared_permissions")


class ActualCall(Base):
    __tablename__ = "actual_calls"

    id = Column(Integer, primary_key=True, index=True)
    tool_id = Column(Integer, ForeignKey("tools.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("approval_batches.id"))
    caller = Column(String(255), nullable=False)
    call_scope = Column(String(500), nullable=False)
    call_parameters = Column(Text)
    call_result = Column(Text)
    error_message = Column(Text)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())

    tool = relationship("Tool", back_populates="actual_calls")
    batch = relationship("ApprovalBatch", back_populates="actual_calls")


class ApprovalBatch(Base):
    __tablename__ = "approval_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(100), unique=True, index=True, nullable=False)
    submitter = Column(String(255), nullable=False)
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING)
    description = Column(Text)
    approved_by = Column(String(255))
    approved_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actual_calls = relationship("ActualCall", back_populates="batch")
    audit_summaries = relationship("AuditSummary", back_populates="batch")


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    tool_id = Column(Integer, ForeignKey("tools.id"), nullable=False)
    call_id = Column(Integer, ForeignKey("actual_calls.id"))
    anomaly_type = Column(Enum(AnomalyType), nullable=False)
    status = Column(Enum(AnomalyStatus), default=AnomalyStatus.OPEN)
    declared_permission = Column(String(500))
    actual_scope = Column(String(500), nullable=False)
    original_input = Column(Text)
    description = Column(Text)
    resolution = Column(Text)
    resolved_by = Column(String(255))
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tool = relationship("Tool", back_populates="anomalies")


class AuditSummary(Base):
    __tablename__ = "audit_summaries"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("approval_batches.id"))
    summary_type = Column(String(100), nullable=False)
    total_tools = Column(Integer, default=0)
    compliant_tools = Column(Integer, default=0)
    non_compliant_tools = Column(Integer, default=0)
    total_calls = Column(Integer, default=0)
    anomalous_calls = Column(Integer, default=0)
    anomaly_details = Column(Text)
    generated_by = Column(String(255))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    export_format = Column(String(50))
    export_path = Column(String(500))

    batch = relationship("ApprovalBatch", back_populates="audit_summaries")
