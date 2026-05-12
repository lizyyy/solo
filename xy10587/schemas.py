from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from models import MemberStatus, CoachStatus, PackageStatus, AppointmentStatus, DeductionReason

class MemberCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=1, max_length=20)

class MemberResponse(BaseModel):
    id: int
    name: str
    phone: str
    status: MemberStatus
    created_at: datetime

    class Config:
        from_attributes = True

class CoachCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=1, max_length=20)
    commission_rate: float = Field(default=0.5, ge=0, le=1)

class CoachResponse(BaseModel):
    id: int
    name: str
    phone: str
    commission_rate: float
    status: CoachStatus
    created_at: datetime

    class Config:
        from_attributes = True

class PackageCreate(BaseModel):
    member_id: int
    coach_id: int
    total_sessions: int = Field(..., gt=0)
    purchase_date: date
    expire_date: date
    price: float = Field(..., ge=0)

class PackageResponse(BaseModel):
    id: int
    member_id: int
    coach_id: int
    total_sessions: int
    used_sessions: int
    remaining_sessions: int
    purchase_date: date
    expire_date: date
    status: PackageStatus
    price: float
    per_session_price: float
    created_at: datetime

    class Config:
        from_attributes = True

class AppointmentCreate(BaseModel):
    member_id: int
    coach_id: int
    package_id: int
    start_time: datetime
    end_time: datetime
    request_id: str = Field(..., min_length=1)

class AppointmentResponse(BaseModel):
    id: int
    member_id: int
    coach_id: int
    package_id: int
    start_time: datetime
    end_time: datetime
    status: AppointmentStatus
    deduction_applied: bool
    request_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class LeaveRequest(BaseModel):
    appointment_id: int
    reason: Optional[str] = None
    request_id: str = Field(..., min_length=1)

class NoShowRequest(BaseModel):
    appointment_id: int
    reason: Optional[str] = None
    request_id: str = Field(..., min_length=1)

class ConfirmAttendanceRequest(BaseModel):
    appointment_id: int
    request_id: str = Field(..., min_length=1)

class TransferRequest(BaseModel):
    from_member_id: int
    to_member_id: int
    package_id: int
    transfer_sessions: int = Field(..., gt=0)
    request_id: str = Field(..., min_length=1)

class ManualCorrectionRequest(BaseModel):
    entity_type: str
    entity_id: int
    after_data: dict
    operator: str
    reason: str
    request_id: str = Field(..., min_length=1)

class IdempotencyResponse(BaseModel):
    is_retry: bool
    previous_status: Optional[str] = None
    data: Optional[dict] = None
    error_message: Optional[str] = None

class StatusHistoryResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    from_status: Optional[str]
    to_status: str
    action: str
    request_id: Optional[str]
    operator: Optional[str]
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class ManualCorrectionResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    before_data: str
    after_data: str
    operator: str
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True

class CommissionResponse(BaseModel):
    id: int
    coach_id: int
    sessions: int
    per_session_amount: float
    total_amount: float
    commission_rate: float
    settlement_date: date
    is_settled: bool
    created_at: datetime

    class Config:
        from_attributes = True
