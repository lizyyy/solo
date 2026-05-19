from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class OrderStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ShortageStatus(Enum):
    IDENTIFIED = "identified"
    CONFIRMED = "confirmed"
    COMPENSATED = "compensated"
    SETTLED = "settled"
    CANCELLED = "cancelled"
    ROLLED_BACK = "rolled_back"


class CompensationType(Enum):
    REFUND = "refund"
    EXCHANGE = "exchange"
    COUPON = "coupon"


class OperationType(Enum):
    IDENTIFY = "identify"
    CONFIRM = "confirm"
    COMPENSATE = "compensate"
    ROLLBACK = "rollback"
    SETTLE = "settle"


class OperationStatus(Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    order_no = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    user_name = Column(String(128))
    phone = Column(String(32))
    total_amount = Column(Float, nullable=False)
    status = Column(String(32), nullable=False, default=OrderStatus.PENDING.value)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    remark = Column(Text)

    shortages = relationship("ShortageRecord", back_populates="order")


class ShortageRecord(Base):
    __tablename__ = "shortage_records"

    id = Column(Integer, primary_key=True)
    shortage_no = Column(String(64), unique=True, nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(String(64), nullable=False)
    product_name = Column(String(256), nullable=False)
    sku_id = Column(String(64))
    sku_name = Column(String(128))
    shortage_quantity = Column(Integer, nullable=False)
    shortage_amount = Column(Float, nullable=False)
    status = Column(String(32), nullable=False, default=ShortageStatus.IDENTIFIED.value)
    identified_by = Column(String(64))
    identified_at = Column(DateTime)
    confirmed_by = Column(String(64))
    confirmed_at = Column(DateTime)
    settled_by = Column(String(64))
    settled_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    remark = Column(Text)

    order = relationship("Order", back_populates="shortages")
    compensations = relationship("CompensationRecord", back_populates="shortage")

    __table_args__ = (
        UniqueConstraint("order_id", "product_id", "sku_id", name="uix_order_product_sku"),
    )


class CompensationRecord(Base):
    __tablename__ = "compensation_records"

    id = Column(Integer, primary_key=True)
    compensation_no = Column(String(64), unique=True, nullable=False, index=True)
    shortage_id = Column(Integer, ForeignKey("shortage_records.id"), nullable=False)
    compensation_type = Column(String(32), nullable=False)
    compensation_amount = Column(Float, nullable=False)
    exchange_product_id = Column(String(64))
    exchange_product_name = Column(String(256))
    coupon_id = Column(String(64))
    coupon_name = Column(String(128))
    operator = Column(String(64), nullable=False)
    operated_at = Column(DateTime, default=datetime.now)
    is_rolled_back = Column(Integer, default=0)
    rolled_back_at = Column(DateTime)
    rolled_back_by = Column(String(64))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    remark = Column(Text)

    shortage = relationship("ShortageRecord", back_populates="compensations")


class SettlementRecord(Base):
    __tablename__ = "settlement_records"

    id = Column(Integer, primary_key=True)
    settlement_no = Column(String(64), unique=True, nullable=False, index=True)
    shortage_id = Column(Integer, ForeignKey("shortage_records.id"), nullable=False)
    total_compensation_amount = Column(Float, nullable=False)
    settlement_status = Column(String(32), nullable=False)
    operator = Column(String(64), nullable=False)
    operated_at = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    remark = Column(Text)

    shortage = relationship("ShortageRecord")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True)
    batch_no = Column(String(64), index=True)
    operation_type = Column(String(32), nullable=False)
    operation_status = Column(String(32), nullable=False)
    operator = Column(String(64), nullable=False)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    success_ids = Column(Text)
    failed_details = Column(Text)
    error_message = Column(Text)
    operated_at = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        Index("ix_operator_time", "operator", "operated_at"),
        Index("ix_type_status", "operation_type", "operation_status"),
    )


class IdempotentLock(Base):
    __tablename__ = "idempotent_locks"

    id = Column(Integer, primary_key=True)
    idempotent_key = Column(String(256), unique=True, nullable=False, index=True)
    operation_type = Column(String(32), nullable=False)
    resource_id = Column(String(128))
    result_data = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    expired_at = Column(DateTime, nullable=False)
