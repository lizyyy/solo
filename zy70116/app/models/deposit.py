from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .common import IdMixin, TimestampMixin, AuditMixin


class DepositOrder(Base, IdMixin, TimestampMixin, AuditMixin):
    __tablename__ = "deposit_orders"

    order_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("prepaid_accounts.id"), index=True, nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True, nullable=False)
    
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    bonus_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_rule_id: Mapped[int] = mapped_column(ForeignKey("bonus_rules.id"), nullable=True)
    
    principal_remaining: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_remaining: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    status: Mapped[str] = mapped_column(String(16), default="completed", index=True, nullable=False)
    
    effective_date: Mapped[str] = mapped_column(String(10), nullable=True)
    expire_date: Mapped[str] = mapped_column(String(10), nullable=True)
    
    remark: Mapped[str] = mapped_column(String(255), nullable=True)
    
    is_void: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    void_reason: Mapped[str] = mapped_column(String(255), nullable=True)
    void_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    void_by: Mapped[str] = mapped_column(String(64), nullable=True)


class DepositConsumption(Base, IdMixin, TimestampMixin):
    __tablename__ = "deposit_consumptions"

    consume_order_id: Mapped[int] = mapped_column(ForeignKey("consume_orders.id"), index=True, nullable=False)
    deposit_order_id: Mapped[int] = mapped_column(ForeignKey("deposit_orders.id"), index=True, nullable=False)
    
    principal_used: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_used: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    consume_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    is_void: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class DepositRefund(Base, IdMixin, TimestampMixin):
    __tablename__ = "deposit_refunds"

    refund_order_id: Mapped[int] = mapped_column(ForeignKey("refund_orders.id"), index=True, nullable=False)
    deposit_order_id: Mapped[int] = mapped_column(ForeignKey("deposit_orders.id"), index=True, nullable=False)
    
    principal_refund: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_refund: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    bonus_forfeit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    refund_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
