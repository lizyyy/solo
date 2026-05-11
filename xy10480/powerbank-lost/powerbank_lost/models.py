from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class OrderStatus(str, Enum):
    NORMAL_RETURN = "normal_return"
    RETURN_FAILED = "return_failed"
    SUSPICIOUS_LOST = "suspicious_lost"
    CONFIRMED_LOST = "confirmed_lost"
    APPEAL_PENDING = "appeal_pending"
    APPEAL_APPROVED = "appeal_approved"
    APPEAL_REJECTED = "appeal_rejected"


class AppealReason(str, Enum):
    ALREADY_RETURNED = "already_returned"
    CABINET_FAULT = "cabinet_fault"
    WRONG_CHARGE = "wrong_charge"
    OTHER = "other"


@dataclass
class BorrowRecord:
    order_id: str
    user_id: str
    device_id: str
    cabinet_id: str
    borrow_time: datetime
    is_confirmed: bool = False
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReturnRecord:
    order_id: str
    user_id: str
    device_id: str
    cabinet_id: str
    return_time: datetime
    slot_id: str
    is_confirmed: bool = False
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CabinetStatus:
    cabinet_id: str
    report_time: datetime
    is_online: bool
    slot_status: Dict[str, str]
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FeeRule:
    rule_id: str
    region: str
    base_fee: float
    per_hour_fee: float
    max_daily_fee: float
    lost_fee: float
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Appeal:
    appeal_id: str
    order_id: str
    user_id: str
    reason: AppealReason
    description: str
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewer_note: Optional[str] = None


@dataclass
class FeeAdjustment:
    adjustment_id: str
    order_id: str
    original_fee: float
    adjusted_fee: float
    reason: str
    created_at: datetime
    operator: str


@dataclass
class Order:
    order_id: str
    user_id: str
    device_id: str
    borrow_cabinet_id: str
    borrow_time: datetime
    return_cabinet_id: Optional[str] = None
    return_time: Optional[datetime] = None
    return_slot_id: Optional[str] = None
    status: OrderStatus = OrderStatus.SUSPICIOUS_LOST
    status_reason: str = ""
    original_fee: float = 0.0
    adjusted_fee: Optional[float] = None
    appeal: Optional[Appeal] = None
    fee_adjustments: List[FeeAdjustment] = field(default_factory=list)
    is_confirmed: bool = False
    cabinet_offline_at: Optional[datetime] = None
    multiple_return_users: List[str] = field(default_factory=list)

    @property
    def final_fee(self) -> float:
        return self.adjusted_fee if self.adjusted_fee is not None else self.original_fee

    @property
    def status_display(self) -> str:
        display_map = {
            OrderStatus.NORMAL_RETURN: "正常归还",
            OrderStatus.RETURN_FAILED: "归还失败",
            OrderStatus.SUSPICIOUS_LOST: "疑似丢失",
            OrderStatus.CONFIRMED_LOST: "已确认丢失",
            OrderStatus.APPEAL_PENDING: "申诉待处理",
            OrderStatus.APPEAL_APPROVED: "申诉通过",
            OrderStatus.APPEAL_REJECTED: "申诉驳回",
        }
        return display_map.get(self.status, self.status.value)
