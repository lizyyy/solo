from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum
from sqlalchemy import Enum as SAEnum


class ExceptionStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REVIEWING = "reviewing"
    RECOVERED = "recovered"
    REJECTED = "rejected"


class HandlingResult(str, enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class DataQualityException(Base):
    __tablename__ = "data_quality_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(255), index=True, nullable=False)
    field_path = Column(String(500), index=True, nullable=False)
    exception_condition = Column(JSON, nullable=False)
    recovery_date = Column(DateTime, nullable=False)
    status = Column(SAEnum(ExceptionStatus), default=ExceptionStatus.PENDING, index=True)
    description = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_comment = Column(Text, nullable=True)

    hit_records = relationship("ExceptionHitRecord", back_populates="exception", cascade="all, delete-orphan")
    handling_logs = relationship("ExceptionHandlingLog", back_populates="exception", cascade="all, delete-orphan")
    quality_reports = relationship("QualityReport", back_populates="exception", cascade="all, delete-orphan")


class ExceptionHitRecord(Base):
    __tablename__ = "exception_hit_records"

    id = Column(Integer, primary_key=True, index=True)
    exception_id = Column(Integer, ForeignKey("data_quality_exceptions.id"), nullable=False)
    record_key = Column(String(500), index=True, nullable=False)
    record_data = Column(JSON, nullable=False)
    hit_time = Column(DateTime(timezone=True), server_default=func.now())
    is_recovered = Column(Boolean, default=False)
    recovered_at = Column(DateTime(timezone=True), nullable=True)

    exception = relationship("DataQualityException", back_populates="hit_records")


class ExceptionHandlingLog(Base):
    __tablename__ = "exception_handling_logs"

    id = Column(Integer, primary_key=True, index=True)
    exception_id = Column(Integer, ForeignKey("data_quality_exceptions.id"), nullable=False)
    action = Column(String(100), nullable=False)
    original_input = Column(JSON, nullable=True)
    handling_basis = Column(Text, nullable=True)
    final_conclusion = Column(Text, nullable=True)
    result = Column(SAEnum(HandlingResult), nullable=False)
    error_message = Column(Text, nullable=True)
    handled_by = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    idempotency_key = Column(String(100), index=True, nullable=True)

    exception = relationship("DataQualityException", back_populates="handling_logs")


class QualityReport(Base):
    __tablename__ = "quality_reports"

    id = Column(Integer, primary_key=True, index=True)
    exception_id = Column(Integer, ForeignKey("data_quality_exceptions.id"), nullable=False)
    report_type = Column(String(50), nullable=False)
    report_date = Column(DateTime(timezone=True), server_default=func.now())
    total_hits = Column(Integer, default=0)
    recovered_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    summary = Column(JSON, nullable=False)
    generated_by = Column(String(100), nullable=False)
    file_path = Column(String(500), nullable=True)

    exception = relationship("DataQualityException", back_populates="quality_reports")


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String(100), unique=True, index=True, nullable=False)
    action = Column(String(100), nullable=False)
    resource_id = Column(Integer, nullable=True)
    response_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
