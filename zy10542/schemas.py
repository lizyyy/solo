from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List
from models import ReservationStatus, WaitlistStatus, NotificationChannel
import json


class ResourceBase(BaseModel):
    resource_code: str
    resource_name: str
    resource_type: Optional[str] = None
    capacity: int = 1
    location: Optional[str] = None
    description: Optional[str] = None


class ResourceCreate(ResourceBase):
    pass


class Resource(ResourceBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReservationBase(BaseModel):
    booker_id: str
    booker_name: str
    booker_contact: Optional[str] = None
    start_time: datetime
    end_time: datetime


class ReservationCreate(ReservationBase):
    resource_code: str
    raw_request: Optional[str] = None

    @validator('end_time')
    def end_time_after_start_time(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v


class ReservationCancel(BaseModel):
    cancel_reason: str
    cancel_operator: Optional[str] = None


class Reservation(ReservationBase):
    id: int
    resource_id: int
    reservation_no: str
    status: ReservationStatus
    cancel_reason: Optional[str]
    cancelled_at: Optional[datetime]
    cancel_operator: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class WaitlistBase(BaseModel):
    user_id: str
    user_name: str
    user_contact: Optional[str] = None
    priority: int = 0
    desired_start_time: Optional[datetime] = None
    desired_end_time: Optional[datetime] = None


class WaitlistCreate(WaitlistBase):
    resource_code: str
    raw_request: Optional[str] = None


class WaitlistConfirm(BaseModel):
    confirm: bool


class WaitlistManualUpdate(BaseModel):
    status: Optional[WaitlistStatus] = None
    priority: Optional[int] = None
    queue_position: Optional[int] = None
    processing_notes: Optional[str] = None
    operator: str
    reason: str


class Waitlist(WaitlistBase):
    id: int
    resource_id: int
    waitlist_no: str
    status: WaitlistStatus
    queue_position: Optional[int]
    notified_at: Optional[datetime]
    confirmed_at: Optional[datetime]
    expired_at: Optional[datetime]
    confirm_deadline: Optional[datetime]
    processing_notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class WaitlistNotification(BaseModel):
    id: int
    notification_channel: Optional[NotificationChannel]
    sent_at: Optional[datetime]
    delivered: bool
    receipt_confirmed: bool
    receipt_at: Optional[datetime]

    class Config:
        from_attributes = True


class WaitlistReport(BaseModel):
    id: int
    report_no: str
    report_type: str
    period_start: Optional[datetime]
    period_end: Optional[datetime]
    total_waitlist_count: int
    notified_count: int
    confirmed_count: int
    expired_count: int
    cancelled_count: int
    avg_wait_time_minutes: Optional[int]
    generated_at: datetime

    class Config:
        from_attributes = True


class OperationLog(BaseModel):
    id: int
    operation_type: str
    target_type: str
    target_id: int
    operator: Optional[str]
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WaitlistQuery(BaseModel):
    resource_code: Optional[str] = None
    user_id: Optional[str] = None
    status: Optional[WaitlistStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ReservationQuery(BaseModel):
    resource_code: Optional[str] = None
    booker_id: Optional[str] = None
    status: Optional[ReservationStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ReportGenerate(BaseModel):
    resource_code: Optional[str] = None
    report_type: str = "daily"
    period_start: datetime
    period_end: datetime
    generated_by: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[dict] = None
