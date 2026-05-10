from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .common import IdMixin, TimestampMixin


class AccountJournal(Base, IdMixin, TimestampMixin):
    __tablename__ = "account_journals"

    journal_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("prepaid_accounts.id"), index=True, nullable=False)
    
    biz_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    biz_order_no: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    
    direction: Mapped[str] = mapped_column(String(8), nullable=False)
    
    principal_delta: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_delta: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_delta: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    principal_balance_after: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    bonus_balance_after: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    total_balance_after: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    
    journal_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    operator: Mapped[str] = mapped_column(String(64), nullable=True)
    remark: Mapped[str] = mapped_column(String(255), nullable=True)
    
    is_void: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    void_journal_id: Mapped[int] = mapped_column(Integer, nullable=True)


class OperationHistory(Base, IdMixin, TimestampMixin):
    __tablename__ = "operation_histories"

    biz_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    biz_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    
    operation_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    operator: Mapped[str] = mapped_column(String(64), nullable=True)
    
    before_snapshot: Mapped[str] = mapped_column(Text, nullable=True)
    after_snapshot: Mapped[str] = mapped_column(Text, nullable=True)
    
    reason: Mapped[str] = mapped_column(String(255), nullable=True)
    remark: Mapped[str] = mapped_column(String(255), nullable=True)
