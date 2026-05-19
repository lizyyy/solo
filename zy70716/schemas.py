from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class ExemptionReviewResult(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"


class ExemptionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class FailureCaseConclusion(str, Enum):
    PENDING = "pending"
    FIXED = "fixed"
    EXEMPTED = "exempted"
    CLOSED = "closed"


VALID_REVIEW_RESULTS = {result.value for result in ExemptionReviewResult}
VALID_CONCLUSIONS = {result.value for result in FailureCaseConclusion}
VALID_EXEMPTION_STATUSES = {result.value for result in ExemptionStatus}


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

    @field_validator('conclusion')
    @classmethod
    def validate_conclusion(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_lower = v.lower()
        if v_lower not in VALID_CONCLUSIONS:
            raise ValueError(
                f"无效的结论: {v}. 有效值为: {', '.join(VALID_CONCLUSIONS)}"
            )
        return v_lower


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

    @field_validator('review_result')
    @classmethod
    def validate_review_result(cls, v: str) -> str:
        v_lower = v.lower()
        if v_lower not in VALID_REVIEW_RESULTS:
            raise ValueError(
                f"无效的审核结果: {v}. 有效值为: {', '.join(VALID_REVIEW_RESULTS)}"
            )
        return v_lower


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

    @field_validator('conclusion')
    @classmethod
    def validate_conclusion(cls, v: str) -> str:
        v_lower = v.lower()
        if v_lower not in VALID_CONCLUSIONS:
            raise ValueError(
                f"无效的结论: {v}. 有效值为: {', '.join(VALID_CONCLUSIONS)}"
            )
        return v_lower


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
