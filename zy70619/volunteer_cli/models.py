from datetime import datetime, date, time
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, validator


class VolunteerStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class ShiftStatus(str, Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SubstituteStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class CertificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class Volunteer(BaseModel):
    volunteer_id: str
    name: str
    phone: str
    email: Optional[str] = None
    status: VolunteerStatus = VolunteerStatus.ACTIVE
    join_date: date
    skills: List[str] = Field(default_factory=list)

    @validator("phone")
    def validate_phone(cls, v):
        if not v or len(v) < 11:
            raise ValueError("手机号格式不正确")
        return v


class Location(BaseModel):
    location_id: str
    name: str
    address: str
    latitude: float
    longitude: float
    radius_meters: int = 100


class Shift(BaseModel):
    shift_id: str
    activity_name: str
    location_id: str
    date: date
    start_time: time
    end_time: time
    capacity: int
    status: ShiftStatus = ShiftStatus.PLANNED
    required_skills: List[str] = Field(default_factory=list)
    volunteer_ids: List[str] = Field(default_factory=list)

    @validator("capacity")
    def validate_capacity(cls, v):
        if v <= 0:
            raise ValueError("班次容量必须大于0")
        return v

    @validator("end_time")
    def validate_end_time(cls, v, values):
        if "start_time" in values and v <= values["start_time"]:
            raise ValueError("结束时间必须晚于开始时间")
        return v


class CheckIn(BaseModel):
    checkin_id: str
    volunteer_id: str
    shift_id: str
    checkin_time: datetime
    checkout_time: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_valid: Optional[bool] = None
    notes: Optional[str] = None


class SubstituteRequest(BaseModel):
    request_id: str
    original_volunteer_id: str
    substitute_volunteer_id: str
    shift_id: str
    request_time: datetime
    approver_id: Optional[str] = None
    approval_time: Optional[datetime] = None
    status: SubstituteStatus = SubstituteStatus.PENDING
    reason: Optional[str] = None


class DurationCertification(BaseModel):
    certification_id: str
    volunteer_id: str
    shift_id: str
    checkin_id: str
    claimed_duration_minutes: int
    verified_duration_minutes: Optional[int] = None
    status: CertificationStatus = CertificationStatus.PENDING
    verifier_id: Optional[str] = None
    verify_time: Optional[datetime] = None
    notes: Optional[str] = None


class ServiceRecord(BaseModel):
    record_id: str
    volunteer_id: str
    shift_id: str
    date: date
    activity_name: str
    actual_duration_minutes: int
    is_substitute: bool = False
    original_volunteer_id: Optional[str] = None
    certification_status: CertificationStatus
    location_valid: bool
