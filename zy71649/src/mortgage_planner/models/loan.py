"""贷款合同模型"""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from decimal import Decimal

from pydantic import Field, field_validator, model_validator

from .base import BaseModel, AuditMixin


class RepaymentMethod(str, Enum):
    """还款方式"""
    EQUAL_PRINCIPAL_INTEREST = "equal_principal_interest"
    EQUAL_PRINCIPAL = "equal_principal"
    INTEREST_FIRST_THEN_PRINCIPAL = "interest_first"


class LoanContract(BaseModel, AuditMixin):
    """贷款合同"""
    contract_no: str
    customer_name: str
    customer_id: str
    loan_amount: Decimal = Field(gt=0)
    loan_term_months: int = Field(gt=0)
    annual_interest_rate: Decimal = Field(gt=0, le=1)
    repayment_method: RepaymentMethod = RepaymentMethod.EQUAL_PRINCIPAL_INTEREST
    start_date: date
    first_payment_date: date
    maturity_date: date
    lpr_based: bool = False
    lpr_adjustment_period_months: Optional[int] = None
    current_lpr_rate: Optional[Decimal] = Field(default=None, ge=0)
    lpr_margin: Optional[Decimal] = Field(default=None,)
    loan_purpose: Optional[str] = None
    property_address: Optional[str] = None
    bank_name: Optional[str] = None
    account_no: Optional[str] = None

    @field_validator("loan_term_months")
    @classmethod
    def _validate_term(cls, v: int) -> int:
        if v > 360:
            raise ValueError("贷款期限不能超过30年(360个月)")
        return v

    @field_validator("annual_interest_rate")
    @classmethod
    def _validate_rate(cls, v: Decimal) -> Decimal:
        if v > Decimal("0.5"):
            raise ValueError("年利率不能超过50%，请检查是否输入错误(如应为0.045而非4.5)")
        return v

    @model_validator(mode="after")
    def _validate_dates(self) -> "LoanContract":
        if self.start_date >= self.maturity_date:
            raise ValueError("贷款起始日期必须早于到期日期")
        if self.first_payment_date < self.start_date:
            raise ValueError("首次还款日期不能早于贷款起始日期")
        expected_maturity = self.start_date.replace(
            year=self.start_date.year + self.loan_term_months // 12,
            month=self.start_date.month + self.loan_term_months % 12
        )
        if expected_maturity != self.maturity_date:
            raise ValueError(
                f"到期日期与贷款期限不匹配，期望到期日: {expected_maturity.isoformat()}"
            )
        if self.lpr_based:
            if self.current_lpr_rate is None:
                raise ValueError("LPR定价贷款必须指定当前LPR利率")
            if self.lpr_margin is None:
                raise ValueError("LPR定价贷款必须指定LPR加点")
            actual_rate = self.current_lpr_rate + self.lpr_margin
            if actual_rate != self.annual_interest_rate:
                raise ValueError(
                    f"合同利率与LPR计算结果不匹配: "
                    f"LPR({self.current_lpr_rate}) + 加点({self.lpr_margin}) = {actual_rate} "
                    f"!= 合同利率({self.annual_interest_rate})"
                )
        return self

    @property
    def monthly_rate(self) -> Decimal:
        """月利率"""
        return self.annual_interest_rate / Decimal("12")

    @property
    def is_expired(self) -> bool:
        """是否已到期"""
        return date.today() > self.maturity_date

    def get_effective_rate(self, as_of: Optional[date] = None) -> Decimal:
        """获取指定日期的有效利率"""
        if not self.lpr_based:
            return self.annual_interest_rate
        return self.annual_interest_rate
