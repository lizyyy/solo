from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.base import BaseResponse


class ReviewCreate(BaseModel):
    appeal_id: Optional[int] = None
    result_version_id: Optional[int] = None
    reviewer_id: str
    reviewer_name: str
    review_type: Optional[str] = None
    findings: str
    recommended_action: Optional[str] = None
    evidence_sources: Optional[str] = None
    notes: Optional[str] = None


class ReviewUpdate(BaseModel):
    status: Optional[str] = None
    findings: Optional[str] = None
    recommended_action: Optional[str] = None
    evidence_sources: Optional[str] = None
    decision: Optional[str] = None
    notes: Optional[str] = None


class ReviewResponse(BaseResponse):
    appeal_id: Optional[int]
    result_version_id: Optional[int]
    reviewer_id: str
    reviewer_name: str
    status: str
    review_type: Optional[str]
    findings: str
    recommended_action: Optional[str]
    evidence_sources: Optional[str]
    decision: Optional[str]
    approved_at: Optional[datetime]
    approved_by: Optional[str]
    notes: Optional[str]
