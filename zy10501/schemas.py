from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from models import BatchStatus, ClaimStatus, DesensitizationType


class DesensitizationRuleBase(BaseModel):
    name: str
    rule_type: DesensitizationType
    pattern: Optional[str] = None
    replacement: Optional[str] = None
    mask_char: str = "*"
    keep_start: int = 0
    keep_end: int = 0
    description: Optional[str] = None


class DesensitizationRuleCreate(DesensitizationRuleBase):
    pass


class DesensitizationRule(DesensitizationRuleBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ApiPathBase(BaseModel):
    path: str
    method: str = "POST"
    sample_count: int = 0
    description: Optional[str] = None


class ApiPathCreate(ApiPathBase):
    pass


class ApiPath(ApiPathBase):
    id: int
    batch_id: int

    class Config:
        from_attributes = True


class SensitiveFieldBase(BaseModel):
    field_path: str
    field_type: str = "string"
    rule_id: Optional[int] = None
    description: Optional[str] = None


class SensitiveFieldCreate(SensitiveFieldBase):
    pass


class SensitiveField(SensitiveFieldBase):
    id: int
    batch_id: int
    rule: Optional[DesensitizationRule] = None

    class Config:
        from_attributes = True


class AuthorizationScopeBase(BaseModel):
    scope_type: str
    scope_value: str
    allowed_users: Optional[List[str]] = None
    allowed_roles: Optional[List[str]] = None
    max_claims: int = 1
    claim_hours: int = 24
    description: Optional[str] = None


class AuthorizationScopeCreate(AuthorizationScopeBase):
    pass


class AuthorizationScope(AuthorizationScopeBase):
    id: int
    batch_id: int

    class Config:
        from_attributes = True


class SampleBatchBase(BaseModel):
    batch_no: str = Field(..., description="批次编号，唯一标识")
    name: str = Field(..., description="批次名称")
    description: Optional[str] = None
    expire_at: Optional[datetime] = None


class SampleBatchCreate(SampleBatchBase):
    created_by: str
    api_paths: List[ApiPathCreate] = []
    sensitive_fields: List[SensitiveFieldCreate] = []
    authorization_scopes: List[AuthorizationScopeCreate] = []


class SampleBatchUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[BatchStatus] = None
    expire_at: Optional[datetime] = None
    approver: Optional[str] = None
    approval_comment: Optional[str] = None


class SampleBatch(SampleBatchBase):
    id: int
    status: BatchStatus
    created_by: str
    approver: Optional[str] = None
    approval_comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    api_paths: List[ApiPath] = []
    sensitive_fields: List[SensitiveField] = []
    authorization_scopes: List[AuthorizationScope] = []

    class Config:
        from_attributes = True


class ClaimRecordBase(BaseModel):
    claimant: str
    claimant_email: Optional[str] = None
    purpose: str


class ClaimRecordCreate(ClaimRecordBase):
    batch_id: int


class ClaimRecordApproval(BaseModel):
    status: ClaimStatus
    approver: str
    approval_comment: Optional[str] = None


class ClaimRecordRevoke(BaseModel):
    revoke_reason: str
    operator: str


class ClaimRecord(ClaimRecordBase):
    id: int
    batch_id: int
    status: ClaimStatus
    approver: Optional[str] = None
    approval_comment: Optional[str] = None
    claimed_at: Optional[datetime] = None
    expire_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    revoke_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AccessLogBase(BaseModel):
    access_type: str
    api_path: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_data: Optional[Dict[str, Any]] = None
    response_data: Optional[Dict[str, Any]] = None


class AccessLogCreate(AccessLogBase):
    claim_id: int


class AccessLog(AccessLogBase):
    id: int
    claim_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionRecordBase(BaseModel):
    operation: str
    operator: str
    original_input: Dict[str, Any]
    error_message: str
    processing_basis: Optional[Dict[str, Any]] = None
    stack_trace: Optional[str] = None


class ExceptionRecordCreate(ExceptionRecordBase):
    batch_id: Optional[int] = None


class ExceptionRecordResolve(BaseModel):
    resolver: str
    resolution_comment: str


class ExceptionRecord(ExceptionRecordBase):
    id: int
    batch_id: Optional[int] = None
    resolved: bool
    resolver: Optional[str] = None
    resolution_comment: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ManualCorrectionBase(BaseModel):
    field_path: str
    original_value: Optional[str] = None
    corrected_value: Optional[str] = None
    reason: str


class ManualCorrectionCreate(ManualCorrectionBase):
    batch_id: int
    corrected_by: str


class ManualCorrectionApprove(BaseModel):
    approved_by: str
    approved: bool


class ManualCorrection(ManualCorrectionBase):
    id: int
    batch_id: int
    corrected_by: str
    approved_by: Optional[str] = None
    approved: bool
    created_at: datetime
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BatchReport(BaseModel):
    batch_id: int
    batch_no: str
    name: str
    status: BatchStatus
    total_api_paths: int
    total_sensitive_fields: int
    total_claims: int
    approved_claims: int
    active_claims: int
    total_exceptions: int
    unresolved_exceptions: int
    created_at: datetime
    expire_at: Optional[datetime] = None


class DesensitizeRequest(BaseModel):
    batch_id: int
    data: Dict[str, Any]
    claim_id: Optional[int] = None


class DesensitizeResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    applied_rules: List[str] = []
