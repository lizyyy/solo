from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class ErrorType(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    REQUIRES_MANUAL_REVIEW = "requires_manual_review"
    ALREADY_PROCESSED = "already_processed"
    VALIDATION_ERROR = "validation_error"
    INTERNAL_ERROR = "internal_error"


class ErrorResponse(BaseModel):
    error_type: ErrorType
    message: str
    details: Optional[Dict[str, Any]] = None
    field: Optional[str] = None


class LifecycleRuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: str = "draft"
    prefix: Optional[str] = None
    days_after_modification: Optional[int] = Field(None, ge=0)
    days_after_creation: Optional[int] = Field(None, ge=0)
    expiration_date: Optional[datetime] = None
    tag_filters: List[Dict[str, str]] = Field(default_factory=list)
    action: str = "Delete"
    noncurrent_version_days: Optional[int] = Field(None, ge=0)

    @field_validator('status')
    def validate_status(cls, v):
        valid_statuses = ['draft', 'active', 'paused', 'archived']
        if v not in valid_statuses:
            raise ValueError(f"Status must be one of {valid_statuses}")
        return v


class LifecycleRuleCreate(LifecycleRuleBase):
    pass


class LifecycleRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None
    prefix: Optional[str] = None
    days_after_modification: Optional[int] = Field(None, ge=0)
    days_after_creation: Optional[int] = Field(None, ge=0)
    expiration_date: Optional[datetime] = None
    tag_filters: Optional[List[Dict[str, str]]] = None
    action: Optional[str] = None
    noncurrent_version_days: Optional[int] = Field(None, ge=0)


class LifecycleRule(LifecycleRuleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class StorageObjectBase(BaseModel):
    key: str = Field(..., min_length=1, max_length=1000)
    bucket: str = Field(..., min_length=1, max_length=255)
    size: int = Field(0, ge=0)
    last_modified: datetime
    creation_date: Optional[datetime] = None
    etag: Optional[str] = None
    version_id: Optional[str] = None
    is_latest: bool = True
    tags: Dict[str, str] = Field(default_factory=dict)
    storage_class: str = "STANDARD"


class StorageObjectCreate(StorageObjectBase):
    pass


class StorageObject(StorageObjectBase):
    id: int

    class Config:
        from_attributes = True


class PreviewReportBase(BaseModel):
    rule_id: int
    name: str = Field(..., min_length=1, max_length=255)


class PreviewReportCreate(PreviewReportBase):
    pass


class PreviewReport(PreviewReportBase):
    id: int
    status: str
    total_objects: int
    hit_objects: int
    total_size: int
    hit_size: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    requires_manual_review: bool = False
    review_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PreviewHitBase(BaseModel):
    object_key: str
    hit_reason: str
    action: str
    estimated_deletion_date: Optional[datetime] = None
    object_size: int
    last_modified: datetime


class PreviewHit(PreviewHitBase):
    id: int
    report_id: int
    object_id: int

    class Config:
        from_attributes = True


class PreviewResult(BaseModel):
    report: PreviewReport
    hits: List[PreviewHit]


class PreviewStartResponse(BaseModel):
    report_id: int
    status: str
    message: str


class BulkImportResponse(BaseModel):
    success_count: int
    failed_count: int
    errors: List[Dict[str, Any]] = Field(default_factory=list)
