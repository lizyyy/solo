from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class ValidationStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    FIXING = "fixing"
    FIXED = "fixed"


class ErrorCategory(str, enum.Enum):
    NETWORK_ERROR = "network_error"
    AUTH_ERROR = "auth_error"
    STATUS_CODE_MISMATCH = "status_code_mismatch"
    RESPONSE_SCHEMA_ERROR = "response_schema_error"
    TIMEOUT = "timeout"
    ENVIRONMENT_MISSING = "environment_missing"
    UNKNOWN = "unknown"


class DocumentPage(Base):
    __tablename__ = "document_pages"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), index=True)
    title = Column(String(200))
    content_hash = Column(String(64), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)

    examples = relationship("RequestExample", back_populates="document_page")


class RequestExample(Base):
    __tablename__ = "request_examples"

    id = Column(Integer, primary_key=True, index=True)
    document_page_id = Column(Integer, ForeignKey("document_pages.id"))
    name = Column(String(200))
    method = Column(String(10))
    url = Column(String(1000))
    headers = Column(JSON)
    body = Column(Text)
    expected_status = Column(Integer)
    expected_response = Column(Text)
    content_hash = Column(String(64), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)

    document_page = relationship("DocumentPage", back_populates="examples")
    validation_results = relationship("ValidationResult", back_populates="example")


class EnvironmentVariable(Base):
    __tablename__ = "environment_variables"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), index=True)
    value = Column(Text)
    description = Column(String(500))
    is_secret = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ValidationResult(Base):
    __tablename__ = "validation_results"

    id = Column(Integer, primary_key=True, index=True)
    example_id = Column(Integer, ForeignKey("request_examples.id"))
    status = Column(Enum(ValidationStatus), default=ValidationStatus.PENDING)
    actual_status = Column(Integer)
    actual_response = Column(Text)
    response_time_ms = Column(Integer)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    example = relationship("RequestExample", back_populates="validation_results")
    error_cause = relationship("ErrorCause", uselist=False, back_populates="validation_result")


class ErrorCause(Base):
    __tablename__ = "error_causes"

    id = Column(Integer, primary_key=True, index=True)
    validation_result_id = Column(Integer, ForeignKey("validation_results.id"), unique=True)
    category = Column(Enum(ErrorCategory))
    message = Column(Text)
    details = Column(JSON)
    suggested_fix = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    validation_result = relationship("ValidationResult", back_populates="error_cause")


class FixTrace(Base):
    __tablename__ = "fix_traces"

    id = Column(Integer, primary_key=True, index=True)
    validation_result_id = Column(Integer, ForeignKey("validation_results.id"))
    action_taken = Column(Text)
    operator = Column(String(100))
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
