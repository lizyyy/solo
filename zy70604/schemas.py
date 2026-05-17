from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from models import BookingStatus, LeaveStatus, SubstituteStatus


class CoachBase(BaseModel):
    name: str
    phone: str
    specialty: Optional[str] = None


class CoachCreate(CoachBase):
    pass


class Coach(CoachBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True


class MemberCardBase(BaseModel):
    member_name: str
    member_phone: str
    card_number: str
    total_hours: int


class MemberCardCreate(MemberCardBase):
    pass


class MemberCard(MemberCardBase):
    id: int
    used_hours: int
    frozen_hours: int
    remaining_hours: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class CoursePackageBase(BaseModel):
    package_name: str
    course_type: Optional[str] = None
    total_hours: int
    coach_id: Optional[int] = None
    expire_date: Optional[datetime] = None


class CoursePackageCreate(CoursePackageBase):
    member_card_id: int


class CoursePackage(CoursePackageBase):
    id: int
    member_card_id: int
    used_hours: int
    frozen_hours: int
    remaining_hours: int
    purchase_date: datetime
    coach: Optional[Coach] = None

    class Config:
        orm_mode = True


class BookingBase(BaseModel):
    member_card_id: int
    course_package_id: int
    main_coach_id: int
    booking_date: datetime
    start_time: str
    end_time: str
    hours: int = 1
    notes: Optional[str] = None


class BookingCreate(BookingBase):
    created_by: Optional[str] = None


class Booking(BookingBase):
    id: int
    status: BookingStatus
    is_makeup: bool
    makeup_for_booking_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[str]
    consumed_at: Optional[datetime]
    consumed_by: Optional[str]
    member_card: MemberCard
    course_package: CoursePackage
    main_coach: Coach

    class Config:
        orm_mode = True


class LeaveApplicationBase(BaseModel):
    booking_id: int
    reason: str
    freeze_hours: bool = True


class LeaveApplicationCreate(LeaveApplicationBase):
    pass


class LeaveApplication(LeaveApplicationBase):
    id: int
    status: LeaveStatus
    applied_at: datetime
    approved_at: Optional[datetime]
    approved_by: Optional[str]
    rejection_reason: Optional[str]
    booking: Booking

    class Config:
        orm_mode = True


class SubstituteRecordBase(BaseModel):
    booking_id: int
    substitute_coach_id: int
    reason: Optional[str] = None


class SubstituteRecordCreate(SubstituteRecordBase):
    pass


class SubstituteRecord(SubstituteRecordBase):
    id: int
    original_coach_id: int
    status: SubstituteStatus
    requested_at: datetime
    confirmed_at: Optional[datetime]
    confirmed_by: Optional[str]
    rejection_reason: Optional[str]
    substitute_coach: Coach
    booking: Booking

    class Config:
        orm_mode = True


class ConsumptionRecordBase(BaseModel):
    booking_id: int
    hours: int
    notes: Optional[str] = None


class ConsumptionRecordCreate(ConsumptionRecordBase):
    consumed_by: Optional[str] = None


class ConsumptionRecord(ConsumptionRecordBase):
    id: int
    member_card_id: int
    course_package_id: int
    coach_id: int
    consumed_at: datetime
    consumed_by: Optional[str]
    is_rollback: bool
    rollback_reason: Optional[str]
    rollback_by: Optional[str]
    rollback_at: Optional[datetime]

    class Config:
        orm_mode = True


class OperationLogBase(BaseModel):
    operation_type: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    original_input: Optional[str] = None
    handler: Optional[str] = None
    conclusion: Optional[str] = None
    notes: Optional[str] = None
    success: bool = True


class OperationLogCreate(OperationLogBase):
    pass


class OperationLog(OperationLogBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class ManualCorrectionRequest(BaseModel):
    target_type: str
    target_id: int
    correction_type: str
    new_value: str
    reason: str
    handler: str


class RollbackRequest(BaseModel):
    reason: str
    handler: str


class ReportQuery(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    member_card_id: Optional[int] = None
    coach_id: Optional[int] = None
