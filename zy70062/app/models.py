from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class DeviceCategory(Base):
    __tablename__ = "device_categories"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    priority_weight = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RepairOrder(Base):
    __tablename__ = "repair_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    classroom = Column(String(100), nullable=False)
    device_category_code = Column(String(50), ForeignKey("device_categories.code"), nullable=False)
    reported_by = Column(String(100), nullable=False)
    reporter_phone = Column(String(50))
    fault_description = Column(Text, nullable=False)
    fault_level = Column(String(20), default="normal")
    priority = Column(Integer, default=5)

    status = Column(String(30), default="pending", index=True)
    assigned_to = Column(String(100))
    assigned_at = Column(DateTime)
    completed_at = Column(DateTime)
    accepted_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    status_logs = relationship("StatusLog", back_populates="repair_order", cascade="all, delete-orphan")
    spare_usage = relationship("SpareUsage", back_populates="repair_order", cascade="all, delete-orphan")
    acceptance = relationship("AcceptanceRecord", back_populates="repair_order", uselist=False, cascade="all, delete-orphan")


class StatusLog(Base):
    __tablename__ = "status_logs"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"), nullable=False)
    from_status = Column(String(30))
    to_status = Column(String(30), nullable=False)
    operator = Column(String(100), nullable=False)
    remark = Column(Text)
    operation_key = Column(String(100), index=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    repair_order = relationship("RepairOrder", back_populates="status_logs")


class SparePart(Base):
    __tablename__ = "spare_parts"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    model = Column(String(100))
    unit = Column(String(20), default="个")
    stock_quantity = Column(Integer, default=0)
    unit_price = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    usages = relationship("SpareUsage", back_populates="spare_part")


class SpareUsage(Base):
    __tablename__ = "spare_usages"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"), nullable=False)
    spare_part_id = Column(Integer, ForeignKey("spare_parts.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    used_by = Column(String(100), nullable=False)
    remark = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    repair_order = relationship("RepairOrder", back_populates="spare_usage")
    spare_part = relationship("SparePart", back_populates="usages")


class RepairWorker(Base):
    __tablename__ = "repair_workers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(50))
    specialty_category = Column(String(100))
    is_available = Column(Boolean, default=True)
    current_load = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AcceptanceRecord(Base):
    __tablename__ = "acceptance_records"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"), nullable=False, unique=True)
    result = Column(String(30), nullable=False)
    accepted_by = Column(String(100), nullable=False)
    comment = Column(Text)
    solution_summary = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    repair_order = relationship("RepairOrder", back_populates="acceptance")
