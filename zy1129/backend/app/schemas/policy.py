from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


class PolicyBase(BaseModel):
    policy_number: str
    insurance_company: str
    policy_type: str
    insured_member_id: Optional[int] = None
    start_date: date
    end_date: date
    waiting_period_days: int = 0
    deductible_amount: Decimal = Decimal("0.00")
    deductible_period: str = "annual"
    premium_amount: Optional[Decimal] = None
    payment_frequency: Optional[str] = None
    next_renewal_date: Optional[date] = None
    policy_file_path: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class PolicyCreate(PolicyBase):
    pass


class PolicyUpdate(PolicyBase):
    policy_number: Optional[str] = None
    insurance_company: Optional[str] = None
    policy_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class PolicyResponse(PolicyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
