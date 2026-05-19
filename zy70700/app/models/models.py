import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base


class ToolStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DEPRECATED = "deprecated"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVOKED = "revoked"
    CLOSED = "closed"


class ExceptionStatus(str, enum.Enum):
    OPEN = "open"
    REVIEWING = "reviewing"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class MatchStatus(str, enum.Enum):
    MATCHED = "matched"
    MISMATCHED = "mismatched"
    PARTIAL = "partial"
    UNCHECKED = "unchecked"


class Tool(Base):
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    mcp_server = Column(String, index=True, nullable=False)
    description = Column(Text)
    version = Column(String, default="1.0.0")
    status = Column(Enum(ToolStatus), default=ToolStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    permission_declarations = relationship("PermissionDeclaration", back_populates="tool")
    actual_calls = relationship("ActualCall", back_populates="tool")


class PermissionDeclaration(Base):
    __tablename__ = "permission_declarations"

    id = Column(Integer, primary_key=True, index=True)
    tool_id = Column(Integer, ForeignKey("tools.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("approval_batches.id"))
    declared_scopes = Column(JSON, nullable=False)
    declared_resources = Column(JSON)
    declared_actions = Column(JSON)
    declared_description = Column(Text)
    declared_by = Column(String)
    declared_at = Column(DateTime, default=datetime.utcnow)
    match_status = Column(Enum(MatchStatus), default=MatchStatus.UNCHECKED)
    match_score = Column(Integer, default=0)
    match_details = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tool = relationship("Tool", back_populates="permission_declarations")
    approval_batch = relationship("ApprovalBatch", back_populates="permission_declarations")


class ActualCall(Base):
    __tablename__ = "actual_calls"

    id = Column(Integer, primary_key=True, index=True)
    tool_id = Column(Integer, ForeignKey("tools.id"), nullable=False)
    call_id = Column(String, index=True, unique=True)
    actual_scopes = Column(JSON, nullable=False)
    actual_resources = Column(JSON)
    actual_actions = Column(JSON)
    caller = Column(String)
    call_time = Column(DateTime, default=datetime.utcnow)
    request_payload = Column(JSON)
    response_status = Column(String)
    archived = Column(Boolean, default=False)
    archived_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    tool = relationship("Tool", back_populates="actual_calls")


class ApprovalBatch(Base):
    __tablename__ = "approval_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True, unique=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    submitter = Column(String, nullable=False)
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING)
    approver = Column(String)
    approval_time = Column(DateTime)
    approval_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    permission_declarations = relationship("PermissionDeclaration", back_populates="approval_batch")
    exception_records = relationship("ExceptionRecord", back_populates="approval_batch")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("approval_batches.id"))
    tool_id = Column(Integer, ForeignKey("tools.id"))
    title = Column(String, nullable=False)
    description = Column(Text)
    exception_type = Column(String)
    original_input = Column(JSON, nullable=False)
    status = Column(Enum(ExceptionStatus), default=ExceptionStatus.OPEN)
    handler = Column(String)
    handling_time = Column(DateTime)
    handling_conclusion = Column(Text)
    handling_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    approval_batch = relationship("ApprovalBatch", back_populates="exception_records")


class AuditSummary(Base):
    __tablename__ = "audit_summaries"

    id = Column(Integer, primary_key=True, index=True)
    summary_id = Column(String, index=True, unique=True, nullable=False)
    title = Column(String, nullable=False)
    audit_period_start = Column(DateTime, nullable=False)
    audit_period_end = Column(DateTime, nullable=False)
    total_tools = Column(Integer, default=0)
    total_declarations = Column(Integer, default=0)
    matched_declarations = Column(Integer, default=0)
    mismatched_declarations = Column(Integer, default=0)
    partial_declarations = Column(Integer, default=0)
    total_calls = Column(Integer, default=0)
    total_exceptions = Column(Integer, default=0)
    resolved_exceptions = Column(Integer, default=0)
    summary_data = Column(JSON)
    generated_by = Column(String)
    generated_at = Column(DateTime, default=datetime.utcnow)
    exported = Column(Boolean, default=False)
    exported_at = Column(DateTime)
