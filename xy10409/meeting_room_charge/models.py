from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class BookingStatus(Enum):
    NORMAL = "正常使用"
    LATE = "迟到"
    EARLY_CANCEL = "提前取消"
    NO_SHOW = "爽约"
    OVERTIME = "超时"
    PENDING = "待处理"


class AppealStatus(Enum):
    PENDING = "待处理"
    APPROVED = "申诉通过"
    REJECTED = "申诉驳回"


@dataclass
class Member:
    member_id: str
    name: str
    phone: str
    membership_level: str
    weekly_free_amount: float = 0.0
    used_free_amount: float = 0.0


@dataclass
class Booking:
    booking_id: str
    member_id: str
    room_name: str
    start_time: datetime
    end_time: datetime
    cancel_time: Optional[datetime] = None
    status: BookingStatus = BookingStatus.PENDING


@dataclass
class Checkin:
    checkin_id: str
    booking_id: Optional[str]
    member_id: str
    checkin_time: datetime
    checkout_time: Optional[datetime] = None
    is_processed: bool = False


@dataclass
class Charge:
    charge_id: str
    booking_id: str
    member_id: str
    charge_type: BookingStatus
    amount: float
    charge_date: datetime
    is_appealed: bool = False
    appeal_status: Optional[AppealStatus] = None
    appeal_reason: str = ""
    final_amount: Optional[float] = None


@dataclass
class ExceptionRecord:
    exception_id: str
    record_type: str
    record_id: str
    reason: str
    created_at: datetime
    is_resolved: bool = False
