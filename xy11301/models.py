from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ACCEPTED = "accepted"
    REWORK_REQUIRED = "rework_required"
    CLOSED = "closed"


class DeductionType(str, enum.Enum):
    QUALITY = "quality"
    TIMELINESS = "timeliness"
    ATTITUDE = "attitude"
    DAMAGE = "damage"
    OTHER = "other"


class Role(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    OPERATOR = "operator"
    CLEANER = "cleaner"
    FINANCE = "finance"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True)
    room_number = Column(String, index=True)
    room_type = Column(String)
    guest_name = Column(String)
    guest_phone = Column(String)
    checkin_date = Column(DateTime)
    checkout_date = Column(DateTime)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    cleaner_id = Column(Integer, nullable=True)
    cleaner_name = Column(String, nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    estimated_amount = Column(Float, default=0)
    final_amount = Column(Float, default=0)
    remarks = Column(Text, nullable=True)
    created_by = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, onupdate=func.now())

    acceptances = relationship("Acceptance", back_populates="order")
    reworks = relationship("Rework", back_populates="order")
    deductions = relationship("Deduction", back_populates="order")
    settlement = relationship("Settlement", back_populates="order", uselist=False)


class Acceptance(Base):
    __tablename__ = "acceptances"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    passed = Column(Boolean)
    quality_score = Column(Integer, nullable=True)
    photo_urls = Column(Text, nullable=True)
    issues_found = Column(Text, nullable=True)
    inspector_id = Column(String)
    inspector_name = Column(String)
    inspected_at = Column(DateTime, server_default=func.now())
    remarks = Column(Text, nullable=True)
    created_by = Column(String)
    created_at = Column(DateTime, server_default=func.now())

    order = relationship("Order", back_populates="acceptances")


class Rework(Base):
    __tablename__ = "reworks"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    acceptance_id = Column(Integer, ForeignKey("acceptances.id"))
    reason = Column(Text)
    assigned_to = Column(String)
    assigned_name = Column(String)
    deadline = Column(DateTime)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    rework_count = Column(Integer, default=1)
    remarks = Column(Text, nullable=True)
    created_by = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, onupdate=func.now())

    order = relationship("Order", back_populates="reworks")


class Deduction(Base):
    __tablename__ = "deductions"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    rework_id = Column(Integer, ForeignKey("reworks.id"), nullable=True)
    deduction_type = Column(Enum(DeductionType))
    amount = Column(Float)
    reason = Column(Text)
    evidence_urls = Column(Text, nullable=True)
    approved = Column(Boolean, default=False)
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_by = Column(String)
    created_at = Column(DateTime, server_default=func.now())

    order = relationship("Order", back_populates="deductions")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    cleaner_id = Column(Integer)
    cleaner_name = Column(String)
    base_amount = Column(Float)
    total_deductions = Column(Float)
    final_settlement = Column(Float)
    settlement_month = Column(String)
    paid = Column(Boolean, default=False)
    paid_at = Column(DateTime, nullable=True)
    paid_by = Column(String, nullable=True)
    remarks = Column(Text, nullable=True)
    created_by = Column(String)
    created_at = Column(DateTime, server_default=func.now())

    order = relationship("Order", back_populates="settlement")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, index=True)
    entity_type = Column(String)
    entity_id = Column(Integer)
    operator_id = Column(String)
    operator_name = Column(String)
    operator_role = Column(Enum(Role))
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class BatchOperation(Base):
    __tablename__ = "batch_operations"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True)
    operation_type = Column(String)
    total_count = Column(Integer)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(String, default="processing")
    error_details = Column(Text, nullable=True)
    created_by = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
