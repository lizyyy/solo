from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class AlarmStatus(str, enum.Enum):
    PENDING = "pending"
    MAINTENANCE_DISPATCHED = "maintenance_dispatched"
    ON_SITE = "on_site"
    RESCUING = "rescuing"
    RESOLVED = "resolved"
    REVIEWING = "reviewing"
    REJECTED = "rejected"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class AlarmSource(str, enum.Enum):
    MONITOR = "monitor"
    PHONE = "phone"
    MANUAL = "manual"
    OTHER = "other"


class ElevatorAlarm(Base):
    __tablename__ = "elevator_alarms"

    id = Column(Integer, primary_key=True, index=True)
    alarm_no = Column(String, unique=True, index=True)
    elevator_no = Column(String, index=True)
    alarm_time = Column(DateTime)
    passenger_count = Column(Integer, default=0)
    source = Column(String)
    location = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    maintenance_person = Column(String, nullable=True)
    maintenance_phone = Column(String, nullable=True)
    dispatched_time = Column(DateTime, nullable=True)
    arrived_time = Column(DateTime, nullable=True)

    resolved_time = Column(DateTime, nullable=True)
    resolution = Column(Text, nullable=True)

    status = Column(String, default=AlarmStatus.PENDING)
    is_timeout = Column(Boolean, default=False)
    timeout_reason = Column(String, nullable=True)

    parent_id = Column(Integer, ForeignKey("elevator_alarms.id"), nullable=True)
    merge_count = Column(Integer, default=0)

    reviewer = Column(String, nullable=True)
    review_comment = Column(String, nullable=True)
    review_time = Column(DateTime, nullable=True)

    previous_rejection = Column(JSON, nullable=True)
    resubmit_count = Column(Integer, default=0)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(String)

    parent = relationship("ElevatorAlarm", remote_side=[id], backref="merged_alarms")
    call_records = relationship("CallRecord", back_populates="alarm", cascade="all, delete-orphan")
    status_histories = relationship("StatusHistory", back_populates="alarm", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="alarm", cascade="all, delete-orphan")


class CallRecord(Base):
    __tablename__ = "call_records"

    id = Column(Integer, primary_key=True, index=True)
    alarm_id = Column(Integer, ForeignKey("elevator_alarms.id"))
    call_type = Column(String)
    caller = Column(String)
    caller_phone = Column(String, nullable=True)
    call_time = Column(DateTime)
    duration = Column(Integer, nullable=True)
    content = Column(Text)
    operator = Column(String)
    created_at = Column(DateTime, server_default=func.now())

    alarm = relationship("ElevatorAlarm", back_populates="call_records")


class StatusHistory(Base):
    __tablename__ = "status_histories"

    id = Column(Integer, primary_key=True, index=True)
    alarm_id = Column(Integer, ForeignKey("elevator_alarms.id"))
    from_status = Column(String, nullable=True)
    to_status = Column(String)
    operator = Column(String)
    remark = Column(String, nullable=True)
    change_time = Column(DateTime, server_default=func.now())

    alarm = relationship("ElevatorAlarm", back_populates="status_histories")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    alarm_id = Column(Integer, ForeignKey("elevator_alarms.id"))
    field_name = Column(String)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    operator = Column(String)
    change_reason = Column(String, nullable=True)
    change_time = Column(DateTime, server_default=func.now())

    alarm = relationship("ElevatorAlarm", back_populates="audit_logs")
