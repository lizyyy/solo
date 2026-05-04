from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


class CoverageBase(BaseModel):
    policy_id: int
    coverage_type: str
    coverage_limit: Decimal
    deductible: Optional[Decimal] = None
    reimbursement_ratio: Decimal = Decimal("1.0")
    waiting_period_days: Optional[int] = None
    is_active: bool = True
    notes: Optional[str] = None


class CoverageCreate(CoverageBase):
    pass


class CoverageUpdate(CoverageBase):
    policy_id: Optional[int] = None
    coverage_type: Optional[str] = None
    coverage_limit: Optional[Decimal] = None


class CoverageResponse(CoverageBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
