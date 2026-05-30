"""收入预算模型"""

from datetime import date
from typing import Optional, List
from decimal import Decimal
from enum import Enum

from pydantic import Field, field_validator, model_validator

from .base import BaseModel, AuditMixin


class IncomeType(str, Enum):
    """收入类型"""
    SALARY = "salary"
    BONUS = "bonus"
    RENTAL = "rental"
    INVESTMENT = "investment"
    BUSINESS = "business"
    OTHER = "other"


class ExpenseType(str, Enum):
    """支出类型"""
    LIVING = "living"
    EDUCATION = "education"
    MEDICAL = "medical"
    INSURANCE = "insurance"
    UTILITIES = "utilities"
    TRANSPORTATION = "transportation"
    ENTERTAINMENT = "entertainment"
    OTHER_LOAN = "other_loan"
    OTHER = "other"


class IncomeExpense(BaseModel):
    """收支项"""
    item_type: str
    category: str
    amount: Decimal = Field(ge=0)
    is_monthly: bool = True
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None


class Budget(BaseModel, AuditMixin):
    """家庭预算"""
    customer_id: str
    budget_month: date
    monthly_household_income: Decimal = Field(ge=0)
    monthly_household_expense: Decimal = Field(ge=0)
    monthly_mortgage_payment: Decimal = Field(ge=0)
    monthly_surplus: Decimal = Field()
    total_assets: Optional[Decimal] = Field(default=None, ge=0)
    total_liabilities: Optional[Decimal] = Field(default=None, ge=0)
    emergency_fund: Optional[Decimal] = Field(default=None, ge=0)
    available_cash: Optional[Decimal] = Field(default=None, ge=0)
    income_details: List[IncomeExpense] = Field(default_factory=list)
    expense_details: List[IncomeExpense] = Field(default_factory=list)
    risk_tolerance: Optional[str] = None
    future_income_change: Optional[str] = None
    major_expense_plan: Optional[str] = None

    @model_validator(mode="after")
    def _calculate_surplus(self) -> "Budget":
        if self.monthly_surplus == Decimal("0"):
            self.monthly_surplus = (
                self.monthly_household_income
                - self.monthly_household_expense
                - self.monthly_mortgage_payment
            )
        return self

    @field_validator("budget_month")
    @classmethod
    def _validate_budget_month(cls, v: date) -> date:
        if v.day != 1:
            return v.replace(day=1)
        return v

    @property
    def debt_service_ratio(self) -> Optional[Decimal]:
        """债务收入比"""
        if self.monthly_household_income == 0:
            return None
        return self.monthly_mortgage_payment / self.monthly_household_income

    @property
    def savings_rate(self) -> Optional[Decimal]:
        """储蓄率"""
        if self.monthly_household_income == 0:
            return None
        return self.monthly_surplus / self.monthly_household_income

    @property
    def net_asset(self) -> Optional[Decimal]:
        """净资产"""
        if self.total_assets is None or self.total_liabilities is None:
            return None
        return self.total_assets - self.total_liabilities

    def get_max_prepay_amount(self, retain_emergency_months: int = 6) -> Decimal:
        """计算最大可提前还款金额"""
        if self.available_cash is None:
            return Decimal("0")
        emergency_need = self.monthly_household_expense * Decimal(str(retain_emergency_months))
        return max(Decimal("0"), self.available_cash - emergency_need)
