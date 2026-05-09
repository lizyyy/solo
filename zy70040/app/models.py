from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class PackageType:
    CYCLE_BOX = "cycle_box"
    THERMAL_BAG = "thermal_bag"
    PALLET = "pallet"

    ALL_TYPES = [CYCLE_BOX, THERMAL_BAG, PALLET]


class DepositStatus:
    PAID = "paid"
    PARTIAL_RETURNED = "partial_returned"
    FULL_RETURNED = "full_returned"
    CLOSED = "closed"


class RefundStatus:
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"


class DepositOrder(Base):
    __tablename__ = "deposit_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(String(50), index=True, nullable=False)
    customer_name = Column(String(100), nullable=False)

    cycle_box_count = Column(Integer, default=0)
    thermal_bag_count = Column(Integer, default=0)
    pallet_count = Column(Integer, default=0)

    cycle_box_deposit = Column(Float, default=0.0)
    thermal_bag_deposit = Column(Float, default=0.0)
    pallet_deposit = Column(Float, default=0.0)
    total_deposit = Column(Float, default=0.0)

    cycle_box_returned = Column(Integer, default=0)
    thermal_bag_returned = Column(Integer, default=0)
    pallet_returned = Column(Integer, default=0)

    cycle_box_damaged = Column(Integer, default=0)
    thermal_bag_damaged = Column(Integer, default=0)
    pallet_damaged = Column(Integer, default=0)

    cycle_box_deduction = Column(Float, default=0.0)
    thermal_bag_deduction = Column(Float, default=0.0)
    pallet_deduction = Column(Float, default=0.0)
    total_deduction = Column(Float, default=0.0)

    refunded_amount = Column(Float, default=0.0)
    refundable_amount = Column(Float, default=0.0)

    status = Column(String(20), default=DepositStatus.PAID, index=True)
    is_deleted = Column(Boolean, default=False)

    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scan_records = relationship("ScanRecord", back_populates="deposit_order")
    damage_records = relationship("DamageRecord", back_populates="deposit_order")
    refund_orders = relationship("RefundOrder", back_populates="deposit_order")


class ScanRecord(Base):
    __tablename__ = "scan_records"

    id = Column(Integer, primary_key=True, index=True)
    scan_no = Column(String(50), unique=True, index=True, nullable=False)
    deposit_order_id = Column(Integer, ForeignKey("deposit_orders.id"), nullable=False, index=True)

    package_type = Column(String(20), index=True, nullable=False)
    package_code = Column(String(100), index=True, nullable=False)
    quantity = Column(Integer, default=1)

    operator_id = Column(String(50), nullable=False)
    operator_name = Column(String(100), nullable=False)

    is_reversed = Column(Boolean, default=False)
    reversed_at = Column(DateTime, nullable=True)
    reversed_by = Column(String(50), nullable=True)
    reverse_reason = Column(Text, nullable=True)

    remark = Column(Text, nullable=True)
    scan_time = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    deposit_order = relationship("DepositOrder", back_populates="scan_records")


class DamageRecord(Base):
    __tablename__ = "damage_records"

    id = Column(Integer, primary_key=True, index=True)
    damage_no = Column(String(50), unique=True, index=True, nullable=False)
    deposit_order_id = Column(Integer, ForeignKey("deposit_orders.id"), nullable=False, index=True)

    package_type = Column(String(20), index=True, nullable=False)
    package_code = Column(String(100), index=True, nullable=False)
    quantity = Column(Integer, default=1)
    deduction_amount = Column(Float, default=0.0)

    damage_level = Column(String(20), nullable=True)
    damage_description = Column(Text, nullable=True)

    operator_id = Column(String(50), nullable=False)
    operator_name = Column(String(100), nullable=False)

    is_reversed = Column(Boolean, default=False)
    reversed_at = Column(DateTime, nullable=True)
    reversed_by = Column(String(50), nullable=True)
    reverse_reason = Column(Text, nullable=True)

    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    deposit_order = relationship("DepositOrder", back_populates="damage_records")


class RefundOrder(Base):
    __tablename__ = "refund_orders"

    id = Column(Integer, primary_key=True, index=True)
    refund_no = Column(String(50), unique=True, index=True, nullable=False)
    deposit_order_id = Column(Integer, ForeignKey("deposit_orders.id"), nullable=False, index=True)

    refund_amount = Column(Float, default=0.0)
    cycle_box_refund = Column(Float, default=0.0)
    thermal_bag_refund = Column(Float, default=0.0)
    pallet_refund = Column(Float, default=0.0)

    refund_method = Column(String(20), nullable=True)
    transaction_id = Column(String(100), nullable=True)

    status = Column(String(20), default=RefundStatus.PENDING, index=True)
    failed_reason = Column(Text, nullable=True)

    operator_id = Column(String(50), nullable=False)
    operator_name = Column(String(100), nullable=False)

    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    processed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    deposit_order = relationship("DepositOrder", back_populates="refund_orders")


class OperationHistory(Base):
    __tablename__ = "operation_history"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), index=True, nullable=False)
    operation_desc = Column(String(200), nullable=False)

    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    entity_no = Column(String(50), nullable=True)

    before_snapshot = Column(Text, nullable=True)
    after_snapshot = Column(Text, nullable=True)

    operator_id = Column(String(50), nullable=False)
    operator_name = Column(String(100), nullable=False)

    is_reverse = Column(Boolean, default=False)
    reverse_related_id = Column(Integer, nullable=True)

    remark = Column(Text, nullable=True)
    operation_time = Column(DateTime, default=datetime.utcnow, index=True)


class ReconciliationBatch(Base):
    __tablename__ = "reconciliation_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)

    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)

    total_orders = Column(Integer, default=0)
    total_deposit = Column(Float, default=0.0)
    total_refund = Column(Float, default=0.0)
    total_deduction = Column(Float, default=0.0)
    remaining_deposit = Column(Float, default=0.0)

    scan_matched = Column(Integer, default=0)
    scan_unmatched = Column(Integer, default=0)
    refund_matched = Column(Integer, default=0)
    refund_unmatched = Column(Integer, default=0)

    operator_id = Column(String(50), nullable=False)
    operator_name = Column(String(100), nullable=False)

    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
