from datetime import datetime, date
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class OrderStatus(PyEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class ShortageStatus(PyEnum):
    IDENTIFIED = "identified"
    CONFIRMED = "confirmed"
    COMPENSATED = "compensated"
    SETTLED = "settled"
    CANCELLED = "cancelled"


class CompensationType(PyEnum):
    REFUND = "refund"
    EXCHANGE = "exchange"
    COUPON = "coupon"
    PARTIAL_REFUND = "partial_refund"


class CompensationStatus(PyEnum):
    PENDING = "pending"
    APPROVED = "approved"
    PROCESSED = "processed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class CouponStatus(PyEnum):
    ACTIVE = "active"
    USED = "used"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class SettlementStatus(PyEnum):
    PENDING = "pending"
    PROCESSED = "processed"
    RECONCILED = "reconciled"


class OperationType(PyEnum):
    IDENTIFY = "identify"
    CONFIRM = "confirm"
    COMPENSATE = "compensate"
    ROLLBACK = "rollback"
    SETTLE = "settle"
    EXPORT = "export"
    IMPORT = "import"


class AuditResult(PyEnum):
    ALLOWED = "allowed"
    BLOCKED = "blocked"


class Role(PyEnum):
    ADMIN = "admin"
    OPERATOR = "operator"
    FINANCE = "finance"
    CUSTOMER_SERVICE = "customer_service"
    VIEWER = "viewer"


class IdempotentKey(Base):
    __tablename__ = "idempotent_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, index=True, nullable=False)
    operation_type = Column(String(50), nullable=False)
    reference_id = Column(String(100))
    result_hash = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(String(100), index=True)
    customer_name = Column(String(100))
    customer_phone = Column(String(50))
    total_amount = Column(Float, nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    order_date = Column(DateTime, default=datetime.utcnow)
    delivery_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    items = relationship("OrderItem", back_populates="order")
    shortages = relationship("ShortageRecord", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(String(100), nullable=False)
    product_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)
    is_shortage = Column(Boolean, default=False)
    shortage_quantity = Column(Integer, default=0)
    
    order = relationship("Order", back_populates="items")
    shortages = relationship("ShortageRecord", back_populates="order_item")


class ShortageRecord(Base):
    __tablename__ = "shortage_records"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    order_item_id = Column(Integer, ForeignKey("order_items.id"))
    shortage_no = Column(String(50), unique=True, index=True, nullable=False)
    product_id = Column(String(100), nullable=False)
    product_name = Column(String(200), nullable=False)
    shortage_quantity = Column(Integer, nullable=False)
    shortage_amount = Column(Float, nullable=False)
    status = Column(Enum(ShortageStatus), default=ShortageStatus.IDENTIFIED)
    identified_by = Column(String(100))
    identified_at = Column(DateTime, default=datetime.utcnow)
    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime)
    settled_by = Column(String(100))
    settled_at = Column(DateTime)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    order = relationship("Order", back_populates="shortages")
    order_item = relationship("OrderItem", back_populates="shortages")
    compensations = relationship("CompensationRecord", back_populates="shortage")


class CompensationRecord(Base):
    __tablename__ = "compensation_records"
    
    id = Column(Integer, primary_key=True, index=True)
    shortage_id = Column(Integer, ForeignKey("shortage_records.id"), nullable=False)
    compensation_no = Column(String(50), unique=True, index=True, nullable=False)
    compensation_type = Column(Enum(CompensationType), nullable=False)
    amount = Column(Float, default=0)
    coupon_id = Column(String(100))
    coupon_value = Column(Float, default=0)
    exchange_product_id = Column(String(100))
    exchange_product_name = Column(String(200))
    status = Column(Enum(CompensationStatus), default=CompensationStatus.PENDING)
    operator_role = Column(String(50))
    operator_id = Column(String(100))
    operator_name = Column(String(100))
    approved_by = Column(String(100))
    approved_at = Column(DateTime)
    processed_at = Column(DateTime)
    rolled_back_by = Column(String(100))
    rolled_back_at = Column(DateTime)
    rollback_reason = Column(Text)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    shortage = relationship("ShortageRecord", back_populates="compensations")
    coupons = relationship("Coupon", back_populates="compensation")


class Coupon(Base):
    __tablename__ = "coupons"
    
    id = Column(Integer, primary_key=True, index=True)
    coupon_no = Column(String(50), unique=True, index=True, nullable=False)
    compensation_id = Column(Integer, ForeignKey("compensation_records.id"))
    customer_id = Column(String(100), index=True)
    value = Column(Float, nullable=False)
    min_order_amount = Column(Float, default=0)
    status = Column(Enum(CouponStatus), default=CouponStatus.ACTIVE)
    issue_date = Column(DateTime, default=datetime.utcnow)
    expiry_date = Column(DateTime, nullable=False)
    used_date = Column(DateTime)
    used_order_id = Column(String(50))
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    compensation = relationship("CompensationRecord", back_populates="coupons")


class SettlementRecord(Base):
    __tablename__ = "settlement_records"
    
    id = Column(Integer, primary_key=True, index=True)
    settlement_no = Column(String(50), unique=True, index=True, nullable=False)
    settlement_date = Column(Date, default=date.today)
    total_shortage_count = Column(Integer, default=0)
    total_shortage_amount = Column(Float, default=0)
    total_refund_amount = Column(Float, default=0)
    total_coupon_value = Column(Float, default=0)
    status = Column(Enum(SettlementStatus), default=SettlementStatus.PENDING)
    operator_role = Column(String(50))
    operator_id = Column(String(100))
    operator_name = Column(String(100))
    processed_at = Column(DateTime)
    reconciled_at = Column(DateTime)
    reconciled_by = Column(String(100))
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    items = relationship("SettlementItem", back_populates="settlement")


class SettlementItem(Base):
    __tablename__ = "settlement_items"
    
    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(Integer, ForeignKey("settlement_records.id"), nullable=False)
    shortage_id = Column(Integer, ForeignKey("shortage_records.id"), nullable=False)
    compensation_id = Column(Integer, ForeignKey("compensation_records.id"))
    shortage_amount = Column(Float, nullable=False)
    compensation_amount = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    settlement = relationship("SettlementRecord", back_populates="items")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), nullable=False)
    reference_type = Column(String(50))
    reference_id = Column(String(100))
    operator_role = Column(String(50))
    operator_id = Column(String(100))
    operator_name = Column(String(100))
    result = Column(String(20), nullable=False)
    reason = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(String(255))
    request_data = Column(Text)
    response_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class RuleConfig(Base):
    __tablename__ = "rule_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String(50), unique=True, index=True, nullable=False)
    rule_name = Column(String(100), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    config_data = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_by = Column(String(100))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
