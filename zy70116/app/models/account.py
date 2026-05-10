from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .common import IdMixin, TimestampMixin, AuditMixin


class PrepaidAccount(Base, IdMixin, TimestampMixin, AuditMixin):
    __tablename__ = "prepaid_accounts"

    account_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    member_id: Mapped[str] = mapped_column(String(64), index=True, nullable=True)
    member_name: Mapped[str] = mapped_column(String(64), nullable=True)
    
    principal_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    total_deposited: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_bonus: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_consumed: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_refunded: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    remark: Mapped[str] = mapped_column(String(255), nullable=True)
    
    @property
    def total_balance(self) -> Decimal:
        return self.principal_balance + self.bonus_balance


class BonusRule(Base, IdMixin, TimestampMixin, AuditMixin):
    __tablename__ = "bonus_rules"

    rule_name: Mapped[str] = mapped_column(String(64), nullable=False)
    
    min_deposit_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    max_deposit_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=True)
    
    bonus_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    bonus_rate: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=0, nullable=False)
    
    is_percentage: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    start_date: Mapped[str] = mapped_column(String(10), nullable=True)
    end_date: Mapped[str] = mapped_column(String(10), nullable=True)
    remark: Mapped[str] = mapped_column(String(255), nullable=True)
