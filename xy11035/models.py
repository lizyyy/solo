from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import enum
from datetime import datetime


class UrgentStatus(str, enum.Enum):
    NORMAL = "normal"
    REJECTED = "rejected"
    SUPPLEMENTED = "supplemented"
    COMPLETED = "completed"


class PrintUrgentOrder(Base):
    __tablename__ = "print_urgent_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    document_name = Column(String(200), nullable=False)
    page_count = Column(Integer, nullable=False)
    color_mode = Column(String(20), nullable=False)
    paper_size = Column(String(20), nullable=False)
    double_sided = Column(Boolean, default=False)
    binding_type = Column(String(50))
    original_promised_time = Column(DateTime, nullable=False)
    new_promised_time = Column(DateTime)
    urgent_reason = Column(Text, nullable=False)
    queue_position_before = Column(Integer)
    queue_position_after = Column(Integer)
    status = Column(String(20), default=UrgentStatus.NORMAL)
    reject_reason = Column(Text)
    supplement_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    operator = Column(String(50), nullable=False)

    capacity_logs = relationship("CapacityLog", back_populates="urgent_order")


class CapacityLog(Base):
    __tablename__ = "capacity_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_no = Column(String(50), unique=True, index=True, nullable=False)
    urgent_order_id = Column(Integer, ForeignKey("print_urgent_orders.id"))
    log_type = Column(String(30), nullable=False)
    affected_order_no = Column(String(50))
    original_delivery_time = Column(DateTime)
    new_delivery_time = Column(DateTime)
    capacity_impact = Column(Float, nullable=False)
    impact_description = Column(Text, nullable=False)
    is_rollback = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    operator = Column(String(50), nullable=False)

    urgent_order = relationship("PrintUrgentOrder", back_populates="capacity_logs")
