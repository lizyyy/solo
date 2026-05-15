from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class SourceType(str, Enum):
    CROSS_DAY_AFTER_SALES = "cross_day_after_sales"
    MIXED_SOURCE = "mixed_source"

class BatchStatus(str, Enum):
    PENDING = "pending"
    PREVIEWED = "previewed"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CONFLICT = "conflict"

class RecordingRecordCreate(BaseModel):
    recording_id: str
    customer_id: Optional[str] = None
    agent_id: Optional[str] = None
    call_time: datetime
    duration: Optional[int] = None
    source_channel: Optional[str] = None
    issue_type: Optional[str] = None
    content_summary: Optional[str] = None
    is_mixed_source: bool = False
    original_status: str

class BatchCreate(BaseModel):
    batch_no: str
    source_type: SourceType
    records: List[RecordingRecordCreate]

class PreviewResult(BaseModel):
    batch_no: str
    total_records: int
    estimated_compensation: float
    affected_customers: int
    mixed_source_count: int
    records_preview: List[dict]

class CompensationResultResponse(BaseModel):
    id: str
    recording_id: str
    result_type: str
    amount: float
    reason: str
    execution_time_ms: int

class BatchResponse(BaseModel):
    id: str
    batch_no: str
    source_type: str
    status: str
    created_at: datetime
    total_records: int
    total_compensation: float

class ProcessingReportResponse(BaseModel):
    batch_no: str
    total_records: int
    success_count: int
    failed_count: int
    total_execution_time_ms: int
    before_summary: dict
    after_summary: dict
    next_steps: List[str]
    created_at: datetime

class ManualCorrectionCreate(BaseModel):
    record_id: str
    operator: str
    correction_type: str
    original_value: str
    corrected_value: str
    reason: str
