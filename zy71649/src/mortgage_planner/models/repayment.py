"""还款流水模型"""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from decimal import Decimal

from pydantic import Field, field_validator, model_validator

from .base import BaseModel, AuditMixin


class RepaymentStatus(str, Enum):
    """还款状态"""
    NORMAL = "normal"
    PREPAID = "prepaid"
    OVERDUE = "overdue"
    SETTLED = "settled"
    FAILED = "failed"


class RepaymentRecord(BaseModel, AuditMixin):
    """还款记录"""
    contract_no: str
    repayment_date: date
    period_no: int = Field(ge=1)
    total_amount: Decimal = Field(ge=0)
    principal_amount: Decimal = Field(ge=0)
    interest_amount: Decimal = Field(ge=0)
    penalty_amount: Decimal = Field(default=Decimal("0"), ge=0)
    overdue_amount: Decimal = Field(default=Decimal("0"), ge=0)
    remaining_principal: Decimal = Field(ge=0)
    status: RepaymentStatus = RepaymentStatus.NORMAL
    is_prepayment: bool = False
    prepayment_type: Optional[str] = None
    payment_method: Optional[str] = None
    transaction_no: Optional[str] = None
    bank_remark: Optional[str] = None

    @field_validator("period_no")
    @classmethod
    def _validate_period(cls, v: int) -> int:
        if v > 360:
            raise ValueError("期数不能超过360期")
        return v

    @model_validator(mode="after")
    def _validate_amounts(self) -> "RepaymentRecord":
        calculated_total = (
            self.principal_amount
            + self.interest_amount
            + self.penalty_amount
            + self.overdue_amount
        )
        if abs(calculated_total - self.total_amount) > Decimal("0.01"):
            raise ValueError(
                f"还款金额不匹配: 本金({self.principal_amount}) + 利息({self.interest_amount}) "
                f"+ 违约金({self.penalty_amount}) + 逾期({self.overdue_amount}) "
                f"= {calculated_total} != 合计({self.total_amount})"
            )
        if self.is_prepayment and self.prepayment_type is None:
            raise ValueError("提前还款必须指定提前还款类型")
        return self

    @property
    def is_on_time(self) -> bool:
        """是否按时还款"""
        return self.status != RepaymentStatus.OVERDUE
