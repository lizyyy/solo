from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum

class TemplateStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"

class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    VALIDATING = "validating"
    VALIDATION_FAILED = "validation_failed"
    READY = "ready"
    IN_PROGRESS = "in_progress"
    PARTIAL_SUCCESS = "partial_success"
    SUCCESS = "success"
    FAILED = "failed"
    INTERCEPTED = "intercepted"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    MANUAL_REVIEW = "manual_review"

class EmailStatus(str, enum.Enum):
    PENDING = "pending"
    SENDING = "sending"
    SUCCESS = "success"
    FAILED = "failed"
    INTERCEPTED = "intercepted"
    RETRY = "retry"

class ApprovalType(str, enum.Enum):
    TEMPLATE = "template"
    BATCH = "batch"
    COMPENSATION = "compensation"

class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), index=True)
    subject = Column(String(500))
    content = Column(Text)
    variables = Column(JSON)
    version = Column(Integer, default=1)
    status = Column(String(50), default=TemplateStatus.DRAFT)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    versions = relationship("TemplateVersion", back_populates="template", cascade="all, delete-orphan")
    batches = relationship("EmailBatch", back_populates="template")
    approvals = relationship("ApprovalRecord", back_populates="template")

class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("email_templates.id"))
    version = Column(Integer)
    subject = Column(String(500))
    content = Column(Text)
    variables = Column(JSON)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    change_description = Column(String(500))

    template = relationship("EmailTemplate", back_populates="versions")

class EmailBatch(Base):
    __tablename__ = "email_batches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    template_id = Column(Integer, ForeignKey("email_templates.id"))
    template_version = Column(Integer)
    grayscale_stage = Column(Integer, default=0)
    total_stages = Column(Integer, default=3)
    total_emails = Column(Integer, default=0)
    sent_emails = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    intercepted_count = Column(Integer, default=0)
    status = Column(String(50), default=BatchStatus.PENDING)
    test_recipients = Column(JSON)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))

    template = relationship("EmailTemplate", back_populates="batches")
    emails = relationship("EmailRecord", back_populates="batch", cascade="all, delete-orphan")
    approvals = relationship("ApprovalRecord", back_populates="batch")
    logs = relationship("BatchLog", back_populates="batch", cascade="all, delete-orphan")

class EmailRecord(Base):
    __tablename__ = "email_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("email_batches.id"))
    recipient_email = Column(String(200), index=True)
    recipient_name = Column(String(200))
    variables = Column(JSON)
    status = Column(String(50), default=EmailStatus.PENDING)
    is_test = Column(Boolean, default=False)
    grayscale_stage = Column(Integer, default=0)
    sent_at = Column(DateTime(timezone=True))
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("EmailBatch", back_populates="emails")
    validations = relationship("VariableValidation", back_populates="email", cascade="all, delete-orphan")

class VariableValidation(Base):
    __tablename__ = "variable_validations"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("email_records.id"))
    variable_name = Column(String(100))
    variable_value = Column(Text)
    is_valid = Column(Boolean)
    error_message = Column(String(500))
    validated_at = Column(DateTime(timezone=True), server_default=func.now())
    recalculated_at = Column(DateTime(timezone=True))

    email = relationship("EmailRecord", back_populates="validations")

class ApprovalRecord(Base):
    __tablename__ = "approval_records"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50))
    template_id = Column(Integer, ForeignKey("email_templates.id"), nullable=True)
    batch_id = Column(Integer, ForeignKey("email_batches.id"), nullable=True)
    status = Column(String(50), default=ApprovalStatus.PENDING)
    requester = Column(String(100))
    approver = Column(String(100), nullable=True)
    request_comment = Column(Text)
    approval_comment = Column(Text)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True))

    template = relationship("EmailTemplate", back_populates="approvals")
    batch = relationship("EmailBatch", back_populates="approvals")

class BatchLog(Base):
    __tablename__ = "batch_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("email_batches.id"))
    action = Column(String(100))
    operator = Column(String(100))
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("EmailBatch", back_populates="logs")

class CompensationRecord(Base):
    __tablename__ = "compensation_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("email_batches.id"))
    original_email_id = Column(Integer, ForeignKey("email_records.id"))
    compensation_type = Column(String(100))
    status = Column(String(50))
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    details = Column(Text)
