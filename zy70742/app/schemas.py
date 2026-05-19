from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from .models import ApprovalStatus, BlockReasonCategory

class ErrorCode:
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"
    REGION_RULE_NOT_FOUND = "region_rule_not_found"
    TENANT_NOT_FOUND = "tenant_not_found"
    IDEMPOTENT_CONFLICT = "idempotent_conflict"

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None

class TenantCreate(BaseModel):
    tenant_id: str
    tenant_name: str
    industry: Optional[str] = None
    region: Optional[str] = None

class TenantResponse(BaseModel):
    tenant_id: str
    tenant_name: str
    industry: Optional[str]
    region: Optional[str]
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

class RegionRuleCreate(BaseModel):
    region_code: str
    region_name: str
    data_type: str
    requires_approval: bool = True
    allow_cross_border: bool = False
    max_retention_days: Optional[int] = None

class RegionRuleResponse(BaseModel):
    id: int
    region_code: str
    region_name: str
    data_type: str
    requires_approval: bool
    allow_cross_border: bool
    max_retention_days: Optional[int]
    status: str

    class Config:
        from_attributes = True

class ApprovalSubmitRequest(BaseModel):
    request_id: str
    tenant_id: str
    target_region: str
    data_type: str
    data_volume_gb: Optional[int] = None
    idempotency_key: Optional[str] = None

class ApprovalReviewRequest(BaseModel):
    status: ApprovalStatus
    approver: str
    approval_comment: Optional[str] = None
    block_reason: Optional[str] = None
    block_category: Optional[BlockReasonCategory] = None

class ApprovalResponse(BaseModel):
    id: int
    request_id: str
    tenant_id: str
    target_region: str
    data_type: str
    data_volume_gb: Optional[int]
    status: ApprovalStatus
    approver: Optional[str]
    approval_comment: Optional[str]
    block_reason: Optional[str]
    block_category: Optional[BlockReasonCategory]
    submitted_at: datetime
    reviewed_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True

class RegionValidationResult(BaseModel):
    is_valid: bool
    requires_approval: bool
    allow_cross_border: bool
    message: str
    risk_level: str

class ReportGenerateRequest(BaseModel):
    approval_id: int
    generated_by: str

class ReportResponse(BaseModel):
    report_id: str
    approval_id: int
    report_content: str
    generated_at: datetime
    generated_by: str

    class Config:
        from_attributes = True

class ApprovalFilterRequest(BaseModel):
    tenant_id: Optional[str] = None
    target_region: Optional[str] = None
    data_type: Optional[str] = None
    status: Optional[ApprovalStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class PaginatedApprovalResponse(BaseModel):
    items: List[ApprovalResponse]
    total: int
    page: int
    page_size: int
