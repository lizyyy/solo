from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class ProxyRuleBase(BaseModel):
    name: str
    path_pattern: str
    method: str = "*"
    target_url: Optional[str] = None
    rewrite_path: Optional[str] = None
    is_active: bool = True
    priority: int = 0
    created_by: Optional[str] = None
    description: Optional[str] = None


class ProxyRuleCreate(ProxyRuleBase):
    pass


class ProxyRuleUpdate(BaseModel):
    name: Optional[str] = None
    path_pattern: Optional[str] = None
    method: Optional[str] = None
    target_url: Optional[str] = None
    rewrite_path: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    description: Optional[str] = None


class ProxyRule(ProxyRuleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SampleRequestBase(BaseModel):
    path: str
    method: str
    headers: Optional[Dict[str, Any]] = None
    query_params: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    source: Optional[str] = None
    expected_status: Optional[int] = None
    expected_response: Optional[str] = None


class SampleRequestCreate(SampleRequestBase):
    pass


class SampleRequest(SampleRequestBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ShadowBatchBase(BaseModel):
    name: str
    created_by: Optional[str] = None
    rule_ids: List[int] = Field(default_factory=list)
    description: Optional[str] = None


class ShadowBatchCreate(ShadowBatchBase):
    pass


class ShadowBatchUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None


class ShadowBatch(ShadowBatchBase):
    id: int
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_samples: int = 0
    passed_count: int = 0
    failed_count: int = 0
    diff_count: int = 0

    class Config:
        from_attributes = True


class DiffReasonBase(BaseModel):
    category: str
    description: Optional[str] = None
    field_path: Optional[str] = None
    expected_value: Optional[str] = None
    actual_value: Optional[str] = None
    severity: str = "medium"
    is_false_positive: bool = False


class DiffReasonCreate(DiffReasonBase):
    hit_result_id: int


class DiffReason(DiffReasonBase):
    id: int
    hit_result_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class HitResultBase(BaseModel):
    batch_id: int
    rule_id: int
    sample_request_id: int


class HitResultCreate(HitResultBase):
    pass


class HitResultUpdate(BaseModel):
    status: Optional[str] = None
    actual_status: Optional[int] = None
    actual_response: Optional[str] = None
    actual_headers: Optional[Dict[str, Any]] = None
    response_time_ms: Optional[int] = None
    has_diff: Optional[bool] = None
    diff_details: Optional[Dict[str, Any]] = None


class HitResult(HitResultBase):
    id: int
    status: str
    actual_status: Optional[int] = None
    actual_response: Optional[str] = None
    actual_headers: Optional[Dict[str, Any]] = None
    response_time_ms: Optional[int] = None
    has_diff: bool
    diff_details: Optional[Dict[str, Any]] = None
    executed_at: Optional[datetime] = None
    diff_reasons: List[DiffReason] = Field(default_factory=list)

    class Config:
        from_attributes = True


class TestReportBase(BaseModel):
    batch_id: int
    name: str
    format: str = "json"
    created_by: Optional[str] = None


class TestReportCreate(TestReportBase):
    content: Dict[str, Any]


class TestReport(TestReportBase):
    id: int
    content: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionRecordBase(BaseModel):
    batch_id: Optional[int] = None
    hit_result_id: Optional[int] = None
    original_input: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    error_type: Optional[str] = None
    stack_trace: Optional[str] = None


class ExceptionRecordCreate(ExceptionRecordBase):
    pass


class ExceptionRecordHandle(BaseModel):
    handler: str
    handle_conclusion: str


class ExceptionRecord(ExceptionRecordBase):
    id: int
    handler: Optional[str] = None
    handle_conclusion: Optional[str] = None
    handled_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MatchRequest(BaseModel):
    path: str
    method: str = "GET"


class MatchResult(BaseModel):
    matched: bool
    rule: Optional[ProxyRule] = None
    rewritten_path: Optional[str] = None


class ManualCorrection(BaseModel):
    hit_result_id: int
    is_false_positive: bool
    correction_note: str
    corrected_by: str


class BatchExecutionRequest(BaseModel):
    batch_id: int


class BatchStatusResponse(BaseModel):
    batch_id: int
    status: str
    progress: float
    total_samples: int
    processed_count: int
    passed_count: int
    failed_count: int
    diff_count: int
