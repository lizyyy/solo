from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class FailureCaseBase(BaseModel):
    page_path: str
    browser_matrix: Dict[str, str]
    failure_cases: List[Dict[str, Any]]
    reporter: str


class FailureCaseCreate(FailureCaseBase):
    pass


class FailureCaseUpdate(BaseModel):
    conclusion: Optional[str] = None
    conclusion_note: Optional[str] = None


class FailureCaseResponse(FailureCaseBase):
    id: int
    conclusion: str
    conclusion_note: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    exemption_status: Optional[str] = None
    active_exemption: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class ExemptionBase(BaseModel):
    failure_id: int
    exemption_reason: str
    exempt_browsers: List[str]
    expire_days: int
    applicant: str


class ExemptionCreate(ExemptionBase):
    pass


class ExemptionReview(BaseModel):
    review_result: str
    review_comment: Optional[str] = None
    reviewer: str


class ExemptionResponse(BaseModel):
    id: int
    failure_id: int
    exemption_reason: str
    exempt_browsers: List[str]
    expire_at: datetime
    applicant: str
    status: str
    review_result: Optional[str]
    review_comment: Optional[str]
    reviewer: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime
    is_expired: bool = False

    class Config:
        from_attributes = True


class ConclusionUpdate(BaseModel):
    conclusion: str
    conclusion_note: Optional[str] = None
    operator: str


class AuditLogResponse(BaseModel):
    id: int
    operation_type: str
    resource_type: str
    resource_id: int
    operator: str
    original_input: Optional[Dict[str, Any]]
    process_result: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True
