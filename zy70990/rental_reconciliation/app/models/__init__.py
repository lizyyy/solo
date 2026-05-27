from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(String(50), primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    tenant_name = Column(String(100), nullable=False)
    tenant_phone = Column(String(20))
    room_no = Column(String(50), nullable=False)
    check_in_date = Column(DateTime, nullable=False)
    check_out_date = Column(DateTime, nullable=False)
    rental_amount = Column(Float, nullable=False)
    deposit_amount = Column(Float, nullable=False, default=2000.0)
    deposit_status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    meter_readings = relationship("MeterReading", back_populates="order", cascade="all, delete-orphan")
    deductions = relationship("Deduction", back_populates="order", cascade="all, delete-orphan")
    deposit_records = relationship("DepositRecord", back_populates="order", cascade="all, delete-orphan")
    review_records = relationship("ReviewRecord", back_populates="order", cascade="all, delete-orphan")


class MeterReading(Base):
    __tablename__ = "meter_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(50), ForeignKey("orders.id"), nullable=False)
    meter_type = Column(String(20), nullable=False)
    initial_reading = Column(Float, nullable=False)
    final_reading = Column(Float, nullable=False)
    unit = Column(String(20), default="kWh")
    photo_url = Column(String(500))
    reading_date = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="meter_readings")


class Deduction(Base):
    __tablename__ = "deductions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(50), ForeignKey("orders.id"), nullable=False)
    deduction_type = Column(String(50), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(Text)
    evidence_url = Column(String(500))
    is_verified = Column(Boolean, default=False)
    verified_by = Column(String(50))
    verified_at = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    order = relationship("Order", back_populates="deductions")


class DepositRecord(Base):
    __tablename__ = "deposit_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(50), ForeignKey("orders.id"), nullable=False)
    transaction_type = Column(String(20), nullable=False)
    amount = Column(Float, nullable=False)
    balance = Column(Float, nullable=False)
    reference_type = Column(String(50))
    reference_id = Column(String(50))
    operator = Column(String(50))
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="deposit_records")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(50), ForeignKey("orders.id"), nullable=False)
    review_type = Column(String(50), nullable=False)
    action = Column(String(20), nullable=False)
    before_value = Column(JSON)
    after_value = Column(JSON)
    reason = Column(Text)
    reviewer = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="review_records")


class ReconciliationReport(Base):
    __tablename__ = "reconciliation_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_no = Column(String(50), unique=True, index=True, nullable=False)
    order_id = Column(String(50), ForeignKey("orders.id"), nullable=False)
    report_data = Column(JSON, nullable=False)
    summary = Column(JSON, nullable=False)
    status = Column(String(20), default="draft")
    generated_by = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order")