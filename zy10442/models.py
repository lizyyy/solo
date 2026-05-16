from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ApprovalStatus(str, Enum):
    SUCCESS = "success"
    PENDING_REVIEW = "pending_review"
    BLOCKED = "blocked"
    COMPENSATED = "compensated"


class DataType(str, Enum):
    USER_DATA = "user_data"
    TRANSACTION_DATA = "transaction_data"
    METADATA = "metadata"
    LOG_DATA = "log_data"
    ANALYTICS_DATA = "analytics_data"


class RegionRuleStatus(str, Enum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    NEEDS_REVIEW = "needs_review"


class Region(BaseModel):
    code: str
    name: str
    requires_data_residency: bool = True
    allowed_data_types: List[DataType] = Field(default_factory=list)
    blocked_data_types: List[DataType] = Field(default_factory=list)


class Tenant(BaseModel):
    tenant_id: str
    tenant_name: str
    industry: Optional[str] = None
    contact_email: Optional[str] = None


class BlockReason(BaseModel):
    reason_id: str
    category: str
    description: str
    severity: str = "high"
    resolution_hint: Optional[str] = None


class ApprovalComment(BaseModel):
    comment_id: str
    reviewer: str
    comment: str
    timestamp: datetime = Field(default_factory=datetime.now)
    status_before: Optional[ApprovalStatus] = None
    status_after: ApprovalStatus


class ResidencyApproval(BaseModel):
    approval_id: str
    tenant_id: str
    target_region: str
    data_types: List[DataType]
    status: ApprovalStatus
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    original_request: Dict[str, Any]
    processing_result: Optional[Dict[str, Any]] = None
    block_reasons: List[BlockReason] = Field(default_factory=list)
    comments: List[ApprovalComment] = Field(default_factory=list)
    region_check_result: RegionRuleStatus = RegionRuleStatus.NEEDS_REVIEW
    is_compensated: bool = False
    compensation_note: Optional[str] = None


class ResidencyReport(BaseModel):
    report_id: str
    approval_id: str
    tenant_id: str
    target_region: str
    generated_at: datetime = Field(default_factory=datetime.now)
    overall_status: ApprovalStatus
    compliance_summary: Dict[str, Any]
    data_types_verified: List[DataType]
    block_reasons: List[BlockReason] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    export_format: str = "json"
