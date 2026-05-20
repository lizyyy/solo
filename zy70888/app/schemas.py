from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import ObjectLevel, LeaveScope, ProcessStatus, ExceptionType


class BatchBase(BaseModel):
    batch_no: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    created_by: str = Field(..., max_length=50)


class BatchCreate(BatchBase):
    pass


class BatchUpdate(BaseModel):
    status: ProcessStatus
    processed_by: str
    process_note: Optional[str] = None


class BatchResponse(BatchBase):
    id: int
    created_at: datetime
    status: ProcessStatus
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    process_note: Optional[str] = None

    class Config:
        from_attributes = True


class CheckinRecordBase(BaseModel):
    object_name: str
    object_id_card: str
    object_level: ObjectLevel
    checkin_time: datetime
    checkin_location: Optional[str] = None


class CheckinRecordCreate(CheckinRecordBase):
    batch_id: int


class CheckinRecordResponse(CheckinRecordBase):
    id: int
    batch_id: int
    is_overtime: bool
    status: ProcessStatus
    exception_type: ExceptionType
    exception_reason: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    process_note: Optional[str] = None
    readable_explanation: Optional[str] = None

    class Config:
        from_attributes = True


class LeaveRecordBase(BaseModel):
    object_name: str
    object_id_card: str
    object_level: ObjectLevel
    leave_start_time: datetime
    leave_end_time: datetime
    leave_scope: LeaveScope
    leave_reason: str
    approver: str
    approve_time: datetime


class LeaveRecordCreate(LeaveRecordBase):
    batch_id: int


class LeaveRecordResponse(LeaveRecordBase):
    id: int
    batch_id: int
    status: ProcessStatus
    exception_type: ExceptionType
    exception_reason: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    process_note: Optional[str] = None
    readable_explanation: Optional[str] = None

    class Config:
        from_attributes = True


class LocationSummaryBase(BaseModel):
    object_name: str
    object_id_card: str
    object_level: ObjectLevel
    start_time: datetime
    end_time: datetime
    locations: str
    has_gap: bool = False
    gap_details: Optional[str] = None


class LocationSummaryCreate(LocationSummaryBase):
    batch_id: int


class LocationSummaryResponse(LocationSummaryBase):
    id: int
    batch_id: int
    status: ProcessStatus
    exception_type: ExceptionType
    exception_reason: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    process_note: Optional[str] = None
    readable_explanation: Optional[str] = None

    class Config:
        from_attributes = True


class ProcessRecordRequest(BaseModel):
    status: ProcessStatus
    processed_by: str
    process_note: Optional[str] = None
    readable_explanation: Optional[str] = None


class QueryParams(BaseModel):
    object_level: Optional[ObjectLevel] = None
    leave_scope: Optional[LeaveScope] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[ProcessStatus] = None
    exception_type: Optional[ExceptionType] = None


class ExportResponse(BaseModel):
    total_count: int
    exported_count: int
    data: List[dict]
    message: str


class AuditLogResponse(BaseModel):
    id: int
    action: str
    previous_status: Optional[ProcessStatus]
    new_status: ProcessStatus
    operator: str
    operated_at: datetime
    reason: str

    class Config:
        from_attributes = True
