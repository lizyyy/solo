from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


class ClaimBase(BaseModel):
    incident_id: int
    policy_id: int
    coverage_id: Optional[int] = None
    claim_number: str
    submit_date: Optional[date] = None
    claim_amount: Optional[Decimal] = None
    approved_amount: Optional[Decimal] = None
    deductible_applied: Optional[Decimal] = None
    status: str = "draft"
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class ClaimCreate(ClaimBase):
    pass


class ClaimUpdate(ClaimBase):
    incident_id: Optional[int] = None
    policy_id: Optional[int] = None
    claim_number: Optional[str] = None


class ClaimResponse(ClaimBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
