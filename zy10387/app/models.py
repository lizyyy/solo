import enum
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class SampleStatus(str, enum.Enum):
    CREATED = "created"
    VALIDATED = "validated"
    CLASSIFIED = "classified"
    REPRODUCING = "reproducing"
    REPRODUCED = "reproduced"
    FIXING = "fixing"
    FIXED = "fixed"
    ARCHIVED = "archived"
    EXPIRED = "expired"


class ErrorCategory(str, enum.Enum):
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    VALIDATION = "validation"
    RATE_LIMIT = "rate_limit"
    TIMEOUT = "timeout"
    INTERNAL_ERROR = "internal_error"
    DEPENDENCY_FAILURE = "dependency_failure"
    DATA_INTEGRITY = "data_integrity"
    NOT_FOUND = "not_found"
    OTHER = "other"


class ExceptionSample(Base):
    __tablename__ = "exception_samples"

    id = Column(Integer, primary_key=True, index=True)
    sample_hash = Column(String(64), unique=True, index=True, nullable=False)
    status = Column(Enum(SampleStatus), default=SampleStatus.CREATED)
    error_category = Column(Enum(ErrorCategory), nullable=True)
    error_code = Column(String(100))
    error_message = Column(Text)
    
    http_method = Column(String(10))
    api_endpoint = Column(String(500))
    request_payload = Column(Text)
    response_payload = Column(Text)
    sanitized_payload = Column(Text)
    
    reproduce_steps = Column(Text)
    reproduce_success = Column(Boolean, default=False)
    
    fix_issue_id = Column(String(100))
    fix_description = Column(Text)
    fixed_at = Column(DateTime)
    
    retention_days = Column(Integer, default=30)
    expires_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100))
    handled_by = Column(String(100))
    
    history_records = relationship("SampleHistory", back_populates="sample", cascade="all, delete-orphan")


class SampleHistory(Base):
    __tablename__ = "sample_history"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("exception_samples.id"))
    status = Column(Enum(SampleStatus))
    description = Column(Text)
    operated_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sample = relationship("ExceptionSample", back_populates="history_records")
