from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class BatchStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    ARCHIVED = "archived"


class ClaimStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVOKED = "revoked"
    EXPIRED = "expired"


class DesensitizationType(str, enum.Enum):
    MASK = "mask"
    HASH = "hash"
    TRUNCATE = "truncate"
    REPLACE = "replace"
    REMOVE = "remove"


class SampleBatch(Base):
    __tablename__ = "sample_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, default=BatchStatus.DRAFT)
    created_by = Column(String, nullable=False)
    approver = Column(String)
    approval_comment = Column(Text)
    expire_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    api_paths = relationship("ApiPath", back_populates="batch", cascade="all, delete-orphan")
    sensitive_fields = relationship("SensitiveField", back_populates="batch", cascade="all, delete-orphan")
    authorization_scopes = relationship("AuthorizationScope", back_populates="batch", cascade="all, delete-orphan")
    claim_records = relationship("ClaimRecord", back_populates="batch")
    exception_records = relationship("ExceptionRecord", back_populates="batch")


class ApiPath(Base):
    __tablename__ = "api_paths"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("sample_batches.id"))
    path = Column(String, nullable=False)
    method = Column(String, default="POST")
    sample_count = Column(Integer, default=0)
    description = Column(Text)

    batch = relationship("SampleBatch", back_populates="api_paths")


class SensitiveField(Base):
    __tablename__ = "sensitive_fields"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("sample_batches.id"))
    field_path = Column(String, nullable=False)
    field_type = Column(String, default="string")
    rule_id = Column(Integer, ForeignKey("desensitization_rules.id"))
    description = Column(Text)

    batch = relationship("SampleBatch", back_populates="sensitive_fields")
    rule = relationship("DesensitizationRule")


class DesensitizationRule(Base):
    __tablename__ = "desensitization_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    rule_type = Column(String, nullable=False)
    pattern = Column(String)
    replacement = Column(String)
    mask_char = Column(String, default="*")
    keep_start = Column(Integer, default=0)
    keep_end = Column(Integer, default=0)
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class AuthorizationScope(Base):
    __tablename__ = "authorization_scopes"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("sample_batches.id"))
    scope_type = Column(String, nullable=False)
    scope_value = Column(String, nullable=False)
    allowed_users = Column(JSON)
    allowed_roles = Column(JSON)
    max_claims = Column(Integer, default=1)
    claim_hours = Column(Integer, default=24)
    description = Column(Text)

    batch = relationship("SampleBatch", back_populates="authorization_scopes")


class ClaimRecord(Base):
    __tablename__ = "claim_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("sample_batches.id"))
    claimant = Column(String, nullable=False)
    claimant_email = Column(String)
    purpose = Column(Text, nullable=False)
    status = Column(String, default=ClaimStatus.PENDING)
    approver = Column(String)
    approval_comment = Column(Text)
    claimed_at = Column(DateTime)
    expire_at = Column(DateTime)
    revoked_at = Column(DateTime)
    revoke_reason = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    batch = relationship("SampleBatch", back_populates="claim_records")
    access_logs = relationship("AccessLog", back_populates="claim", cascade="all, delete-orphan")


class AccessLog(Base):
    __tablename__ = "access_logs"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claim_records.id"))
    access_type = Column(String, nullable=False)
    api_path = Column(String)
    ip_address = Column(String)
    user_agent = Column(String)
    request_data = Column(JSON)
    response_data = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())

    claim = relationship("ClaimRecord", back_populates="access_logs")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("sample_batches.id"))
    operation = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    original_input = Column(JSON, nullable=False)
    error_message = Column(String, nullable=False)
    processing_basis = Column(JSON)
    stack_trace = Column(Text)
    resolved = Column(Boolean, default=False)
    resolver = Column(String)
    resolution_comment = Column(Text)
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    batch = relationship("SampleBatch", back_populates="exception_records")


class ManualCorrection(Base):
    __tablename__ = "manual_corrections"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("sample_batches.id"))
    field_path = Column(String, nullable=False)
    original_value = Column(Text)
    corrected_value = Column(Text)
    reason = Column(Text, nullable=False)
    corrected_by = Column(String, nullable=False)
    approved_by = Column(String)
    approved = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    approved_at = Column(DateTime)
