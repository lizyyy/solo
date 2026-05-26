from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime

class RecordBase(BaseModel):
    phone: str
    name: str
    activity_name: str
    activity_session: str
    id_card: Optional[str] = None

class RegistrationRecord(RecordBase):
    register_time: Optional[datetime] = None

class WaitlistRecord(RecordBase):
    priority: int = 0
    wait_time: Optional[datetime] = None

class CheckinRecord(RecordBase):
    checkin_time: Optional[datetime] = None

class ProcessedResult(BaseModel):
    status: str
    record_type: str
    original_data: Dict[str, Any]
    phone: Optional[str] = None
    name: Optional[str] = None
    activity_name: Optional[str] = None
    activity_session: Optional[str] = None
    id_card: Optional[str] = None
    error_message: Optional[str] = None
    suggestion: Optional[str] = None

class BatchProcessResponse(BaseModel):
    batch_no: str
    total_count: int
    success_count: int
    pending_count: int
    failed_count: int
    success_items: List[ProcessedResult] = []
    pending_items: List[ProcessedResult] = []
    failed_items: List[ProcessedResult] = []

class BatchInfo(BaseModel):
    batch_no: str
    file_name: Optional[str]
    upload_time: datetime
    status: str
    total_count: int
    success_count: int
    pending_count: int
    failed_count: int
    data_type: str

    class Config:
        from_attributes = True

class BlacklistCreate(BaseModel):
    phone: str
    name: Optional[str] = None
    id_card: Optional[str] = None
    reason: str

class QueryParams(BaseModel):
    phone: Optional[str] = None
    activity_name: Optional[str] = None
    activity_session: Optional[str] = None
    status: Optional[str] = None
