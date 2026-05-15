from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class TaskBatchBase(BaseModel):
    batch_no: str
    temp_permission_ticket: str
    parameters: Optional[Dict[str, Any]] = None
    remarks: Optional[str] = None
    created_by: str


class TaskBatchCreate(TaskBatchBase):
    pass


class TaskBatchResponse(TaskBatchBase):
    id: int
    status: str
    total_count: int
    success_count: int
    failed_count: int
    blocked_count: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WatermarkRecordBase(BaseModel):
    record_no: str
    is_exception: bool = False
    exception_type: Optional[str] = None
    exception_message: Optional[str] = None
    original_data: Dict[str, Any]
    processed_data: Optional[Dict[str, Any]] = None
    parameter_combination: Optional[Dict[str, Any]] = None


class WatermarkRecordCreate(WatermarkRecordBase):
    pass


class WatermarkRecordResponse(WatermarkRecordBase):
    id: int
    batch_id: int
    status: str
    is_blocked: bool
    block_reason: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FailedItemResponse(BaseModel):
    id: int
    batch_id: int
    record_no: str
    failure_type: str
    failure_reason: str
    original_data: Dict[str, Any]
    error_details: Optional[Dict[str, Any]] = None
    stack_trace: Optional[str] = None
    created_at: datetime
    is_handled: bool
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None
    handling_notes: Optional[str] = None
    related_ticket_id: Optional[str] = None

    class Config:
        from_attributes = True


class RollbackCandidateCreate(BaseModel):
    record_no: str
    operation_type: str
    candidate_reason: str
    original_value: Dict[str, Any]
    suggested_value: Optional[Dict[str, Any]] = None
    risk_level: str
    created_by: str


class RollbackCandidateResponse(BaseModel):
    id: int
    batch_id: int
    record_no: str
    operation_type: str
    candidate_reason: str
    original_value: Dict[str, Any]
    suggested_value: Optional[Dict[str, Any]] = None
    risk_level: str
    is_approved: Optional[bool] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    is_executed: bool
    executed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ManualCorrectionCreate(BaseModel):
    record_id: int
    corrected_by: str
    correction_notes: str
    original_judgment: str
    corrected_judgment: str
    review_opinion: Optional[str] = None
    related_ticket_id: Optional[str] = None
    original_record_reference: Optional[str] = None


class ManualCorrectionResponse(BaseModel):
    id: int
    record_id: int
    corrected_by: str
    correction_notes: str
    original_judgment: str
    corrected_judgment: str
    review_opinion: Optional[str] = None
    related_ticket_id: Optional[str] = None
    original_record_reference: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessReportResponse(BaseModel):
    id: int
    batch_id: int
    report_no: str
    before_processing_stats: Dict[str, Any]
    after_processing_stats: Dict[str, Any]
    comparison_summary: str
    execution_time_seconds: float
    next_step_suggestions: str
    blocked_items_analysis: Optional[str] = None
    failed_items_summary: Optional[str] = None
    generated_by: str
    generated_at: datetime

    class Config:
        from_attributes = True


class BatchProcessRequest(BaseModel):
    batch_no: str
    temp_permission_ticket: str
    records: List[WatermarkRecordCreate]
    parameters: Optional[Dict[str, Any]] = None
    created_by: str


class BlockReasonResponse(BaseModel):
    parameter_combination: Dict[str, Any]
    block_reason: str
    suggestion: Optional[str] = None


class BatchProcessResult(BaseModel):
    batch_id: int
    total_processed: int
    success_count: int
    failed_count: int
    blocked_count: int
    blocked_reasons: List[BlockReasonResponse]
    execution_time_seconds: float
