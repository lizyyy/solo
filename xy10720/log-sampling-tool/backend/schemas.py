from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class LogSamplingRecordBase(BaseModel):
    service_name: str = Field(..., max_length=200)
    sampling_rule: str
    trace_id: Optional[str] = Field(None, max_length=100)
    error_fragment: Optional[str] = None
    troubleshooting_summary: Optional[str] = None
    created_by: Optional[str] = Field(None, max_length=100)


class LogSamplingRecordCreate(LogSamplingRecordBase):
    request_idempotency_key: str = Field(..., max_length=100)


class LogSamplingRecordUpdate(BaseModel):
    service_name: Optional[str] = Field(None, max_length=200)
    sampling_rule: Optional[str] = None
    trace_id: Optional[str] = Field(None, max_length=100)
    error_fragment: Optional[str] = None
    error_fragment_status: Optional[str] = Field(None, max_length=50)
    troubleshooting_summary: Optional[str] = None
    is_manually_confirmed: Optional[bool] = None
    confirmed_by: Optional[str] = Field(None, max_length=100)
    change_reason: Optional[str] = Field(None, max_length=500)
    changed_by: Optional[str] = Field(None, max_length=100)


class LogSamplingRecordResponse(LogSamplingRecordBase):
    id: int
    error_fragment_status: str
    is_manually_confirmed: bool
    confirmed_by: Optional[str]
    confirmed_at: Optional[datetime]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LogSamplingVersionResponse(BaseModel):
    id: int
    record_id: int
    version_number: int
    service_name: str
    sampling_rule: str
    trace_id: Optional[str]
    error_fragment: Optional[str]
    troubleshooting_summary: Optional[str]
    change_reason: Optional[str]
    changed_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SavedQueryBase(BaseModel):
    name: str = Field(..., max_length=200)
    query_params: str
    description: Optional[str] = None
    created_by: Optional[str] = Field(None, max_length=100)


class SavedQueryCreate(SavedQueryBase):
    pass


class SavedQueryResponse(SavedQueryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    total: int
    items: List[LogSamplingRecordResponse]


class ExportRequest(BaseModel):
    record_ids: Optional[List[int]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    service_name: Optional[str] = None
