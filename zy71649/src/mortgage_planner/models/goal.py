"""客户目标模型"""

from datetime import date
from enum import Enum
from typing import Optional
from decimal import Decimal

from pydantic import Field, model_validator

from .base import BaseModel, AuditMixin


class PrepayStrategy(str, Enum):
    """提前还款策略"""
    SHORTEN_TERM = "shorten_term"
    REDUCE_PAYMENT = "reduce_payment"
    MIXED = "mixed"
    LUMP_SUM = "lump_sum"


class Priority(str, Enum):
    """优先级"""
    INTEREST_SAVING = "interest_saving"
    CASHFLOW_FRIENDLY = "cashflow_friendly"
    BALANCED = "balanced"
    EARLY_PAYOFF = "early_payoff"


class ClientGoal(BaseModel, AuditMixin):
    """客户目标"""
    customer_id: str
    target_date: Optional[date] = None
    prepay_amount: Optional[Decimal] = Field(default=None, ge=0)
    prepay_strategy: PrepayStrategy = PrepayStrategy.SHORTEN_TERM
    priority: Priority = Priority.BALANCED
    target_monthly_payment: Optional[Decimal] = Field(default=None, ge=0)
    target_payoff_date: Optional[date] = None
    maximum_monthly_payment: Optional[Decimal] = Field(default=None, ge=0)
    minimum_monthly_surplus: Optional[Decimal] = Field(default=None, ge=0)
    expected_interest_saving: Optional[Decimal] = Field(default=None, ge=0)
    risk_preference: Optional[str] = None
    other_requirements: Optional[str] = None

    @model_validator(mode="after")
    def _validate_goals(self) -> "ClientGoal":
        if self.prepay_amount is None and self.target_payoff_date is None and self.target_monthly_payment is None:
            raise ValueError("必须至少指定一个目标：提前还款金额、目标结清日期或目标月供")
        if self.target_payoff_date and self.target_payoff_date < date.today():
            raise ValueError("目标结清日期不能早于今天")
        if self.maximum_monthly_payment and self.target_monthly_payment:
            if self.target_monthly_payment > self.maximum_monthly_payment:
                raise ValueError("目标月供不能大于可承受最大月供")
        return self

    @property
    def has_amount_goal(self) -> bool:
        """是否有金额目标"""
        return self.prepay_amount is not None

    @property
    def has_date_goal(self) -> bool:
        """是否有日期目标"""
        return self.target_payoff_date is not None

    @property
    def has_payment_goal(self) -> bool:
        """是否有月供目标"""
        return self.target_monthly_payment is not None
