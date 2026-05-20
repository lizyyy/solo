from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class BatchCreate(BaseModel):
    name: str
    created_by: str


class BatchResponse(BaseModel):
    id: int
    batch_number: str
    name: str
    created_at: datetime
    created_by: str
    status: str
    total_records: int
    processed_records: int

    class Config:
        orm_mode = True


class MorningCheckRecordResponse(BaseModel):
    id: int
    student_id: str
    student_name: str
    class_name: str
    class_teacher: str
    temperature: float
    check_time: datetime
    symptoms: Optional[str]
    status: str
    need_isolation: bool
    parent_confirmed: bool
    parent_signature: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ProcessingLogResponse(BaseModel):
    id: int
    record_id: int
    action: str
    reason: str
    handler: str
    handled_at: datetime
    details: Optional[str]

    class Config:
        orm_mode = True


class RecordProcessRequest(BaseModel):
    action: str
    reason: str
    handler: str
    details: Optional[str] = None


class ExportRequest(BaseModel):
    class_teacher: Optional[str] = None
    parent_signature: Optional[str] = None
    need_isolation: Optional[bool] = None
    status: Optional[str] = None


class RecordWithLogsResponse(BaseModel):
    record: MorningCheckRecordResponse
    processing_logs: List[ProcessingLogResponse]
