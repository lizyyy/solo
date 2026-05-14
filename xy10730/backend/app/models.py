from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base


class HealthStatus(str, enum.Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class CheckStatus(str, enum.Enum):
    SUCCESS = "success"
    PENDING_REVIEW = "pending_review"
    INTERCEPTED = "intercepted"
    RETRYABLE = "retryable"


class ServiceStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text)
    service_type = Column(String(50))
    status = Column(Enum(ServiceStatus), default=ServiceStatus.ONLINE)
    health_check_url = Column(String(255))
    dependencies = Column(JSON)
    owner = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    health_records = relationship("HealthRecord", back_populates="service")


class HealthRecord(Base):
    __tablename__ = "health_records"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    request_id = Column(String(64), unique=True, index=True, nullable=False)
    check_time = Column(DateTime, default=datetime.utcnow)
    health_status = Column(Enum(HealthStatus), nullable=False)
    check_status = Column(Enum(CheckStatus), nullable=False)
    probe_result = Column(JSON)
    dependency_check_result = Column(JSON)
    error_details = Column(Text)
    fault_level = Column(String(20))
    is_idempotent = Column(Boolean, default=False)
    retry_count = Column(Integer, default=0)
    reviewed = Column(Boolean, default=False)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    review_comment = Column(Text)
    recovery_confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    service = relationship("Service", back_populates="health_records")


class DutyReport(Base):
    __tablename__ = "duty_reports"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("health_records.id"))
    reporter = Column(String(100), nullable=False)
    report_time = Column(DateTime, default=datetime.utcnow)
    report_content = Column(Text, nullable=False)
    handle_status = Column(String(20), default="pending")
    handler = Column(String(100))
    handle_time = Column(DateTime)
    handle_comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
