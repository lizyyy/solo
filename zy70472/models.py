from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class SignRequest(BaseModel):
    params: Dict[str, Any] = Field(..., description="待签名的参数")
    client_id: str = Field(..., description="客户端ID")
    compensate_enabled: bool = Field(default=True, description="是否启用补偿机制")


class SignResult(BaseModel):
    success: bool
    signature: Optional[str] = None
    timestamp: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    compensated: bool = False
    original_params: Dict[str, Any]


class SignResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    signature: Optional[str] = None
    timestamp: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class BatchItem(BaseModel):
    id: str
    params: Dict[str, Any]
    client_id: str
    gray_score: Optional[float] = None


class BatchSignRequest(BaseModel):
    items: List[BatchItem]
    compensate_enabled: bool = Field(default=True)


class BatchResultItem(BaseModel):
    id: str
    success: bool
    signature: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    compensated: bool = False
    execution_time_ms: float


class PreviewItem(BaseModel):
    id: str
    will_success: bool
    expected_error: Optional[str] = None
    gray_score: Optional[float] = None


class PreviewResponse(BaseModel):
    total_count: int
    will_success_count: int
    will_fail_count: int
    estimated_duration_ms: float
    items: List[PreviewItem]


class BatchSignResponse(BaseModel):
    batch_id: str
    total_count: int
    success_count: int
    fail_count: int
    partial_success: bool
    items: List[BatchResultItem]
    started_at: str
    completed_at: str


class AuditQueryRequest(BaseModel):
    status: Optional[str] = None
    batch_id: Optional[str] = None
    client_id: Optional[str] = None
    failure_reason: Optional[str] = None


class AuditRecord(BaseModel):
    id: str
    batch_id: str
    item_id: str
    client_id: str
    status: str
    signature: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    original_params: Dict[str, Any]
    compensated: bool
    execution_time_ms: float
    created_at: str
    confirmed: bool = False
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[str] = None


class AuditQueryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[AuditRecord]
    failure_groups: Optional[Dict[str, List[AuditRecord]]] = None


class ComparisonItem(BaseModel):
    item_id: str
    before: Dict[str, Any]
    after: Dict[str, Any]
    changes: List[str]


class ReportResponse(BaseModel):
    batch_id: str
    started_at: str
    completed_at: str
    duration_ms: float
    total_count: int
    success_count: int
    fail_count: int
    success_rate: float
    comparison: List[ComparisonItem]
    failure_summary: Dict[str, int]
    next_steps: List[str]
    needs_manual_confirmation: bool
