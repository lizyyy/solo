from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from ..models.models import (
    RuleType,
    RuleStatus,
    ReviewStatus,
    GrayEffectStatus
)


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    details: Optional[str] = None


class TermLibraryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    created_by: str = Field(..., max_length=50)


class TermLibraryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TermLibraryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TermLibraryVersionCreate(BaseModel):
    library_id: int
    version: str = Field(..., max_length=50)
    description: Optional[str] = None
    created_by: str = Field(..., max_length=50)


class TermLibraryVersionResponse(BaseModel):
    id: int
    library_id: int
    version: str
    description: Optional[str]
    is_current: bool
    created_by: str
    created_at: datetime
    deployed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class TermRuleCreate(BaseModel):
    library_id: int
    rule_type: RuleType
    term: str = Field(..., max_length=200)
    match_type: str = Field(default="exact", max_length=20)
    priority: int = Field(default=0)
    action: str = Field(default="filter", max_length=50)
    reason: Optional[str] = None
    created_by: str = Field(..., max_length=50)


class TermRuleUpdate(BaseModel):
    term: Optional[str] = Field(None, max_length=200)
    match_type: Optional[str] = Field(None, max_length=20)
    priority: Optional[int] = None
    action: Optional[str] = Field(None, max_length=50)
    reason: Optional[str] = None


class StatusTransitionRequest(BaseModel):
    target_status: RuleStatus
    actor: str
    reason: Optional[str] = None
    details: Optional[str] = None


class TermRuleResponse(BaseModel):
    id: int
    library_id: int
    version_id: Optional[int]
    rule_type: RuleType
    term: str
    match_type: str
    priority: int
    action: str
    reason: Optional[str]
    status: RuleStatus
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ReviewRequestCreate(BaseModel):
    rule_id: int
    comments: Optional[str] = None
    requested_by: str = Field(..., max_length=50)


class ReviewApproveRequest(BaseModel):
    review_id: int
    approved: bool
    reviewer: str = Field(..., max_length=50)
    review_comment: Optional[str] = None


class ReviewRequestResponse(BaseModel):
    id: int
    rule_id: int
    status: ReviewStatus
    requested_by: str
    reviewer: Optional[str]
    comments: Optional[str]
    review_comment: Optional[str]
    requested_at: datetime
    reviewed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class GrayReleaseCreate(BaseModel):
    rule_id: int
    version_id: Optional[int] = None
    traffic_percentage: float = Field(default=10.0, ge=1.0, le=100.0)
    created_by: str = Field(..., max_length=50)


class GrayReleaseResponse(BaseModel):
    id: int
    rule_id: int
    version_id: Optional[int]
    traffic_percentage: float
    is_active: bool
    effect_status: GrayEffectStatus
    effect_comment: Optional[str]
    created_by: str
    created_at: datetime
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    stopped_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class GrayEffectCheckCreate(BaseModel):
    gray_release_id: int
    check_type: str = Field(..., max_length=50)
    search_term: Optional[str] = Field(None, max_length=200)
    expected_result: Optional[str] = None
    actual_result: Optional[str] = None
    passed: bool
    checked_by: str = Field(..., max_length=50)
    comments: Optional[str] = None


class GrayEffectCheckResponse(BaseModel):
    id: int
    gray_release_id: int
    check_type: str
    search_term: Optional[str]
    expected_result: Optional[str]
    actual_result: Optional[str]
    passed: Optional[bool]
    checked_by: str
    checked_at: datetime
    comments: Optional[str]
    
    class Config:
        from_attributes = True


class TermMatchRequest(BaseModel):
    search_term: str
    library_id: Optional[int] = None
    include_gray: bool = Field(default=False)


class TermMatchResponse(BaseModel):
    search_term: str
    matched: bool
    rule_type: Optional[RuleType]
    rule_id: Optional[int]
    term: Optional[str]
    match_type: Optional[str]
    action: Optional[str]
    source: Optional[str]
    confidence: Optional[float]


class AuditLogResponse(BaseModel):
    id: int
    rule_id: int
    action: str
    from_status: Optional[RuleStatus]
    to_status: Optional[RuleStatus]
    actor: str
    timestamp: datetime
    reason: Optional[str]
    details: Optional[str]
    
    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    export_type: str = Field(..., max_length=50)
    rule_ids: Optional[List[int]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    statuses: Optional[List[RuleStatus]] = None
    created_by: str = Field(..., max_length=50)


class ExportResponse(BaseModel):
    id: int
    export_type: str
    file_name: Optional[str]
    record_count: int
    status: str
    created_by: str
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class RuleWithHistoryResponse(TermRuleResponse):
    audit_logs: List[AuditLogResponse] = []
    reviews: List[ReviewRequestResponse] = []
    gray_releases: List[GrayReleaseResponse] = []


class SummaryResponse(BaseModel):
    total_rules: int
    by_status: Dict[str, int]
    by_type: Dict[str, int]
    pending_reviews: int
    in_gray: int
    in_production: int
    recent_changes: int
