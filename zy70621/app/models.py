from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class BuildingRoom(Base):
    __tablename__ = "building_rooms"

    id = Column(Integer, primary_key=True, index=True)
    building = Column(String(50), index=True)
    room_number = Column(String(50), index=True)
    owner_name = Column(String(100))
    owner_phone = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    repair_orders = relationship("RepairOrder", back_populates="building_room")


class Handler(Base):
    __tablename__ = "handlers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    phone = Column(String(20))
    department = Column(String(100))
    role = Column(String(50))
    is_outsource = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    repair_orders = relationship("RepairOrder", back_populates="handler")
    outsource_orders = relationship("OutsourceOrder", back_populates="outsource_company")


class RepairOrder(Base):
    __tablename__ = "repair_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True)
    building_room_id = Column(Integer, ForeignKey("building_rooms.id"))
    repair_type = Column(String(100))
    description = Column(Text)
    contact_name = Column(String(100))
    contact_phone = Column(String(20))
    status = Column(String(50), default="pending")
    priority = Column(String(20), default="normal")
    handler_id = Column(Integer, ForeignKey("handlers.id"), nullable=True)
    reported_at = Column(DateTime(timezone=True), server_default=func.now())
    expected_completion_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    sla_hours = Column(Integer, default=24)
    is_overdue = Column(Boolean, default=False)
    is_merged = Column(Boolean, default=False)
    merged_into_order_id = Column(Integer, nullable=True)
    reminder_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    building_room = relationship("BuildingRoom", back_populates="repair_orders")
    handler = relationship("Handler", back_populates="repair_orders")
    reminders = relationship("Reminder", back_populates="repair_order", cascade="all, delete-orphan")
    outsource_order = relationship("OutsourceOrder", back_populates="repair_order", uselist=False)
    completion_proof = relationship("CompletionProof", back_populates="repair_order", uselist=False)
    status_logs = relationship("StatusLog", back_populates="repair_order", cascade="all, delete-orphan")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    reminder_type = Column(String(50), default="normal")
    content = Column(Text)
    reminded_by = Column(String(100))
    reminded_at = Column(DateTime(timezone=True), server_default=func.now())
    is_duplicate = Column(Boolean, default=False)
    duplicate_of_reminder_id = Column(Integer, nullable=True)

    repair_order = relationship("RepairOrder", back_populates="reminders")


class OutsourceOrder(Base):
    __tablename__ = "outsource_orders"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    outsource_company_id = Column(Integer, ForeignKey("handlers.id"))
    outsource_order_no = Column(String(50), unique=True, index=True)
    status = Column(String(50), default="dispatched")
    dispatched_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    estimated_cost = Column(Float, nullable=True)
    actual_cost = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    repair_order = relationship("RepairOrder", back_populates="outsource_order")
    outsource_company = relationship("Handler", back_populates="outsource_orders")


class CompletionProof(Base):
    __tablename__ = "completion_proofs"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    proof_type = Column(String(50))
    proof_url = Column(String(500), nullable=True)
    description = Column(Text)
    verified_by = Column(String(100), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    is_verified = Column(Boolean, default=False)
    verification_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    repair_order = relationship("RepairOrder", back_populates="completion_proof")


class StatusLog(Base):
    __tablename__ = "status_logs"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50))
    operated_by = Column(String(100))
    operation_type = Column(String(50))
    notes = Column(Text, nullable=True)
    original_request = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    repair_order = relationship("RepairOrder", back_populates="status_logs")