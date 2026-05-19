from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List, Any
from enum import Enum

class ResponsibilityEnum(str, Enum):
    DRIVER = "driver"
    TRAFFIC = "traffic"
    WEATHER = "weather"
    SCHOOL = "school"
    PARENT = "parent"
    OTHER = "other"
    UNKNOWN = "unknown"

class ReviewResultEnum(str, Enum):
    CONFIRMED = "confirmed"
    REVISED = "revised"
    REJECTED = "rejected"

class DriverCreate(BaseModel):
    driver_name: str
    driver_phone: str
    employee_id: str

class BusCreate(BaseModel):
    bus_number: str
    plate_number: Optional[str] = None
    route_name: Optional[str] = None
    driver_id: Optional[int] = None

class StudentCreate(BaseModel):
    student_name: str
    student_number: str
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    bus_route: Optional[str] = None
    stop_name: Optional[str] = None

class DriverCheckinCreate(BaseModel):
    idempotency_key: str
    driver_id: int
    bus_id: Optional[int] = None
    checkin_time: datetime
    checkin_type: str = "start"
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_name: Optional[str] = None
    notes: Optional[str] = None

class GpsTrackCreate(BaseModel):
    idempotency_key: str
    bus_id: int
    record_time: datetime
    lat: float
    lng: float
    speed: Optional[float] = None
    heading: Optional[float] = None

class ParentComplaintCreate(BaseModel):
    idempotency_key: str
    complaint_number: str
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    bus_route: Optional[str] = None
    stop_name: Optional[str] = None
    complaint_date: datetime
    scheduled_arrival: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    complaint_type: Optional[str] = None
    description: Optional[str] = None

class RulingCreate(BaseModel):
    complaint_id: int
    responsibility: ResponsibilityEnum
    delay_minutes: int = 0
    root_cause: Optional[str] = None
    gps_evidence: Optional[str] = None
    checkin_evidence: Optional[str] = None
    ruling_reason: Optional[str] = None
    ruled_by: Optional[str] = None

class ReviewCreate(BaseModel):
    ruling_id: int
    reviewer: str
    review_result: ReviewResultEnum
    review_notes: Optional[str] = None
    new_responsibility: Optional[ResponsibilityEnum] = None

class BatchResponse(BaseModel):
    batch_id: str
    operation_type: str
    total_count: int
    success_count: int
    failure_count: int
    status: str
    success_items: List[Any] = []
    failure_items: List[dict] = []

class BatchImportRequest(BaseModel):
    items: List[dict]
    idempotency_prefix: str

class ExportRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    bus_route: Optional[str] = None
    export_format: str = "xlsx"
