from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RebalanceStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_CORRECTION = "needs_correction"


class TenantDistribution(BaseModel):
    tenant_id: str
    tenant_name: Optional[str] = None
    data_size_gb: float
    qps: Optional[int] = None
    is_hot: Optional[bool] = False


class RebalancePlanCreate(BaseModel):
    source_shard: str = Field(..., description="源分片编号")
    target_node: str = Field(..., description="目标节点")
    target_shard: Optional[str] = None
    tenant_distribution: List[TenantDistribution]
    created_by: str = Field(..., description="创建人")

    @validator('tenant_distribution')
    def validate_tenants_not_empty(cls, v):
        if not v:
            raise ValueError('租户分布不能为空')
        return v

    @validator('source_shard', 'target_node')
    def validate_not_empty(cls, v):
        if not v.strip():
            raise ValueError('字段不能为空')
        return v


class RebalancePlanResponse(BaseModel):
    id: int
    plan_no: str
    source_shard: str
    target_node: str
    target_shard: Optional[str]
    tenant_distribution: List[Dict[str, Any]]
    migration_traffic_gb: float
    estimated_duration_min: int
    hot_tenant_count: int
    hot_tenants: Optional[List[Dict[str, Any]]]
    risk_level: str
    risk_score: float
    risk_details: Optional[Dict[str, Any]]
    status: RebalanceStatus
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]
    raw_input: Optional[Dict[str, Any]]
    processing_logic: Optional[str]

    class Config:
        from_attributes = True


class ApprovalAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    SUBMIT = "submit"


class ApprovalRequest(BaseModel):
    approver: str
    action: ApprovalAction
    comments: Optional[str] = None

    @validator('approver')
    def validate_approver_not_empty(cls, v):
        if not v.strip():
            raise ValueError('审批人不能为空')
        return v


class StatusUpdateRequest(BaseModel):
    new_status: RebalanceStatus
    operator: str
    reason: Optional[str] = None


class ExecutionResult(BaseModel):
    success: bool
    actual_traffic_gb: Optional[float] = None
    execution_details: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    corrected_by: str
    corrected_values: Dict[str, Any]
    correction_reason: str

    @validator('correction_reason')
    def validate_reason_not_empty(cls, v):
        if not v.strip():
            raise ValueError('修正原因不能为空')
        return v

    @validator('corrected_values')
    def validate_corrected_values_not_empty(cls, v):
        if not v:
            raise ValueError('修正值不能为空')
        return v


class QueryParams(BaseModel):
    status: Optional[RebalanceStatus] = None
    source_shard: Optional[str] = None
    created_by: Optional[str] = None
    page: int = 1
    page_size: int = 20

    @validator('page')
    def validate_page(cls, v):
        if v < 1:
            return 1
        return v

    @validator('page_size')
    def validate_page_size(cls, v):
        if v < 1:
            return 20
        if v > 100:
            return 100
        return v


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[RebalancePlanResponse]


class ApprovalRecordResponse(BaseModel):
    id: int
    plan_id: int
    approver: str
    approval_action: str
    comments: Optional[str]
    approved_at: datetime

    class Config:
        from_attributes = True


class ExecutionSummaryResponse(BaseModel):
    id: int
    plan_id: int
    actual_start_time: Optional[datetime]
    actual_end_time: Optional[datetime]
    actual_traffic_gb: Optional[float]
    success: Optional[bool]
    execution_details: Optional[Dict[str, Any]]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class FailureRecordResponse(BaseModel):
    id: int
    plan_id: int
    failed_step: str
    raw_input_snapshot: Dict[str, Any]
    processing_evidence: Dict[str, Any]
    final_conclusion: str
    error_details: Optional[str]
    failed_at: datetime

    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    plan_ids: Optional[List[int]] = None
    status: Optional[RebalanceStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
