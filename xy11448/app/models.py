from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    DATA_ENTRY = "data_entry"
    REVIEWER = "reviewer"
    SUPERVISOR = "supervisor"
    READ_ONLY = "read_only"


class AlertType(str, enum.Enum):
    OFFLINE = "offline"
    ABNORMAL = "abnormal"
    FAULT = "fault"
    WARNING = "warning"


class AlertStatus(str, enum.Enum):
    ACTIVE = "active"
    RECOVERED = "recovered"
    PROCESSED = "processed"


class InspectionStatus(str, enum.Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    PENDING = "pending"


class WorkOrderStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CLOSED = "closed"


class DataQuality(str, enum.Enum):
    VALID = "valid"
    INVALID = "invalid"
    PENDING = "pending"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100))
    email = Column(String(100))
    hashed_password = Column(String(200), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.READ_ONLY)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    audit_logs = relationship("AuditLog", back_populates="user")


class ChargingPile(Base):
    __tablename__ = "charging_piles"

    id = Column(Integer, primary_key=True, index=True)
    pile_code = Column(String(50), unique=True, index=True, nullable=False)
    pile_name = Column(String(100))
    location = Column(String(200))
    area = Column(String(100))
    manufacturer = Column(String(100))
    model = Column(String(50))
    install_date = Column(DateTime)
    is_online = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    alerts = relationship("PileAlert", back_populates="charging_pile")
    inspections = relationship("Inspection", back_populates="charging_pile")
    work_orders = relationship("WorkOrder", back_populates="charging_pile")


class PileAlert(Base):
    __tablename__ = "pile_alerts"

    id = Column(Integer, primary_key=True, index=True)
    pile_id = Column(Integer, ForeignKey("charging_piles.id"), nullable=False)
    alert_type = Column(Enum(AlertType), nullable=False)
    alert_code = Column(String(50))
    alert_message = Column(Text)
    alert_level = Column(Integer, default=1)
    status = Column(Enum(AlertStatus), default=AlertStatus.ACTIVE)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True))
    duration_minutes = Column(Float)
    data_quality = Column(Enum(DataQuality), default=DataQuality.PENDING)
    quality_issue = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    charging_pile = relationship("ChargingPile", back_populates="alerts")
    work_orders = relationship("WorkOrder", back_populates="alert")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    pile_id = Column(Integer, ForeignKey("charging_piles.id"), nullable=False)
    inspection_date = Column(DateTime(timezone=True), nullable=False)
    inspector = Column(String(100))
    status = Column(Enum(InspectionStatus), default=InspectionStatus.NORMAL)
    inspection_items = Column(Text)
    abnormal_items = Column(Text)
    remarks = Column(Text)
    data_quality = Column(Enum(DataQuality), default=DataQuality.PENDING)
    quality_issue = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    charging_pile = relationship("ChargingPile", back_populates="inspections")


class CustomerComplaint(Base):
    __tablename__ = "customer_complaints"

    id = Column(Integer, primary_key=True, index=True)
    complaint_no = Column(String(50), unique=True, index=True)
    pile_id = Column(Integer, ForeignKey("charging_piles.id"))
    customer_name = Column(String(100))
    customer_phone = Column(String(50))
    complaint_type = Column(String(100))
    complaint_content = Column(Text)
    complaint_time = Column(DateTime(timezone=True), nullable=False)
    handler = Column(String(100))
    handle_result = Column(Text)
    handle_time = Column(DateTime(timezone=True))
    data_quality = Column(Enum(DataQuality), default=DataQuality.PENDING)
    quality_issue = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SupervisorComment(Base):
    __tablename__ = "supervisor_comments"

    id = Column(Integer, primary_key=True, index=True)
    related_type = Column(String(50))
    related_id = Column(Integer)
    supervisor = Column(String(100))
    comment = Column(Text, nullable=False)
    comment_time = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True)
    pile_id = Column(Integer, ForeignKey("charging_piles.id"), nullable=False)
    alert_id = Column(Integer, ForeignKey("pile_alerts.id"))
    order_type = Column(String(100))
    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(Enum(WorkOrderStatus), default=WorkOrderStatus.PENDING)
    assignee = Column(String(100))
    priority = Column(Integer, default=1)
    due_date = Column(DateTime(timezone=True))
    actual_start_time = Column(DateTime(timezone=True))
    actual_end_time = Column(DateTime(timezone=True))
    duration_minutes = Column(Float)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    charging_pile = relationship("ChargingPile", back_populates="work_orders")
    alert = relationship("PileAlert", back_populates="work_orders")


class Reconciliation(Base):
    __tablename__ = "reconciliations"

    id = Column(Integer, primary_key=True, index=True)
    recon_date = Column(DateTime(timezone=True), nullable=False)
    pile_id = Column(Integer, ForeignKey("charging_piles.id"))
    alert_id = Column(Integer, ForeignKey("pile_alerts.id"))
    inspection_id = Column(Integer, ForeignKey("inspections.id"))
    complaint_id = Column(Integer, ForeignKey("customer_complaints.id"))
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    recon_status = Column(String(50))
    recon_result = Column(Text)
    fault_duration_minutes = Column(Float)
    monthly_fault_duration = Column(Float)
    remarks = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FailedData(Base):
    __tablename__ = "failed_data"

    id = Column(Integer, primary_key=True, index=True)
    data_type = Column(String(50))
    source_data = Column(Text)
    error_message = Column(Text)
    failed_at = Column(DateTime(timezone=True), server_default=func.now())
    retried = Column(Boolean, default=False)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(Integer)
    method = Column(String(20))
    path = Column(String(200))
    request_data = Column(Text)
    response_data = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(String(200))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")


class PlaybackRecord(Base):
    __tablename__ = "playback_records"

    id = Column(Integer, primary_key=True, index=True)
    pile_id = Column(Integer, ForeignKey("charging_piles.id"))
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    playback_type = Column(String(50))
    parameters = Column(Text)
    result = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
