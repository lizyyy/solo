import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base


class SwitchStatus(str, enum.Enum):
    PENDING = "pending"
    SWITCHED = "switched"
    HEALTH_CHECKING = "health_checking"
    READY_TO_RESTORE = "ready_to_restore"
    RESTORED = "restored"
    CANCELLED = "cancelled"
    CLOSED = "closed"


class HealthStatus(str, enum.Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    domain_name = Column(String, unique=True, index=True, nullable=False)
    primary_origin = Column(String, nullable=False)
    backup_origin = Column(String, nullable=False)
    health_check_url = Column(String)
    health_check_interval = Column(Integer, default=60)
    success_threshold = Column(Integer, default=3)
    failure_threshold = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    switches = relationship("SwitchRecord", back_populates="domain")


class SwitchRecord(Base):
    __tablename__ = "switch_records"

    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    switch_reason = Column(Text, nullable=False)
    restore_condition = Column(Text)
    status = Column(String, default=SwitchStatus.PENDING)
    switched_at = Column(DateTime)
    restored_at = Column(DateTime)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    domain = relationship("Domain", back_populates="switches")
    health_checks = relationship("HealthCheck", back_populates="switch_record")
    operations = relationship("OperationLog", back_populates="switch_record")


class HealthCheck(Base):
    __tablename__ = "health_checks"

    id = Column(Integer, primary_key=True, index=True)
    switch_record_id = Column(Integer, ForeignKey("switch_records.id"), nullable=False)
    check_time = Column(DateTime, default=datetime.utcnow)
    target_origin = Column(String, nullable=False)
    status = Column(String, nullable=False)
    response_time = Column(Integer)
    status_code = Column(Integer)
    error_message = Column(Text)

    switch_record = relationship("SwitchRecord", back_populates="health_checks")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    switch_record_id = Column(Integer, ForeignKey("switch_records.id"), nullable=False)
    operation_type = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    original_input = Column(Text)
    conclusion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    switch_record = relationship("SwitchRecord", back_populates="operations")