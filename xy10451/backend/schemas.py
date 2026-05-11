from datetime import datetime, date, timedelta
from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class MerchantBase(BaseModel):
    name: str
    phone: Optional[str] = None
    contact: Optional[str] = None
    type: Optional[str] = None


class MerchantCreate(MerchantBase):
    pass


class MerchantUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    contact: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None


class Merchant(MerchantBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ResourceBase(BaseModel):
    name: str
    type: str
    location: Optional[str] = None
    description: Optional[str] = None


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    is_available: Optional[bool] = None


class Resource(ResourceBase):
    id: int
    is_available: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FaultRecordBase(BaseModel):
    resource_id: int
    fault_time: datetime
    fault_type: Optional[str] = None
    description: Optional[str] = None
    reported_by: Optional[str] = None


class FaultRecordCreate(FaultRecordBase):
    pass


class FaultRecordUpdate(BaseModel):
    is_resolved: Optional[bool] = None
    resolved_time: Optional[datetime] = None
    resolution_note: Optional[str] = None


class FaultRecord(FaultRecordBase):
    id: int
    is_resolved: bool
    resolved_time: Optional[datetime] = None
    resolution_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReservationBase(BaseModel):
    merchant_id: int
    resource_id: int
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None


class ReservationCreate(ReservationBase):
    pass


class ReservationUpdate(BaseModel):
    merchant_id: Optional[int] = None
    resource_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    purpose: Optional[str] = None
    status: Optional[str] = None


class Reservation(ReservationBase):
    id: int
    date: date
    status: str
    conflict_note: Optional[str] = None
    has_conflict: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CleaningWindowBase(BaseModel):
    resource_id: int
    start_time: datetime
    end_time: datetime
    minimum_cleaning_minutes: int = 30


class CleaningWindowCreate(CleaningWindowBase):
    pass


class CleaningWindowUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    minimum_cleaning_minutes: Optional[int] = None


class CleaningWindow(CleaningWindowBase):
    id: int
    date: date
    created_at: datetime

    class Config:
        from_attributes = True


class OvertimeRecordBase(BaseModel):
    reservation_id: int
    actual_end_time: datetime
    hourly_rate: float = 50.0
    note: Optional[str] = None


class OvertimeRecordCreate(OvertimeRecordBase):
    pass


class OvertimeRecordUpdate(BaseModel):
    status: Optional[str] = None
    note: Optional[str] = None


class OvertimeRecord(BaseModel):
    id: int
    reservation_id: int
    actual_end_time: datetime
    overtime_minutes: int
    hourly_rate: float
    overtime_fee: float
    affected_next_reservation_id: Optional[int] = None
    status: str
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MerchantFeeBase(BaseModel):
    merchant_id: int
    date: date
    reservation_fee: float = 0.0
    overtime_fee: float = 0.0
    total_fee: float = 0.0
    note: Optional[str] = None


class MerchantFeeCreate(MerchantFeeBase):
    pass


class MerchantFee(MerchantFeeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReservationConflict(BaseModel):
    type: str
    message: str
    conflicting_reservation: Optional[Reservation] = None


class ReservationValidationResult(BaseModel):
    valid: bool
    conflicts: List[ReservationConflict] = []
    warnings: List[str] = []


class TimeSlot(BaseModel):
    start_time: datetime
    end_time: datetime
    type: str
    merchant_id: Optional[int] = None
    merchant_name: Optional[str] = None
    resource_id: int
    reservation_id: Optional[int] = None
    status: Optional[str] = None
    overtime_fee: Optional[float] = None
    has_conflict: bool = False
    conflict_note: Optional[str] = None


class DailyKanban(BaseModel):
    date: date
    resources: List[Resource]
    time_slots: Dict[int, List[TimeSlot]]
    conflicts: List[Dict]
    merchant_fees: List[MerchantFee]


class DailyScheduleExport(BaseModel):
    date: date
    content: str
    format: str
