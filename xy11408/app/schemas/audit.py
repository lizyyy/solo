from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.models.audit import SourceType, RecordStatus


class AcceptanceRecordBase(BaseModel):
    record_no: str = Field(..., max_length=50)
    pharmacy_name: str = Field(..., max_length=100)
    pharmacy_region: Optional[str] = Field(None, max_length=50)
    source_type: SourceType
    source_ref: Optional[str] = Field(None, max_length=100)
    medicine_name: str = Field(..., max_length=200)
    medicine_code: Optional[str] = Field(None, max_length=50)
    batch_no: str = Field(..., max_length=100)
    expiry_date: Optional[str] = Field(None, max_length=20)
    quantity: int = Field(..., gt=0)
    unit: Optional[str] = Field(None, max_length=20)
    near_expiry_days: Optional[int] = None
    notes: Optional[str] = None
    external_data: Optional[str] = None


class AcceptanceRecordCreate(AcceptanceRecordBase):
    pass


class AcceptanceRecordUpdate(BaseModel):
    pharmacy_name: Optional[str] = Field(None, max_length=100)
    pharmacy_region: Optional[str] = Field(None, max_length=50)
    source_type: Optional[SourceType] = None
    source_ref: Optional[str] = Field(None, max_length=100)
    medicine_name: Optional[str] = Field(None, max_length=200)
    medicine_code: Optional[str] = Field(None, max_length=50)
    batch_no: Optional[str] = Field(None, max_length=100)
    expiry_date: Optional[str] = Field(None, max_length=20)
    quantity: Optional[int] = Field(None, gt=0)
    unit: Optional[str] = Field(None, max_length=20)
    near_expiry_days: Optional[int] = None
    notes: Optional[str] = None
    external_data: Optional[str] = None


class StatusLogResponse(BaseModel):
    id: int
    record_id: int
    from_status: Optional[RecordStatus]
    to_status: RecordStatus
    operator_id: int
    operator_name: Optional[str]
    operated_at: datetime
    reason: str

    class Config:
        from_attributes = True


class AttachmentResponse(BaseModel):
    id: int
    record_id: int
    file_name: str
    file_type: Optional[str]
    file_size: Optional[int]
    uploaded_by: Optional[int]
    uploaded_at: datetime
    description: Optional[str]

    class Config:
        from_attributes = True


class ReconciliationResultResponse(BaseModel):
    id: int
    record_id: int
    is_matched: bool
    match_score: Optional[float]
    matched_with: Optional[str]
    reconciliation_notes: Optional[str]
    reconciled_at: datetime

    class Config:
        from_attributes = True


class FailedRecordResponse(BaseModel):
    id: int
    record_id: int
    record_no: Optional[str]
    error_type: str
    error_message: str
    error_details: Optional[str]
    failed_at: datetime
    resolved: bool
    resolved_by: Optional[int]
    resolved_at: Optional[datetime]
    resolution_notes: Optional[str]

    class Config:
        from_attributes = True


class AcceptanceRecordResponse(AcceptanceRecordBase):
    id: int
    status: RecordStatus
    is_valid: bool
    is_bad_data: bool
    created_by: Optional[int]
    created_by_name: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    status_logs: List[StatusLogResponse] = []
    attachments: List[AttachmentResponse] = []
    reconciliation: Optional[ReconciliationResultResponse] = None

    class Config:
        from_attributes = True


class StatusChangeRequest(BaseModel):
    new_status: RecordStatus
    reason: str = Field(..., min_length=5, description="状态变更原因")


class RecordQuery(BaseModel):
    pharmacy_name: Optional[str] = None
    pharmacy_region: Optional[str] = None
    source_type: Optional[SourceType] = None
    status: Optional[RecordStatus] = None
    medicine_name: Optional[str] = None
    batch_no: Optional[str] = None
    is_bad_data: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
