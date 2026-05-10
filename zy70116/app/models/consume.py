from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .common import IdMixin, TimestampMixin, AuditMixin


class ConsumeOrder(Base, IdMixin, TimestampMixin, AuditMixin):
    __tablename__ = "consume_orders"

    order_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("prepaid_accounts.id"), index=True, nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True, nullable=False)
    
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    
    principal_paid: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_paid: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    other_paid: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    consume_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    status: Mapped[str] = mapped_column(String(16), default="completed", index=True, nullable=False)
    
    is_refundable: Mapped[bool] = mapped_column(Boolean, default=True)
    refunded_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    remark: Mapped[str] = mapped_column(String(255), nullable=True)
    
    is_void: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    void_reason: Mapped[str] = mapped_column(String(255), nullable=True)
    void_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    void_by: Mapped[str] = mapped_column(String(64), nullable=True)
    
    @property
    def refundable_amount(self) -> Decimal:
        return self.total_amount - self.refunded_amount
