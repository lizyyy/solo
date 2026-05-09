from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String,
    Text,
    Date,
    DateTime,
    Numeric,
    Integer,
    Boolean,
    ForeignKey,
    Enum,
    JSON,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base
from app.models.enums import (
    ContractStatus,
    DeliveryStatus,
    AcceptanceResult,
    PaymentStatus,
    WarningLevel,
    WarningType,
    CompensationStatus,
    CompensationType,
)


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contract_no: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    contract_name: Mapped[str] = mapped_column(String(200))
    supplier_name: Mapped[str] = mapped_column(String(200))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    
    sign_date: Mapped[date] = mapped_column(Date)
    effective_date: Mapped[date] = mapped_column(Date)
    expiry_date: Mapped[date] = mapped_column(Date)
    
    late_delivery_rate: Mapped[Decimal] = mapped_column(Numeric(6, 5), default=Decimal("0.001"))
    quality_penalty_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=Decimal("0.1"))
    
    status: Mapped[ContractStatus] = mapped_column(Enum(ContractStatus), default=ContractStatus.DRAFT)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    delivery_plans: Mapped[List["DeliveryPlan"]] = relationship("DeliveryPlan", back_populates="contract", cascade="all, delete-orphan")
    payment_nodes: Mapped[List["PaymentNode"]] = relationship("PaymentNode", back_populates="contract", cascade="all, delete-orphan")
    penalties: Mapped[List["PenaltyRecord"]] = relationship("PenaltyRecord", back_populates="contract", cascade="all, delete-orphan")
    warnings: Mapped[List["WarningRecord"]] = relationship("WarningRecord", back_populates="contract", cascade="all, delete-orphan")


class DeliveryPlan(Base):
    __tablename__ = "delivery_plans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"))
    batch_no: Mapped[str] = mapped_column(String(50))
    
    plan_delivery_date: Mapped[date] = mapped_column(Date)
    actual_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    
    plan_quantity: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    plan_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    actual_quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    actual_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    
    status: Mapped[DeliveryStatus] = mapped_column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    contract: Mapped[Contract] = relationship("Contract", back_populates="delivery_plans")
    acceptance: Mapped[Optional["AcceptanceReceipt"]] = relationship(
        "AcceptanceReceipt", 
        back_populates="delivery_plan", 
        uselist=False,
        cascade="all, delete-orphan"
    )
    penalties: Mapped[List["PenaltyRecord"]] = relationship("PenaltyRecord", back_populates="delivery_plan")


class AcceptanceReceipt(Base):
    __tablename__ = "acceptance_receipts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    delivery_plan_id: Mapped[int] = mapped_column(ForeignKey("delivery_plans.id"), unique=True)
    receipt_no: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    
    acceptance_date: Mapped[date] = mapped_column(Date)
    
    accepted_quantity: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    rejected_quantity: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    accepted_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    rejected_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    
    result: Mapped[AcceptanceResult] = mapped_column(Enum(AcceptanceResult), default=AcceptanceResult.PENDING)
    quality_issue_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=Decimal("0"))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    delivery_plan: Mapped[DeliveryPlan] = relationship("DeliveryPlan", back_populates="acceptance")
    penalties: Mapped[List["PenaltyRecord"]] = relationship("PenaltyRecord", back_populates="acceptance")


class PaymentNode(Base):
    __tablename__ = "payment_nodes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"))
    node_name: Mapped[str] = mapped_column(String(100))
    
    plan_payment_date: Mapped[date] = mapped_column(Date)
    actual_payment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    
    plan_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    actual_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    
    payment_ratio: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0"))
    
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    contract: Mapped[Contract] = relationship("Contract", back_populates="payment_nodes")


class PenaltyRecord(Base):
    __tablename__ = "penalty_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"))
    delivery_plan_id: Mapped[Optional[int]] = mapped_column(ForeignKey("delivery_plans.id"), nullable=True)
    acceptance_id: Mapped[Optional[int]] = mapped_column(ForeignKey("acceptance_receipts.id"), nullable=True)
    
    penalty_type: Mapped[str] = mapped_column(String(50))
    penalty_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    
    base_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    penalty_rate: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    late_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    calculation_details: Mapped[str] = mapped_column(Text)
    is_settled: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    contract: Mapped[Contract] = relationship("Contract", back_populates="penalties")
    delivery_plan: Mapped[Optional[DeliveryPlan]] = relationship("DeliveryPlan", back_populates="penalties")
    acceptance: Mapped[Optional[AcceptanceReceipt]] = relationship("AcceptanceReceipt", back_populates="penalties")


class WarningRecord(Base):
    __tablename__ = "warning_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"))
    
    warning_type: Mapped[WarningType] = mapped_column(Enum(WarningType))
    warning_level: Mapped[WarningLevel] = mapped_column(Enum(WarningLevel))
    
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    
    related_entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    contract: Mapped[Contract] = relationship("Contract", back_populates="warnings")


class CompensationTask(Base):
    __tablename__ = "compensation_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    warning_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    contract_id: Mapped[int] = mapped_column(Integer)
    
    task_type: Mapped[CompensationType] = mapped_column(Enum(CompensationType))
    task_data: Mapped[dict] = mapped_column(JSON, default=dict)
    
    status: Mapped[CompensationStatus] = mapped_column(Enum(CompensationStatus), default=CompensationStatus.PENDING)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
