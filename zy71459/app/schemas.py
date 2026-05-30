from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class RoomEquipmentBase(BaseModel):
    equipment_id: int
    quantity: int
    source_note: Optional[str] = None


class RoomEquipmentCreate(RoomEquipmentBase):
    pass


class RoomEquipment(RoomEquipmentBase):
    id: int
    name: Optional[str] = None
    category: Optional[str] = None

    class Config:
        from_attributes = True


class RoomBase(BaseModel):
    name: str
    capacity: int
    location: Optional[str] = None
    description: Optional[str] = None


class RoomCreate(RoomBase):
    equipment: List[RoomEquipmentCreate] = []


class Room(RoomBase):
    id: int
    is_active: bool
    created_at: datetime
    equipment: List[RoomEquipment] = []

    class Config:
        from_attributes = True


class EquipmentBase(BaseModel):
    name: str
    category: Optional[str] = None
    total_quantity: int
    description: Optional[str] = None


class EquipmentCreate(EquipmentBase):
    pass


class Equipment(EquipmentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BandBase(BaseModel):
    name: str
    member_count: int
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None


class BandCreate(BandBase):
    pass


class Band(BandBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BookingEquipmentBase(BaseModel):
    equipment_id: int
    quantity: int
    source_note: Optional[str] = None


class BookingEquipmentCreate(BookingEquipmentBase):
    pass


class BookingEquipment(BookingEquipmentBase):
    id: int
    name: Optional[str] = None
    category: Optional[str] = None

    class Config:
        from_attributes = True


class BookingRequestBase(BaseModel):
    band_id: int
    title: str
    purpose: Optional[str] = None
    preferred_date: date
    start_time: str
    end_time: str
    participant_count: int
    priority: str = "normal"
    submitted_by: Optional[str] = None

    @field_validator('start_time', 'end_time')
    def validate_time_format(cls, v):
        try:
            h, m = v.split(':')
            assert 0 <= int(h) <= 23
            assert 0 <= int(m) <= 59
            return v
        except:
            raise ValueError('时间格式应为 HH:MM')


class BookingRequestCreate(BookingRequestBase):
    equipment: List[BookingEquipmentCreate] = []


class BookingRequest(BookingRequestBase):
    id: int
    status: str
    submitted_at: datetime
    batch_id: Optional[str] = None
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    band: Optional[Band] = None
    equipment: List[BookingEquipment] = []

    class Config:
        from_attributes = True


class ScheduleBase(BaseModel):
    booking_id: int
    room_id: int
    scheduled_date: date
    start_time: str
    end_time: str
    source_note: Optional[str] = None


class ScheduleCreate(ScheduleBase):
    batch_id: str


class Schedule(ScheduleBase):
    id: int
    batch_id: str
    is_final: bool
    created_at: datetime
    booking: Optional[BookingRequest] = None
    room: Optional[Room] = None

    class Config:
        from_attributes = True


class ConflictRecordBase(BaseModel):
    booking_id: int
    conflicting_booking_id: Optional[int] = None
    conflict_type: str
    conflict_details: Dict[str, Any]
    severity: str = "warning"


class ConflictRecordCreate(ConflictRecordBase):
    batch_id: str


class ConflictRecord(ConflictRecordBase):
    id: int
    batch_id: str
    resolved: bool
    resolution_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExamWeekBase(BaseModel):
    start_date: date
    end_date: date
    semester: Optional[str] = None
    description: Optional[str] = None


class ExamWeekCreate(ExamWeekBase):
    pass


class ExamWeek(ExamWeekBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BatchReportBase(BaseModel):
    batch_name: str
    scheduled_date: date
    created_by: Optional[str] = None


class BatchReportCreate(BatchReportBase):
    pass


class BatchReport(BatchReportBase):
    id: int
    batch_id: str
    total_requests: int
    scheduled_count: int
    conflict_count: int
    rejected_count: int
    algorithm_summary: Optional[Dict[str, Any]] = None
    file_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SchedulingRequest(BaseModel):
    batch_name: str
    scheduled_date: date
    booking_ids: List[int]
    created_by: Optional[str] = None


class SchedulingResult(BaseModel):
    batch_id: str
    batch_name: str
    total_requests: int
    scheduled_count: int
    conflict_count: int
    rejected_count: int
    schedules: List[Schedule]
    conflicts: List[ConflictRecord]
    algorithm_summary: Dict[str, Any]
    report_file: Optional[str] = None


class ScheduleAlternative(BaseModel):
    room_id: int
    room_name: str
    scheduled_date: date
    start_time: str
    end_time: str
    score: float
    reason: str


class BookingReviewRequest(BaseModel):
    status: str
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None


class ConflictResolutionRequest(BaseModel):
    resolved: bool
    resolution_note: str
