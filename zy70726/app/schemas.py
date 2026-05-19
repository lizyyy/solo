from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class EvictionStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    CANCELLED = "cancelled"
    NEEDS_REVIEW = "needs_review"


class ProjectBase(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CacheEntryBase(BaseModel):
    id: str
    cache_key: str
    project_id: str
    size_bytes: int
    hit_count: int = 0
    is_protected: bool = False


class CacheEntryCreate(CacheEntryBase):
    pass


class CacheEntryUpdate(BaseModel):
    size_bytes: Optional[int] = None
    hit_count: Optional[int] = None
    is_protected: Optional[bool] = None


class CacheEntry(CacheEntryBase):
    last_accessed_at: datetime
    created_at: datetime
    updated_at: datetime
    project: Optional[Project] = None

    class Config:
        from_attributes = True


class CacheEntryWithStats(CacheEntry):
    hit_rate: float
    days_since_last_access: int


class EvictionRequestBase(BaseModel):
    cache_entry_id: str
    requester: Optional[str] = None
    reason: Optional[str] = None


class EvictionRequestCreate(EvictionRequestBase):
    pass


class EvictionRequestReview(BaseModel):
    review_comment: str
    reviewed_by: str
    approved: bool


class EvictionRequest(EvictionRequestBase):
    id: str
    status: EvictionStatus
    impact_score: Optional[float] = None
    impact_analysis: Optional[str] = None
    requires_manual_review: bool = False
    review_comment: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    cache_entry: Optional[CacheEntry] = None

    class Config:
        from_attributes = True


class EvictionReportBase(BaseModel):
    id: str
    total_evicted: int
    total_space_freed_bytes: int
    total_impact_score: float
    report_data: str
    generated_by: Optional[str] = None


class EvictionReport(EvictionReportBase):
    created_at: datetime

    class Config:
        from_attributes = True


class ImpactAnalysisResult(BaseModel):
    impact_score: float
    impact_analysis: str
    requires_manual_review: bool
    risk_factors: List[str]


class EvictionCandidate(BaseModel):
    cache_entry_id: str
    cache_key: str
    project_name: str
    size_bytes: int
    hit_count: int
    last_accessed_days: int
    impact_score: float
    priority_score: float


class BulkEvictionRequest(BaseModel):
    cache_entry_ids: List[str]
    requester: Optional[str] = None
    reason: Optional[str] = None


class BulkEvictionResult(BaseModel):
    success_count: int
    failed_count: int
    results: List[dict]


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "error_code": "MISSING_FIELD",
                    "message": "Required field is missing",
                    "details": {"field": "cache_entry_id"}
                },
                {
                    "error_code": "INVALID_STATUS",
                    "message": "Operation not allowed in current status",
                    "details": {"current_status": "executed", "allowed_statuses": ["pending"]}
                },
                {
                    "error_code": "NEEDS_MANUAL_REVIEW",
                    "message": "This eviction requires manual review before execution",
                    "details": {"impact_score": 0.85}
                },
                {
                    "error_code": "ALREADY_PROCESSED",
                    "message": "This eviction request has already been processed",
                    "details": {"processed_at": "2024-01-15T10:30:00Z"}
                }
            ]
        }
