from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class MemberBase(BaseModel):
    phone: str = Field(..., min_length=11, max_length=11)
    name: Optional[str] = None
    member_number: Optional[str] = None
    membership_level: Optional[str] = "普通"


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    name: Optional[str] = None
    membership_level: Optional[str] = None
    balance: Optional[float] = None
    is_active: Optional[bool] = None


class Member(MemberBase):
    id: int
    balance: float
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StationBase(BaseModel):
    name: str
    station_type: str


class StationCreate(StationBase):
    pass


class StationUpdate(BaseModel):
    name: Optional[str] = None
    station_type: Optional[str] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None


class Station(StationBase):
    id: int
    is_active: bool
    status: str
    current_queue_id: Optional[int] = None

    class Config:
        from_attributes = True


class AppointmentBase(BaseModel):
    member_id: int
    appointment_time: datetime
    service_type: str
    notes: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class Appointment(AppointmentBase):
    id: int
    status: str
    booked_station_id: Optional[int] = None
    queue_number_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class QueueNumberBase(BaseModel):
    member_id: int
    service_type: str
    is_appointment: bool = False
    appointment_id: Optional[int] = None


class QueueNumberCreate(QueueNumberBase):
    pass


class QueueNumberUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[int] = None


class QueueNumber(QueueNumberBase):
    id: int
    queue_date: str
    sequence_number: int
    display_number: str
    status: str
    priority: int
    assigned_station_id: Optional[int] = None
    called_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    member: Optional[Member] = None

    class Config:
        from_attributes = True


class PassedRecordBase(BaseModel):
    queue_number_id: int
    reason: Optional[str] = None
    notes: Optional[str] = None
    operator: Optional[str] = None


class PassedRecordCreate(PassedRecordBase):
    pass


class PassedRecord(PassedRecordBase):
    id: int
    passed_at: datetime
    requeued_at: Optional[datetime] = None
    new_queue_number_id: Optional[int] = None

    class Config:
        from_attributes = True


class RequeueRequest(BaseModel):
    passed_record_id: int
    operator: Optional[str] = None


class QueueReportBase(BaseModel):
    report_date: str


class QueueReport(QueueReportBase):
    id: int
    total_queues: int
    total_completed: int
    total_passed: int
    avg_wait_time: float
    avg_service_time: float
    peak_hour: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


class QueueCallRequest(BaseModel):
    station_id: int
    operator: Optional[str] = None


class QueueCompleteRequest(BaseModel):
    operator: Optional[str] = None


class DateRangeRequest(BaseModel):
    start_date: str
    end_date: str
