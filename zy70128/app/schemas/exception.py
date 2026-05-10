from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.base import BaseResponse


class ExceptionRecordCreate(BaseModel):
    exception_type: str
    source_module: Optional[str] = None
    severity: str = "MEDIUM"
    title: str
    description: Optional[str] = None
    raw_data: Optional[str] = None
    related_record_id: Optional[str] = None
    related_record_type: Optional[str] = None


class ExceptionRecordResponse(BaseResponse):
    exception_type: str
    source_module: Optional[str]
    severity: str
    title: str
    description: Optional[str]
    raw_data: Optional[str]
    related_record_id: Optional[str]
    related_record_type: Optional[str]
    status: str
    is_handled: bool
    handled_at: Optional[datetime]
    handled_by: Optional[str]
    resolution_notes: Optional[str]
