from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .common import IdMixin, TimestampMixin, AuditMixin


class RefundRequest(Base, IdMixin, TimestampMixin, AuditMixin):
    __tablename__ = "refund_requests"

    request_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("prepaid_accounts.id"), index=True, nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True, nullable=False)
    
    requested_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    
    reason_type: Mapped[str] = mapped_column(String(32), nullable=True)
    reason_detail: Mapped[str] = mapped_column(Text, nullable=True)
    
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True, nullable=False)
    
    approver_id: Mapped[str] = mapped_column(String(64), nullable=True)
    approval_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    approval_remark: Mapped[str] = mapped_column(String(255), nullable=True)
    
    reject_reason: Mapped[str] = mapped_column(String(255), nullable=True)
    reject_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    is_withdrawn: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    withdraw_reason: Mapped[str] = mapped_column(String(255), nullable=True)
    withdraw_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    withdraw_by: Mapped[str] = mapped_column(String(64), nullable=True)
    
    refund_order_id: Mapped[int] = mapped_column(ForeignKey("refund_orders.id"), nullable=True)


class RefundOrder(Base, IdMixin, TimestampMixin, AuditMixin):
    __tablename__ = "refund_orders"

    order_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    request_id: Mapped[int] = mapped_column(ForeignKey("refund_requests.id"), nullable=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("prepaid_accounts.id"), index=True, nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True, nullable=False)
    
    total_refund: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    
    principal_refund: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_refund: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_forfeit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    refund_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    status: Mapped[str] = mapped_column(String(16), default="completed", index=True, nullable=False)
    
    remark: Mapped[str] = mapped_column(String(255), nullable=True)
    
    is_void: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    void_reason: Mapped[str] = mapped_column(String(255), nullable=True)
    void_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    void_by: Mapped[str] = mapped_column(String(64), nullable=True)


class RefundConsume(Base, IdMixin, TimestampMixin):
    __tablename__ = "refund_consumes"

    refund_order_id: Mapped[int] = mapped_column(ForeignKey("refund_orders.id"), index=True, nullable=False)
    consume_order_id: Mapped[int] = mapped_column(ForeignKey("consume_orders.id"), index=True, nullable=False)
    
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    principal_return: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_return: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    refund_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
