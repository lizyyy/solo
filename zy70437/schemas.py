from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from models import BatchStatus, ReplayStatus, ApprovalAction

class GatewayErrorExtractBase(BaseModel):
    trace_id: str
    request_id: str
    error_code: str
    error_message: str
    request_path: str
    request_method: str
    request_headers: Dict[str, Any]
    request_body: Dict[str, Any]
    response_status: int
    response_body: Dict[str, Any]
    timestamp: datetime
    service_name: str
    upstream_service: str
    approval_opinion: Optional[str] = None
    approval_status: Optional[str] = None
    raw_data: Dict[str, Any]

class GatewayErrorExtractCreate(GatewayErrorExtractBase):
    pass

class GatewayErrorExtract(GatewayErrorExtractBase):
    id: int
    batch_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class BatchBase(BaseModel):
    batch_number: str
    created_by: str

class BatchCreate(BatchBase):
    error_extracts: List[GatewayErrorExtractCreate]

class Batch(BatchBase):
    id: int
    status: str
    rule_version_id: Optional[int] = None
    total_count: int
    success_count: int
    failed_count: int
    blocked_count: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    execution_time_ms: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class RuleVersionBase(BaseModel):
    version: str
    rule_name: str
    description: str
    rules: Dict[str, Any]

class RuleVersionCreate(RuleVersionBase):
    created_by: str

class RuleVersion(RuleVersionBase):
    id: int
    is_active: bool
    created_by: str
    effective_from: datetime
    effective_to: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ReplayResultBase(BaseModel):
    replay_status: str
    approval_status: Optional[str] = None
    execution_time_ms: float
    before_data: Dict[str, Any]
    after_data: Dict[str, Any]
    block_reason: Optional[str] = None
    block_code: Optional[str] = None
    matched_rules: List[str]
    approval_required: bool
    approval_opinion_missing: bool

class ReplayResult(ReplayResultBase):
    id: int
    batch_id: int
    error_extract_id: int
    processed_at: datetime
    
    class Config:
        from_attributes = True

class ReplayResultDetail(ReplayResult):
    error_extract: GatewayErrorExtract
    
    class Config:
        from_attributes = True

class ApprovalRecordBase(BaseModel):
    action: ApprovalAction
    comment: Optional[str] = None
    approved_by: str
    responsibility_team: str
    warehouse_handover_id: Optional[int] = None

class ApprovalRecordCreate(ApprovalRecordBase):
    replay_result_id: int

class ApprovalRecord(ApprovalRecordBase):
    id: int
    batch_id: int
    replay_result_id: int
    previous_status: Optional[str] = None
    new_status: str
    approved_at: datetime
    
    class Config:
        from_attributes = True

class WarehouseHandoverBase(BaseModel):
    handover_number: str
    responsibility_team: str
    original_records: Dict[str, Any]
    handover_note: str
    handed_by: str
    received_by: str
    handed_at: datetime

class WarehouseHandoverCreate(WarehouseHandoverBase):
    pass

class WarehouseHandover(WarehouseHandoverBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ReportBase(BaseModel):
    report_type: str

class ReportCreate(ReportBase):
    batch_id: int

class Report(ReportBase):
    id: int
    batch_id: int
    content: Dict[str, Any]
    before_summary: Dict[str, Any]
    after_summary: Dict[str, Any]
    execution_time_ms: float
    next_steps: List[Dict[str, Any]]
    generated_by: str
    generated_at: datetime
    
    class Config:
        from_attributes = True

class ReplayRequest(BaseModel):
    batch_id: int
    rule_version_id: Optional[int] = None

class ReplayResponse(BaseModel):
    batch_id: int
    status: str
    total_count: int
    success_count: int
    failed_count: int
    blocked_count: int
    execution_time_ms: Optional[float] = None

class QueryRequest(BaseModel):
    batch_id: Optional[int] = None
    status: Optional[str] = None
    trace_id: Optional[str] = None
    error_code: Optional[str] = None
    page: int = 1
    page_size: int = 50

class QueryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ReplayResultDetail]

class BatchDetailResponse(BaseModel):
    batch: Batch
    rule_version: Optional[RuleVersion] = None
    success_items: List[ReplayResultDetail]
    failed_items: List[ReplayResultDetail]
    blocked_items: List[ReplayResultDetail]
    approval_records: List[ApprovalRecord]
