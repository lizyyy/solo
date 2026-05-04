from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class RiskReason(BaseModel):
    type: str
    message: str
    severity: str


class ToDoItem(BaseModel):
    action: str
    description: str
    deadline: Optional[str] = None
    priority: str = "medium"


class ClaimCalculationResult(BaseModel):
    incident_id: int
    policy_id: int
    policy_number: str
    insurance_company: str
    is_coverable: bool
    risk_reasons: List[RiskReason]
    to_do_items: List[ToDoItem]
    estimated_claimable_amount: Optional[Decimal] = None
    waiting_period_status: str
    deductible_status: str
    report_deadline_status: str
    notes: Optional[str] = None


class ClaimAnalysisResponse(BaseModel):
    incident_id: int
    incident_number: str
    incident_type: str
    incident_date: str
    affected_member_name: Optional[str] = None
    calculations: List[ClaimCalculationResult]
    overall_summary: str
    total_estimated_claimable: Decimal
