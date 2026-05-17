from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List
import uuid


class MealVoucherStatus(Enum):
    ISSUED = "已发放"
    USED = "已使用"
    CANCELLED = "已取消"
    EXPIRED = "已过期"


class MeetingStatus(Enum):
    SCHEDULED = "已安排"
    IN_PROGRESS = "进行中"
    COMPLETED = "已完成"
    CANCELLED = "已取消"
    POSTPONED = "已延期"


class VerificationStatus(Enum):
    PENDING = "待核销"
    VERIFIED = "已核销"
    NO_ACTION = "无需核销"
    CONFLICT = "冲突"


@dataclass
class Visitor:
    visitor_id: str
    name: str
    phone: str
    company: str
    visit_date: datetime


@dataclass
class Meeting:
    meeting_id: str
    title: str
    host: str
    scheduled_time: datetime
    end_time: datetime
    status: MeetingStatus
    cancel_reason: Optional[str] = None
    cancel_time: Optional[datetime] = None


@dataclass
class MealVoucher:
    voucher_code: str
    visitor_id: str
    meeting_id: str
    issue_time: datetime
    valid_from: datetime
    valid_to: datetime
    status: MealVoucherStatus = MealVoucherStatus.ISSUED
    use_time: Optional[datetime] = None
    use_location: Optional[str] = None


@dataclass
class VerificationRecord:
    record_id: str
    voucher_code: str
    verification_time: datetime
    status: VerificationStatus
    operator: str
    notes: Optional[str] = None


@dataclass
class VerificationReport:
    report_id: str
    generated_at: datetime
    total_vouchers: int
    to_verified: int
    pending_count: int
    conflict_count: int
    no_action_count: int
    details: List[dict] = field(default_factory=list)
