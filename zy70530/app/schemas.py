from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models import ExceptionStatus, HandlingResult


class ExceptionCondition(BaseModel):
    operator: str = Field(..., description="条件操作符: equals, not_equals, contains, greater_than, less_than, in, regex")
    value: Any = Field(..., description="条件值")


class DataQualityExceptionCreate(BaseModel):
    rule_name: str = Field(..., min_length=1, max_length=255, description="规则名称")
    field_path: str = Field(..., min_length=1, max_length=500, description="字段路径")
    exception_condition: Dict[str, Any] = Field(..., description="例外条件")
    recovery_date: datetime = Field(..., description="恢复日期")
    description: Optional[str] = Field(None, description="描述")
    created_by: str = Field(..., min_length=1, max_length=100, description="创建人")
    idempotency_key: Optional[str] = Field(None, description="幂等键，防止重复提交")


class DataQualityExceptionUpdate(BaseModel):
    exception_condition: Optional[Dict[str, Any]] = None
    recovery_date: Optional[datetime] = None
    description: Optional[str] = None


class DataQualityExceptionResponse(BaseModel):
    id: int
    rule_name: str
    field_path: str
    exception_condition: Dict[str, Any]
    recovery_date: datetime
    status: ExceptionStatus
    description: Optional[str]
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    review_comment: Optional[str]

    class Config:
        from_attributes = True


class ExceptionHitRecordCreate(BaseModel):
    exception_id: int
    record_key: str
    record_data: Dict[str, Any]


class ExceptionHitRecordResponse(BaseModel):
    id: int
    exception_id: int
    record_key: str
    record_data: Dict[str, Any]
    hit_time: datetime
    is_recovered: bool
    recovered_at: Optional[datetime]

    class Config:
        from_attributes = True


class ExceptionHandlingLogCreate(BaseModel):
    exception_id: int
    action: str
    original_input: Optional[Dict[str, Any]] = None
    handling_basis: Optional[str] = None
    final_conclusion: Optional[str] = None
    result: HandlingResult
    error_message: Optional[str] = None
    handled_by: str
    idempotency_key: Optional[str] = None


class ExceptionHandlingLogResponse(BaseModel):
    id: int
    exception_id: int
    action: str
    original_input: Optional[Dict[str, Any]]
    handling_basis: Optional[str]
    final_conclusion: Optional[str]
    result: HandlingResult
    error_message: Optional[str]
    handled_by: str
    created_at: datetime
    idempotency_key: Optional[str]

    class Config:
        from_attributes = True


class QualityReportCreate(BaseModel):
    exception_id: int
    report_type: str
    summary: Dict[str, Any]
    generated_by: str


class QualityReportResponse(BaseModel):
    id: int
    exception_id: int
    report_type: str
    report_date: datetime
    total_hits: int
    recovered_count: int
    pending_count: int
    summary: Dict[str, Any]
    generated_by: str
    file_path: Optional[str]

    class Config:
        from_attributes = True


class StatusTransitionRequest(BaseModel):
    target_status: ExceptionStatus
    reviewed_by: Optional[str] = None
    review_comment: Optional[str] = None
    idempotency_key: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    hit_record_ids: List[int]
    correction_note: str
    corrected_by: str
    idempotency_key: Optional[str] = None


class ExceptionQueryParams(BaseModel):
    rule_name: Optional[str] = None
    field_path: Optional[str] = None
    status: Optional[ExceptionStatus] = None
    created_by: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]


class ExceptionMatchRequest(BaseModel):
    rule_name: str
    field_path: str
    record_data: Dict[str, Any]


class ExceptionMatchResponse(BaseModel):
    matched: bool
    exception_id: Optional[int]
    exception_condition: Optional[Dict[str, Any]]


class ExportRequest(BaseModel):
    exception_ids: Optional[List[int]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    include_hit_records: bool = True
    include_handling_logs: bool = True
    format: str = Field("excel", description="导出格式: excel, csv")
