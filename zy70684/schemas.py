from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import DeviceType, RoomStatus, SwapStatus, NotificationStatus


class RoomBase(BaseModel):
    name: str
    location: Optional[str] = None
    capacity: int
    status: RoomStatus = RoomStatus.AVAILABLE


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[RoomStatus] = None


class Room(RoomBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoomDeviceBase(BaseModel):
    device_type: DeviceType
    quantity: int = 1
    description: Optional[str] = None
    is_working: bool = True


class RoomDeviceCreate(RoomDeviceBase):
    room_id: int


class RoomDevice(RoomDeviceBase):
    id: int
    room_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StudentBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None


class StudentCreate(StudentBase):
    course_id: int


class Student(StudentBase):
    id: int
    course_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceRequirementBase(BaseModel):
    device_type: DeviceType
    min_quantity: int = 1
    required: bool = True
    notes: Optional[str] = None


class DeviceRequirementCreate(DeviceRequirementBase):
    course_id: int


class DeviceRequirement(DeviceRequirementBase):
    id: int
    course_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CourseBase(BaseModel):
    name: str
    code: str
    instructor: Optional[str] = None
    student_count: int
    scheduled_time: datetime
    duration_minutes: int = 120


class CourseCreate(CourseBase):
    original_room_id: Optional[int] = None
    device_requirements: List[DeviceRequirementBase] = []
    students: List[StudentBase] = []


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    instructor: Optional[str] = None
    student_count: Optional[int] = None
    scheduled_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None


class Course(CourseBase):
    id: int
    original_room_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    device_requirements: List[DeviceRequirement] = []
    students: List[Student] = []

    class Config:
        from_attributes = True


class RoomSwapCreate(BaseModel):
    course_id: int
    original_room_id: int
    target_room_id: int
    reason: Optional[str] = None
    scheduled_time: datetime
    created_by: str


class RoomSwapUpdate(BaseModel):
    reason: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    handled_by: Optional[str] = None
    handle_conclusion: Optional[str] = None


class StatusUpdate(BaseModel):
    new_status: SwapStatus
    operator: str
    remarks: Optional[str] = None


class RoomSwap(BaseModel):
    id: int
    swap_code: str
    course_id: int
    original_room_id: int
    target_room_id: int
    reason: Optional[str] = None
    status: SwapStatus
    check_capacity_pass: Optional[bool] = None
    check_devices_pass: Optional[bool] = None
    created_by: str
    handled_by: Optional[str] = None
    handle_conclusion: Optional[str] = None
    original_input: Optional[str] = None
    scheduled_time: datetime
    actual_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoomSwapDetail(RoomSwap):
    course: Course
    original_room: Room
    target_room: Room


class NotificationBase(BaseModel):
    content: str


class NotificationCreate(NotificationBase):
    swap_id: int
    student_id: int


class NotificationUpdate(BaseModel):
    status: Optional[NotificationStatus] = None
    confirmed_by: Optional[str] = None
    failed_reason: Optional[str] = None


class Notification(BaseModel):
    id: int
    swap_id: int
    student_id: int
    content: str
    status: NotificationStatus
    sent_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None
    failed_reason: Optional[str] = None
    retry_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SignInCodeBase(BaseModel):
    code: str
    original_code: Optional[str] = None
    new_code: Optional[str] = None
    expires_at: Optional[datetime] = None


class SignInCodeCreate(SignInCodeBase):
    swap_id: int


class SignInCodeRefresh(BaseModel):
    new_code: str
    operator: str


class SignInCode(BaseModel):
    id: int
    swap_id: int
    code: str
    original_code: Optional[str] = None
    new_code: Optional[str] = None
    refreshed_at: Optional[datetime] = None
    refresh_count: int
    expires_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    operator: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    original_input: Optional[str] = None
    conclusion: Optional[str] = None
    remarks: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    swap_id: int


class AuditLog(AuditLogBase):
    id: int
    swap_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SwapReport(BaseModel):
    swap_code: str
    course_name: str
    original_room: str
    target_room: str
    scheduled_time: datetime
    status: SwapStatus
    created_by: str
    capacity_check: str
    device_check: str
    notification_confirmed: int
    notification_total: int
    sign_in_code_refreshed: bool


class ManualCorrection(BaseModel):
    field_name: str
    old_value: str
    new_value: str
    operator: str
    reason: str


class SwapQuery(BaseModel):
    status: Optional[SwapStatus] = None
    course_id: Optional[int] = None
    created_by: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
