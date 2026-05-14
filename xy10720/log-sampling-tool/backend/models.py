from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class LogSamplingRecord(Base):
    __tablename__ = "log_sampling_records"

    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String(200), index=True, nullable=False)
    sampling_rule = Column(Text, nullable=False)
    trace_id = Column(String(100), index=True)
    error_fragment = Column(Text)
    error_fragment_status = Column(String(50), default="pending")
    troubleshooting_summary = Column(Text)
    is_manually_confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime)
    request_idempotency_key = Column(String(100), unique=True, index=True)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(String(100))

    versions = relationship("LogSamplingVersion", back_populates="record", cascade="all, delete-orphan")


class LogSamplingVersion(Base):
    __tablename__ = "log_sampling_versions"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("log_sampling_records.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    service_name = Column(String(200), nullable=False)
    sampling_rule = Column(Text, nullable=False)
    trace_id = Column(String(100))
    error_fragment = Column(Text)
    troubleshooting_summary = Column(Text)
    change_reason = Column(String(500))
    changed_by = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())

    record = relationship("LogSamplingRecord", back_populates="versions")


class SavedQuery(Base):
    __tablename__ = "saved_queries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    query_params = Column(Text, nullable=False)
    description = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
