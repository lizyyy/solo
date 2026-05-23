from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from models import ParkingSpotStatus, MeetingStatus, PassCodeStatus, RequestStatus


class VisitorBase(BaseModel):
    name: str = Field(..., max_length=100)
    phone: str = Field(..., max_length=20)
    company: Optional[str] = Field(None, max_length=200)
    id_card: Optional[str] = Field(None, max_length=50)


class VisitorCreate(VisitorBase):
    pass


class Visitor(VisitorBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ParkingSpotBase(BaseModel):
    spot_number: str = Field(..., max_length=20)
    area: Optional[str] = Field(None, max_length=50)
    level: Optional[str] = Field(None, max_length=20)
    status: str = ParkingSpotStatus.AVAILABLE.value
    is_temporary: bool = True
    remarks: Optional[str] = None


class ParkingSpotCreate(ParkingSpotBase):
    pass


class ParkingSpotUpdate(BaseModel):
    status: Optional[str] = None
    remarks: Optional[str] = None
    is_temporary: Optional[bool] = None


class ParkingSpot(ParkingSpotBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class MeetingAppointmentBase(BaseModel):
    visitor_id: int
    parking_spot_id: Optional[int] = None
    meeting_room: Optional[str] = Field(None, max_length=100)
    host_name: Optional[str] = Field(None, max_length=100)
    host_phone: Optional[str] = Field(None, max_length=20)
    start_time: datetime
    end_time: datetime
    remarks: Optional[str] = None


class MeetingAppointmentCreate(MeetingAppointmentBase):
    pass


class MeetingAppointmentUpdate(BaseModel):
    status: Optional[str] = None
    request_status: Optional[str] = None
    meeting_room: Optional[str] = None
    host_name: Optional[str] = None
    host_phone: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    remarks: Optional[str] = None


class MeetingAppointment(MeetingAppointmentBase):
    id: int
    status: str
    request_status: str
    created_at: datetime
    updated_at: Optional[datetime]
    visitor: Optional[Visitor] = None
    parking_spot: Optional[ParkingSpot] = None

    class Config:
        from_attributes = True


class PassCodeBase(BaseModel):
    appointment_id: int
    code: str = Field(..., max_length=20)
    expired_at: datetime


class PassCodeCreate(PassCodeBase):
    pass


class PassCode(PassCodeBase):
    id: int
    status: str
    generated_at: datetime
    used_at: Optional[datetime]
    used_by: Optional[str]

    class Config:
        from_attributes = True


class CancelRecordBase(BaseModel):
    appointment_id: int
    cancel_reason: str
    cancelled_by: Optional[str] = Field(None, max_length=100)
    spot_released: bool = True
    remarks: Optional[str] = None


class CancelRecordCreate(CancelRecordBase):
    pass


class CancelRecord(CancelRecordBase):
    id: int
    cancelled_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class OccupancyReportBase(BaseModel):
    report_date: datetime
    total_spots: int = 0
    occupied_spots: int = 0
    available_spots: int = 0
    locked_spots: int = 0
    cancelled_appointments: int = 0
    released_spots: int = 0
    utilization_rate: float = 0.0
    generated_by: Optional[str] = Field(None, max_length=100)
    remarks: Optional[str] = None


class OccupancyReportCreate(OccupancyReportBase):
    pass


class OccupancyReport(OccupancyReportBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionLogBase(BaseModel):
    request_path: Optional[str] = Field(None, max_length=200)
    request_method: Optional[str] = Field(None, max_length=20)
    raw_input: Optional[str] = None
    error_message: Optional[str] = None
    error_type: Optional[str] = Field(None, max_length=100)
    processing_result: Optional[str] = Field(None, max_length=50)
    processing_notes: Optional[str] = None
    handled_by: Optional[str] = Field(None, max_length=100)


class ExceptionLogCreate(ExceptionLogBase):
    pass


class ExceptionLogUpdate(BaseModel):
    processing_result: Optional[str] = None
    processing_notes: Optional[str] = None
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None


class ExceptionLog(ExceptionLogBase):
    id: int
    created_at: datetime
    handled_at: Optional[datetime]

    class Config:
        from_attributes = True


class ApiResponse(BaseModel):
    success: bool
    status: str
    message: str
    data: Optional[dict] = None
    errors: Optional[List[str]] = None


class ParkingSpotLockRequest(BaseModel):
    spot_id: int
    appointment_id: int
    locked_by: Optional[str] = None


class PassCodeVerifyRequest(BaseModel):
    code: str
    verified_by: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    appointment_id: int
    new_status: Optional[str] = None
    new_spot_id: Optional[int] = None
    correction_reason: str
    corrected_by: Optional[str] = None


class ExportReportRequest(BaseModel):
    start_date: datetime
    end_date: datetime
    report_type: str = "occupancy"
