from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .common import IdMixin, TimestampMixin, AuditMixin


class StoreSettlement(Base, IdMixin, TimestampMixin, AuditMixin):
    __tablename__ = "store_settlements"

    settlement_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True, nullable=False)
    
    settlement_period: Mapped[str] = mapped_column(String(7), index=True, nullable=False)
    settlement_date: Mapped[str] = mapped_column(String(10), index=True, nullable=False)
    
    deposit_count: Mapped[int] = mapped_column(Integer, default=0)
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    consume_count: Mapped[int] = mapped_column(Integer, default=0)
    consume_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    refund_count: Mapped[int] = mapped_column(Integer, default=0)
    refund_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    net_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True, nullable=False)
    
    remark: Mapped[str] = mapped_column(String(255), nullable=True)


class SettlementDetail(Base, IdMixin, TimestampMixin):
    __tablename__ = "settlement_details"

    settlement_id: Mapped[int] = mapped_column(ForeignKey("store_settlements.id"), index=True, nullable=False)
    
    biz_type: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    order_no: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    order_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    
    principal_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    remark: Mapped[str] = mapped_column(String(255), nullable=True)
