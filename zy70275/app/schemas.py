from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List
from .models import VisitorStatus, ReservationStatus


class VisitorCreate(BaseModel):
    name: str = Field(..., min_length=1)
    company: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=1)
    license_plate: str = Field(..., min_length=1)
    id_card: Optional[str] = None


class VisitorResponse(BaseModel):
    id: int
    name: str
    company: str
    phone: str
    license_plate: str
    id_card: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class MeetingCreate(BaseModel):
    visitor_id: int
    host_name: str
    host_department: str
    meeting_room: str
    purpose: str
    scheduled_start: datetime
    scheduled_end: datetime

    @field_validator('scheduled_end')
    @classmethod
    def end_after_start(cls, v: datetime, info):
        if 'scheduled_start' in info.data and v <= info.data['scheduled_start']:
            raise ValueError('会议结束时间必须晚于开始时间')
        return v


class MeetingResponse(BaseModel):
    id: int
    visitor_id: int
    host_name: str
    host_department: str
    meeting_room: str
    purpose: str
    scheduled_start: datetime
    scheduled_end: datetime
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    status: VisitorStatus
    approval_note: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MeetingApprove(BaseModel):
    approve: bool
    note: Optional[str] = None


class ParkingSpotResponse(BaseModel):
    id: int
    spot_number: str
    zone: str
    is_visitor_spot: bool
    is_active: bool

    class Config:
        from_attributes = True


class ParkingReservationCreate(BaseModel):
    meeting_id: int
    source_record: str


class ParkingReservationResponse(BaseModel):
    id: int
    meeting_id: int
    spot_id: Optional[int]
    license_plate: str
    scheduled_start: datetime
    scheduled_end: datetime
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    status: ReservationStatus
    lock_expires_at: Optional[datetime]
    source_record: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReservationExtensionCreate(BaseModel):
    reservation_id: int
    minutes: int
    reason: Optional[str] = None

    @field_validator('minutes')
    @classmethod
    def positive_minutes(cls, v: int):
        if v <= 0:
            raise ValueError('延时时长必须大于0')
        if v > 240:
            raise ValueError('单次延时不能超过4小时')
        return v


class ReservationExtensionResponse(BaseModel):
    id: int
    reservation_id: int
    original_end: datetime
    new_end: datetime
    reason: Optional[str]
    status: ReservationStatus
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    error: str
    code: str
    details: Optional[dict] = None


class DailyReport(BaseModel):
    date: str
    total_reservations: int
    approved: int
    locked: int
    in_use: int
    completed: int
    cancelled: int
    peak_hour: str
    spot_utilization_rate: float


class ConflictInfo(BaseModel):
    spot_id: int
    spot_number: str
    conflict_start: datetime
    conflict_end: datetime
