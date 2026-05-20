from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict
from enum import Enum


class DataSource(str, Enum):
    APP = "app"
    WECHAT = "wechat"
    MANUAL = "manual"
    OTHER = "other"


class ProcessingStatus(str, Enum):
    NORMAL = "normal"
    PENDING_CONFIRM = "pending_confirm"
    FAILED = "failed"


class RecordType(str, Enum):
    CHECKIN = "checkin"
    LEAVE = "leave"
    LOCATION = "location"


class CheckInRecordCreate(BaseModel):
    person_id: str
    person_name: Optional[str] = None
    checkin_time: Optional[datetime] = None
    scheduled_time: Optional[datetime] = None
    location: Optional[str] = None
    source: DataSource = DataSource.OTHER


class LeaveRecordCreate(BaseModel):
    person_id: str
    person_name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    reason: Optional[str] = None
    status: str = "approved"
    source: DataSource = DataSource.OTHER


class LocationSummaryCreate(BaseModel):
    person_id: str
    person_name: Optional[str] = None
    date: Optional[datetime] = None
    total_points: int = 0
    gap_count: int = 0
    max_gap_minutes: float = 0.0
    out_of_bounds: bool = False
    source: DataSource = DataSource.OTHER


class ProcessingResultItem(BaseModel):
    person_id: str
    person_name: Optional[str] = None
    status: ProcessingStatus
    rule_code: Optional[str] = None
    rule_name: Optional[str] = None
    suggestion: Optional[str] = None
    original_data: Optional[Dict[str, Any]] = None
    detail: Optional[str] = None


class UploadResponse(BaseModel):
    batch_id: int
    batch_hash: str
    record_type: RecordType
    total_records: int
    normal_count: int
    pending_confirm_count: int
    failed_count: int
    normal_items: List[ProcessingResultItem]
    pending_confirm_items: List[ProcessingResultItem]
    failed_items: List[ProcessingResultItem]


class ResultQueryResponse(BaseModel):
    id: int
    batch_id: int
    record_type: RecordType
    person_id: str
    person_name: Optional[str] = None
    status: ProcessingStatus
    rule_code: Optional[str] = None
    rule_name: Optional[str] = None
    suggestion: Optional[str] = None
    original_data: Optional[Dict[str, Any]] = None
    detail: Optional[str] = None
    created_at: datetime


class ReportItem(BaseModel):
    person_id: str
    person_name: Optional[str] = None
    total_checkins: int
    checkin_failed: int
    leave_count: int
    location_gaps: int
    max_gap_minutes: float
    overall_status: ProcessingStatus
    issues: List[Dict[str, Any]]


class ReportResponse(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    total_persons: int
    normal_count: int
    pending_confirm_count: int
    failed_count: int
    details: List[ReportItem]
