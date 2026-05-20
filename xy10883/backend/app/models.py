import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from app.database import Base


class AnomalyStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IGNORED = "ignored"
    TICKETED = "ticketed"
    RECOVERED = "recovered"
    CLOSED = "closed"


class SeverityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DeviceMetric(Base):
    __tablename__ = "device_metrics"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), index=True, nullable=False)
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Float, nullable=False)
    unit = Column(String(50))
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    previous_value = Column(Float)
    extra = Column(JSON, default=dict)

    anomalies = relationship("AnomalyRecord", back_populates="metric")


class AnomalyRule(Base):
    __tablename__ = "anomaly_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(200), nullable=False)
    rule_type = Column(String(50), nullable=False)
    metric_name = Column(String(100), nullable=False)
    threshold_min = Column(Float)
    threshold_max = Column(Float)
    operator = Column(String(20), default=">")
    severity = Column(String(20), default=SeverityLevel.MEDIUM)
    aggregation_window = Column(Integer, default=1)
    enabled = Column(Boolean, default=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    anomalies = relationship("AnomalyRecord", back_populates="rule")


class AnomalyRecord(Base):
    __tablename__ = "anomaly_records"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_idempotency_key = Column(String(64), unique=True, index=True)
    device_id = Column(String(100), index=True, nullable=False)
    metric_id = Column(Integer, ForeignKey("device_metrics.id"))
    rule_id = Column(Integer, ForeignKey("anomaly_rules.id"))
    title = Column(String(200), nullable=False)
    description = Column(Text)
    severity = Column(String(20), nullable=False)
    status = Column(String(20), default=AnomalyStatus.PENDING, index=True)
    current_value = Column(Float)
    previous_value = Column(Float)
    threshold_value = Column(Float)
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    confirmed_at = Column(DateTime)
    recovered_at = Column(DateTime)
    closed_at = Column(DateTime)
    extra = Column(JSON, default=dict)

    metric = relationship("DeviceMetric", back_populates="anomalies")
    rule = relationship("AnomalyRule", back_populates="anomalies")
    confirmations = relationship("ConfirmationHistory", back_populates="anomaly", cascade="all, delete-orphan")
    ignore_reasons = relationship("IgnoreReason", back_populates="anomaly", cascade="all, delete-orphan")
    tickets = relationship("TicketLink", back_populates="anomaly", cascade="all, delete-orphan")
    recovery_events = relationship("RecoveryEvent", back_populates="anomaly", cascade="all, delete-orphan")


class ConfirmationHistory(Base):
    __tablename__ = "confirmation_history"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("anomaly_records.id"), nullable=False)
    operator_id = Column(String(100), nullable=False)
    operator_name = Column(String(200), nullable=False)
    previous_status = Column(String(20))
    new_status = Column(String(20), nullable=False)
    comment = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(50))
    user_agent = Column(String(500))

    anomaly = relationship("AnomalyRecord", back_populates="confirmations")


class IgnoreReason(Base):
    __tablename__ = "ignore_reasons"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("anomaly_records.id"), nullable=False)
    operator_id = Column(String(100), nullable=False)
    operator_name = Column(String(200), nullable=False)
    reason_category = Column(String(100), nullable=False)
    reason_detail = Column(Text)
    is_permanent = Column(Boolean, default=False)
    auto_ignore_similar = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    anomaly = relationship("AnomalyRecord", back_populates="ignore_reasons")


class TicketLink(Base):
    __tablename__ = "ticket_links"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("anomaly_records.id"), nullable=False)
    ticket_system = Column(String(100), default="internal")
    ticket_id = Column(String(100), nullable=False)
    ticket_url = Column(String(500))
    ticket_title = Column(String(500))
    ticket_status = Column(String(50), default="open")
    operator_id = Column(String(100), nullable=False)
    operator_name = Column(String(200), nullable=False)
    linked_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime)

    anomaly = relationship("AnomalyRecord", back_populates="tickets")


class RecoveryEvent(Base):
    __tablename__ = "recovery_events"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("anomaly_records.id"), nullable=False)
    recovered_value = Column(Float)
    recovery_method = Column(String(100))
    recovery_details = Column(Text)
    detected_at = Column(DateTime, default=datetime.utcnow)
    auto_closed = Column(Boolean, default=False)

    anomaly = relationship("AnomalyRecord", back_populates="recovery_events")


class IdempotentRequest(Base):
    __tablename__ = "idempotent_requests"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String(64), unique=True, index=True, nullable=False)
    request_hash = Column(String(64), index=True)
    endpoint = Column(String(200))
    status = Column(String(20), default="processing")
    response_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)


class CompensationTask(Base):
    __tablename__ = "compensation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("anomaly_records.id"))
    task_type = Column(String(100), nullable=False)
    task_description = Column(Text)
    status = Column(String(20), default="pending")
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    last_error = Column(Text)
    executed_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
