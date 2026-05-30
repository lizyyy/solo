from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class BatchUploadResponse(BaseModel):
    batch_id: str
    total_records: int
    success_count: int
    exception_count: int
    status: str
    is_reprocess: bool
    message: str


class RecordResponse(BaseModel):
    id: int
    record_key: str
    batch_id: str
    collateral_code: str
    collateral_name: Optional[str]
    collateral_type: Optional[str]
    market_value: float
    face_value: float
    discount_rate: float
    calculated_discount: float
    final_discount: float
    status: str
    is_exception: bool
    exception_code: Optional[str]
    exception_msg: Optional[str]
    exception_suggestion: Optional[str]
    has_manual_note: bool
    latest_note: Optional[str]
    current_version: int
    updated_at: datetime

    class Config:
        from_attributes = True


class StatusHistoryResponse(BaseModel):
    id: int
    record_key: str
    batch_id: str
    version: int
    old_status: Optional[str]
    new_status: str
    old_discount: Optional[float]
    new_discount: float
    change_reason: Optional[str]
    operator: str
    operation_type: str
    remark: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ManualNoteRequest(BaseModel):
    record_key: str
    batch_id: str
    note_content: str = Field(..., min_length=1)
    operator: str = Field(..., min_length=1)
    new_final_discount: Optional[float] = None
    new_status: Optional[str] = None


class ManualNoteResponse(BaseModel):
    id: int
    record_key: str
    note_content: str
    operator: str
    overridden: bool
    created_at: datetime


class BatchInfoResponse(BaseModel):
    id: int
    batch_id: str
    batch_date: str
    source_file: str
    total_records: int
    success_count: int
    exception_count: int
    status: str
    created_at: datetime
    updated_at: datetime
    remark: Optional[str]

    class Config:
        from_attributes = True


class ExceptionSummary(BaseModel):
    exception_code: str
    count: int
    description: str
    suggestion: str


class ExportRequest(BaseModel):
    batch_id: str
    export_type: str = "review"
    operator: Optional[str] = "system"


class ExportResponse(BaseModel):
    snapshot_id: str
    batch_id: str
    record_count: int
    export_hash: str
    created_at: datetime
    message: str


class ReviewCheckResponse(BaseModel):
    batch_id: str
    total_records: int
    reviewed_count: int
    pending_review: int
    has_exceptions: bool
    exception_count: int
    has_manual_notes: bool
    manual_note_count: int
    review_suggestion: str
    can_export: bool
