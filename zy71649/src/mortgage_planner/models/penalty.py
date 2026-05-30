"""违约金规则模型"""

from datetime import date
from enum import Enum
from typing import Optional, Union
from decimal import Decimal

from pydantic import Field, field_validator, model_validator

from .base import BaseModel, AuditMixin


class PenaltyType(str, Enum):
    """违约金类型"""
    FIXED_AMOUNT = "fixed_amount"
    PRINCIPAL_RATIO = "principal_ratio"
    INTEREST_MONTHS = "interest_months"
    NO_PENALTY = "no_penalty"
    TIERED = "tiered"


class PenaltyTier(BaseModel):
    """违约金阶梯"""
    min_months: int = Field(ge=0)
    max_months: Optional[int] = Field(default=None, ge=1)
    penalty_type: PenaltyType
    penalty_value: Decimal = Field(ge=0)
    description: Optional[str] = None

    @model_validator(mode="after")
    def _validate_range(self) -> "PenaltyTier":
        if self.max_months is not None and self.min_months >= self.max_months:
            raise ValueError("最小月数必须小于最大月数")
        return self


class PenaltyRule(BaseModel, AuditMixin):
    """违约金规则"""
    contract_no: str
    rule_name: str
    rule_effective_date: date
    rule_expiry_date: Optional[date] = None
    penalty_type: PenaltyType
    penalty_value: Decimal = Field(default=Decimal("0"), ge=0)
    tiers: list[PenaltyTier] = Field(default_factory=list)
    min_months_to_prepay: int = Field(default=0, ge=0)
    min_prepay_amount: Decimal = Field(default=Decimal("10000"), ge=0)
    max_prepay_times_per_year: Optional[int] = Field(default=None, ge=1)
    prepay_date_restriction: Optional[str] = None
    special_conditions: Optional[str] = None
    source_document: Optional[str] = None

    @field_validator("penalty_value")
    @classmethod
    def _validate_penalty_value(cls, v: Decimal, info) -> Decimal:
        if info.data.get("penalty_type") == PenaltyType.PRINCIPAL_RATIO:
            if v > Decimal("0.5"):
                raise ValueError("比例型违约金不能超过50%，请检查是否输入错误(如应为0.03而非3)")
        return v

    @model_validator(mode="after")
    def _validate_rule(self) -> "PenaltyRule":
        if self.penalty_type == PenaltyType.TIERED and not self.tiers:
            raise ValueError("阶梯型违约金必须指定阶梯规则")
        if self.rule_expiry_date and self.rule_effective_date >= self.rule_expiry_date:
            raise ValueError("规则生效日期必须早于失效日期")
        return self

    def is_applicable(self, repayment_date: date) -> bool:
        """检查规则是否适用于指定日期"""
        if repayment_date < self.rule_effective_date:
            return False
        if self.rule_expiry_date and repayment_date >= self.rule_expiry_date:
            return False
        return True

    def get_applicable_tier(self, paid_months: int) -> Optional[PenaltyTier]:
        """获取适用的违约金阶梯"""
        for tier in self.tiers:
            if paid_months >= tier.min_months:
                if tier.max_months is None or paid_months < tier.max_months:
                    return tier
        return None
