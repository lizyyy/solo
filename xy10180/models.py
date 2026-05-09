from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text, Enum, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import enum


class MaintenanceStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"
    CANCELLED = "cancelled"


class RuleType(enum.Enum):
    HOURS = "hours"
    COUNT = "count"
    DATE = "date"


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    model = Column(String(100))
    serial_number = Column(String(100), unique=True, index=True)
    total_hours = Column(Float, default=0.0)
    total_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rules = relationship("MaintenanceRule", back_populates="device", cascade="all, delete-orphan")
    orders = relationship("MaintenanceOrder", back_populates="device", cascade="all, delete-orphan")


class MaintenanceRule(Base):
    __tablename__ = "maintenance_rules"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    name = Column(String(100), nullable=False)
    rule_type = Column(Enum(RuleType), nullable=False)
    threshold_value = Column(Float, nullable=False)
    description = Column(Text)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device", back_populates="rules")
    parts = relationship("RulePart", back_populates="rule", cascade="all, delete-orphan")


class RulePart(Base):
    __tablename__ = "rule_parts"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("maintenance_rules.id"), nullable=False)
    part_name = Column(String(100), nullable=False)
    part_code = Column(String(50))
    quantity = Column(Integer, default=1)

    rule = relationship("MaintenanceRule", back_populates="parts")


class MaintenanceOrder(Base):
    __tablename__ = "maintenance_orders"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    rule_id = Column(Integer, ForeignKey("maintenance_rules.id"))
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    idempotent_key = Column(String(100), unique=True, index=True, nullable=False)
    trigger_type = Column(Enum(RuleType), nullable=False)
    trigger_value = Column(Float, nullable=False)
    scheduled_date = Column(Date)
    due_date = Column(Date)
    status = Column(Enum(MaintenanceStatus), default=MaintenanceStatus.PENDING)
    description = Column(Text)
    completion_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    delay_count = Column(Integer, default=0)
    original_due_date = Column(Date)

    device = relationship("Device", back_populates="orders")
    parts = relationship("OrderPart", back_populates="order", cascade="all, delete-orphan")
    history = relationship("MaintenanceHistory", back_populates="order", cascade="all, delete-orphan")


class OrderPart(Base):
    __tablename__ = "order_parts"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("maintenance_orders.id"), nullable=False)
    part_name = Column(String(100), nullable=False)
    part_code = Column(String(50))
    quantity = Column(Integer, default=1)
    is_reserved = Column(Integer, default=1)
    reserved_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("MaintenanceOrder", back_populates="parts")


class MaintenanceHistory(Base):
    __tablename__ = "maintenance_history"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("maintenance_orders.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    action = Column(String(50), nullable=False)
    from_status = Column(Enum(MaintenanceStatus))
    to_status = Column(Enum(MaintenanceStatus))
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("MaintenanceOrder", back_populates="history")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    part_code = Column(String(50), unique=True, index=True, nullable=False)
    part_name = Column(String(100), nullable=False)
    total_quantity = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
