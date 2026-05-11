from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base


class VisitStatus(str, enum.Enum):
    CREATED = "created"
    CHARGED = "charged"
    REFUNDED = "refunded"
    PARTIAL_REFUNDED = "partial_refunded"


class RefundType(str, enum.Enum):
    FULL = "full"
    PARTIAL = "partial"


class Supply(Base):
    __tablename__ = "supplies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    code = Column(String(50), unique=True, index=True)
    unit = Column(String(20))
    stock = Column(Float, default=0)
    safety_stock = Column(Float, default=0)
    cost_price = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TreatmentItem(Base):
    __tablename__ = "treatment_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    code = Column(String(50), unique=True, index=True)
    price = Column(Float, default=0)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    supply_templates = relationship("SupplyTemplate", back_populates="treatment_item")


class SupplyTemplate(Base):
    __tablename__ = "supply_templates"

    id = Column(Integer, primary_key=True, index=True)
    treatment_item_id = Column(Integer, ForeignKey("treatment_items.id"))
    supply_id = Column(Integer, ForeignKey("supplies.id"))
    quantity = Column(Float, default=0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    treatment_item = relationship("TreatmentItem", back_populates="supply_templates")
    supply = relationship("Supply")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    phone = Column(String(20), unique=True, index=True)
    id_card = Column(String(50), unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    visits = relationship("Visit", back_populates="patient")


class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    visit_number = Column(String(50), unique=True, index=True)
    visit_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default=VisitStatus.CREATED)
    total_amount = Column(Float, default=0)
    supply_cost = Column(Float, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="visits")
    visit_items = relationship("VisitItem", back_populates="visit")
    actual_supplies = relationship("ActualSupply", back_populates="visit")
    charges = relationship("Charge", back_populates="visit")
    refunds = relationship("Refund", back_populates="visit")


class VisitItem(Base):
    __tablename__ = "visit_items"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    treatment_item_id = Column(Integer, ForeignKey("treatment_items.id"))
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0)
    subtotal = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    visit = relationship("Visit", back_populates="visit_items")
    treatment_item = relationship("TreatmentItem")


class ActualSupply(Base):
    __tablename__ = "actual_supplies"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    supply_id = Column(Integer, ForeignKey("supplies.id"))
    template_quantity = Column(Float, default=0)
    actual_quantity = Column(Float, default=0)
    unit_cost = Column(Float, default=0)
    total_cost = Column(Float, default=0)
    is_additional = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    visit = relationship("Visit", back_populates="actual_supplies")
    supply = relationship("Supply")


class Charge(Base):
    __tablename__ = "charges"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    charge_number = Column(String(50), unique=True, index=True)
    amount = Column(Float, default=0)
    charge_date = Column(DateTime, default=datetime.utcnow)
    operator = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    visit = relationship("Visit", back_populates="charges")


class Refund(Base):
    __tablename__ = "refunds"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    charge_id = Column(Integer, ForeignKey("charges.id"))
    refund_number = Column(String(50), unique=True, index=True)
    refund_type = Column(String(20))
    amount = Column(Float, default=0)
    stock_rollback = Column(Boolean, default=False)
    rollback_reason = Column(Text, nullable=True)
    refund_date = Column(DateTime, default=datetime.utcnow)
    operator = Column(String(50), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    visit = relationship("Visit", back_populates="refunds")
    charge = relationship("Charge")
    refund_items = relationship("RefundItem", back_populates="refund")


class RefundItem(Base):
    __tablename__ = "refund_items"

    id = Column(Integer, primary_key=True, index=True)
    refund_id = Column(Integer, ForeignKey("refunds.id"))
    actual_supply_id = Column(Integer, ForeignKey("actual_supplies.id"), nullable=True)
    supply_id = Column(Integer, ForeignKey("supplies.id"))
    quantity = Column(Float, default=0)
    rollback_quantity = Column(Float, default=0)
    unit_cost = Column(Float, default=0)
    rollback_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    refund = relationship("Refund", back_populates="refund_items")
    supply = relationship("Supply")


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    id = Column(Integer, primary_key=True, index=True)
    supply_id = Column(Integer, ForeignKey("supplies.id"))
    transaction_type = Column(String(20))
    quantity = Column(Float, default=0)
    balance_after = Column(Float, default=0)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    supply = relationship("Supply")
