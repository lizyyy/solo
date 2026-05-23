from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from models import (
    VolunteerStatus, ShiftStatus, CheckInStatus, SwapStatus,
    CertificationStatus, ReportStatus, ExceptionType
)


class VolunteerBase(BaseModel):
    name: str = Field(..., max_length=100)
    phone: str = Field(..., max_length=20)
    email: Optional[str] = Field(None, max_length=100)


class VolunteerCreate(VolunteerBase):
    pass


class VolunteerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[VolunteerStatus] = None


class Volunteer(VolunteerBase):
    id: int
    status: VolunteerStatus
    total_hours: float
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class LocationBase(BaseModel):
    name: str = Field(..., max_length=100)
    address: Optional[str] = Field(None, max_length=200)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_meters: int = 100
    require_location_check: bool = True


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_meters: Optional[int] = None
    is_active: Optional[bool] = None
    require_location_check: Optional[bool] = None


class Location(LocationBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ShiftBase(BaseModel):
    name: str = Field(..., max_length=100)
    location_id: int
    start_time: datetime
    end_time: datetime
    capacity: int
    description: Optional[str] = None


class ShiftCreate(ShiftBase):
    pass


class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    location_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    capacity: Optional[int] = None
    status: Optional[ShiftStatus] = None
    description: Optional[str] = None


class Shift(ShiftBase):
    id: int
    actual_count: int
    status: ShiftStatus
    created_at: datetime
    updated_at: Optional[datetime]
    location: Optional[Location]

    class Config:
        from_attributes = True


class CheckInRecordBase(BaseModel):
    volunteer_id: int
    shift_id: int


class CheckInCreate(CheckInRecordBase):
    checkin_lat: Optional[float] = None
    checkin_lng: Optional[float] = None
    skip_location_check: bool = False


class CheckOut(BaseModel):
    checkout_lat: Optional[float] = None
    checkout_lng: Optional[float] = None


class CheckInUpdate(BaseModel):
    remarks: Optional[str] = None


class CheckInRecord(CheckInRecordBase):
    id: int
    checkin_time: Optional[datetime]
    checkout_time: Optional[datetime]
    checkin_lat: Optional[float]
    checkin_lng: Optional[float]
    checkout_lat: Optional[float]
    checkout_lng: Optional[float]
    status: CheckInStatus
    actual_duration: float
    remarks: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ShiftSwapBase(BaseModel):
    shift_id: int
    requester_id: int
    acceptor_id: int
    reason: Optional[str] = None


class ShiftSwapCreate(ShiftSwapBase):
    pass


class ShiftSwapApproval(BaseModel):
    status: SwapStatus
    approval_remarks: Optional[str] = None
    approver_id: int


class ShiftSwap(ShiftSwapBase):
    id: int
    status: SwapStatus
    approver_id: Optional[int]
    approval_remarks: Optional[str]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class DurationCertificationBase(BaseModel):
    volunteer_id: int
    checkin_id: int
    claimed_duration: float


class DurationCertificationCreate(DurationCertificationBase):
    pass


class DurationCertificationVerify(BaseModel):
    verified_duration: float
    status: CertificationStatus
    verification_remarks: Optional[str] = None
    verifier_id: int


class DurationCertification(DurationCertificationBase):
    id: int
    verified_duration: Optional[float]
    status: CertificationStatus
    verifier_id: Optional[int]
    verification_remarks: Optional[str]
    verified_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ServiceReportBase(BaseModel):
    volunteer_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ServiceReportCreate(ServiceReportBase):
    pass


class ReportDetailBase(BaseModel):
    shift_id: int
    shift_name: str
    location_name: str
    checkin_time: Optional[datetime]
    checkout_time: Optional[datetime]
    duration: float
    status: str


class ServiceReport(ServiceReportBase):
    id: int
    total_hours: float
    shift_count: int
    status: ReportStatus
    export_format: Optional[str]
    exported_at: Optional[datetime]
    created_at: datetime
    details: List[ReportDetailBase] = []

    class Config:
        from_attributes = True


class ExceptionLogBase(BaseModel):
    exception_type: ExceptionType
    related_type: Optional[str] = None
    related_id: Optional[int] = None
    raw_input: str
    error_message: Optional[str] = None
    handling_conclusion: str
    handler_id: Optional[int] = None


class ExceptionLogCreate(ExceptionLogBase):
    pass


class ExceptionLog(ExceptionLogBase):
    id: int
    handled_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ManualCorrectionBase(BaseModel):
    checkin_id: int
    new_status: Optional[str] = None
    new_checkin_time: Optional[datetime] = None
    new_checkout_time: Optional[datetime] = None
    new_duration: Optional[float] = None
    reason: str
    corrector_id: int


class ManualCorrectionCreate(ManualCorrectionBase):
    pass


class ManualCorrection(ManualCorrectionBase):
    id: int
    old_status: Optional[str]
    old_checkin_time: Optional[datetime]
    old_checkout_time: Optional[datetime]
    old_duration: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class ExportRequest(BaseModel):
    report_id: int
    format: str = "csv"