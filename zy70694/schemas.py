from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from models import RoomStatus, BookingStatus, RenewalStatus


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


class PianoRoomBase(BaseModel):
    name: str
    room_type: Optional[str] = None
    hourly_rate: float = Field(gt=0)
    status: RoomStatus = RoomStatus.AVAILABLE
    description: Optional[str] = None


class PianoRoomCreate(PianoRoomBase):
    pass


class PianoRoomUpdate(BaseModel):
    name: Optional[str] = None
    room_type: Optional[str] = None
    hourly_rate: Optional[float] = Field(None, gt=0)
    status: Optional[RoomStatus] = None
    description: Optional[str] = None


class PianoRoomResponse(PianoRoomBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    phone: str
    name: str


class UserCreate(UserBase):
    pass


class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BookingBase(BaseModel):
    room_id: int
    user_id: int
    booking_date: str
    start_time: str
    end_time: str


class BookingCreate(BookingBase):
    @field_validator('booking_date')
    def validate_booking_date(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('日期格式必须为 YYYY-MM-DD')

    @field_validator('start_time', 'end_time')
    def validate_time(cls, v):
        try:
            datetime.strptime(v, '%H:%M')
            return v
        except ValueError:
            raise ValueError('时间格式必须为 HH:MM')
        return v


class BookingUpdate(BaseModel):
    status: Optional[BookingStatus] = None
    remarks: Optional[str] = None


class BookingResponse(BookingBase):
    id: int
    duration_hours: float
    total_amount: float
    status: BookingStatus
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    is_late_released: bool
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    user: UserResponse
    room: PianoRoomResponse

    class Config:
        from_attributes = True


class LateRecordResponse(BaseModel):
    id: int
    booking_id: int
    user_id: int
    late_minutes: int
    released_at: Optional[datetime] = None
    is_released: bool
    created_at: datetime
    user: UserResponse
    booking: BookingResponse

    class Config:
        from_attributes = True


class RenewalApplicationBase(BaseModel):
    booking_id: int
    extend_hours: float = Field(gt=0)


class RenewalApplicationCreate(RenewalApplicationBase):
    pass


class RenewalApplicationUpdate(BaseModel):
    status: RenewalStatus
    remarks: Optional[str] = None


class RenewalApplicationResponse(BaseModel):
    id: int
    booking_id: int
    extend_hours: float
    new_end_time: str
    additional_amount: float
    status: RenewalStatus
    approved_at: Optional[datetime] = None
    remarks: Optional[str] = None
    created_at: datetime
    booking: BookingResponse

    class Config:
        from_attributes = True


class CheckInRequest(BaseModel):
    booking_id: int


class CheckOutRequest(BaseModel):
    booking_id: int


class LateReleaseRequest(BaseModel):
    booking_id: int
    late_minutes: int


class UsageReportRequest(BaseModel):
    start_date: str
    end_date: str
    room_id: Optional[int] = None

    @field_validator('start_date', 'end_date')
    def validate_date(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('日期格式必须为 YYYY-MM-DD')


class UsageReportItem(BaseModel):
    booking_id: int
    room_name: str
    user_name: str
    booking_date: str
    start_time: str
    end_time: str
    actual_start: Optional[str] = None
    actual_end: Optional[str] = None
    duration: float
    total_amount: float
    status: str
    is_late: bool
    late_minutes: int
    has_renewal: bool
    renewal_hours: float


class UsageReportResponse(BaseModel):
    report_period: str
    total_bookings: int
    total_revenue: float
    late_checkins_count: int
    renewal_count: int
    released_bookings_count: int
    details: List[UsageReportItem]
