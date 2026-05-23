from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from models import SeatStatus, OrderStatus, ChangeStatus, ReserveWindowStatus, ExceptionType

class SeatBase(BaseModel):
    row: str
    number: str
    section: Optional[str] = None
    price: float

class SeatCreate(SeatBase):
    pass

class SeatResponse(SeatBase):
    id: int
    show_id: int
    status: SeatStatus
    locked_by_order_id: Optional[int] = None
    locked_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ShowBase(BaseModel):
    name: str
    venue: str
    show_time: datetime
    total_seats: int

class ShowCreate(ShowBase):
    seats: List[SeatCreate]

class ShowResponse(ShowBase):
    id: int
    available_seats: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class GroupOrderBase(BaseModel):
    show_id: int
    contact_name: str
    contact_phone: str
    group_name: Optional[str] = None
    requested_seats_count: int
    notes: Optional[str] = None

class GroupOrderCreate(GroupOrderBase):
    seat_ids: List[int]

class GroupOrderResponse(GroupOrderBase):
    id: int
    actual_seats_count: Optional[int] = None
    status: OrderStatus
    total_amount: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ReserveWindowBase(BaseModel):
    order_id: int
    show_id: int
    seat_ids: List[int]
    expire_at: datetime

class ReserveWindowCreate(ReserveWindowBase):
    pass

class ReserveWindowResponse(ReserveWindowBase):
    id: int
    status: ReserveWindowStatus
    created_at: datetime
    released_at: Optional[datetime] = None
    released_reason: Optional[str] = None

    class Config:
        from_attributes = True

class SeatChangeRequestBase(BaseModel):
    order_id: int
    show_id: int
    original_seat_ids: List[int]
    requested_seat_ids: List[int]
    new_seat_count: int
    reason: Optional[str] = None

class SeatChangeRequestCreate(SeatChangeRequestBase):
    pass

class SeatChangeReview(BaseModel):
    status: ChangeStatus
    review_notes: Optional[str] = None
    reviewed_by: str
    compensation_amount: Optional[float] = 0

class SeatChangeResponse(SeatChangeRequestBase):
    id: int
    status: ChangeStatus
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    compensation_amount: float
    created_at: datetime

    class Config:
        from_attributes = True

class LockReportBase(BaseModel):
    show_id: int
    order_id: Optional[int] = None
    report_type: str
    seat_ids: Optional[List[int]] = None
    seat_count: Optional[int] = None
    details: Optional[Dict[str, Any]] = None

class LockReportCreate(LockReportBase):
    generated_by: Optional[str] = "system"

class LockReportResponse(LockReportBase):
    id: int
    generated_at: datetime
    generated_by: Optional[str] = None

    class Config:
        from_attributes = True

class ExceptionLogBase(BaseModel):
    exception_type: ExceptionType
    endpoint: Optional[str] = None
    original_input: Dict[str, Any]
    error_message: Optional[str] = None

class ExceptionLogCreate(ExceptionLogBase):
    pass

class ExceptionResolve(BaseModel):
    resolution: str
    resolved_by: str

class ExceptionLogResponse(ExceptionLogBase):
    id: int
    resolution: Optional[str] = None
    resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ManualCorrection(BaseModel):
    correction_type: str
    target_id: int
    new_value: Any
    reason: str
    corrected_by: str

class ApiResponse(BaseModel):
    success: bool
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None