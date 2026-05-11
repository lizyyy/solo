"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class CustomerLevel(Enum):
    VIP = "VIP"
    GOLD = "GOLD"
    SILVER = "SILVER"
    NORMAL = "NORMAL"


class CancellationStatus(Enum):
    FREE = "免费取消"
    CHARGED = "收取消费"
    COMPENSATION = "需要赔付"
    WAIVED = "人工减免"
    EXCEPTION = "异常"


class CancellationType(Enum):
    CANCEL = "直接取消"
    CHANGE = "改船"


@dataclass
class Booking:
    booking_no: str
    customer_id: str
    customer_name: str
    customer_level: CustomerLevel
    vessel_name: str
    voyage_no: str
    origin_port: str
    destination_port: str
    container_qty: int
    container_type: str
    freight_rate: float
    booking_date: datetime
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ScheduleRule:
    vessel_name: str
    voyage_no: str
    etd: datetime
    cutoff_time: datetime
    free_cancel_hours: int
    charge_rate: float
    compensation_rate: float


@dataclass
class CancellationRecord:
    id: str
    booking_no: str
    customer_id: str
    cancellation_type: CancellationType
    cancellation_time: datetime
    new_vessel_name: Optional[str] = None
    new_voyage_no: Optional[str] = None
    original_vessel_released: bool = True
    status: CancellationStatus = CancellationStatus.FREE
    original_fee: float = 0.0
    charged_fee: float = 0.0
    waiver_reason: Optional[str] = None
    waiver_operator: Optional[str] = None
    waiver_time: Optional[datetime] = None
    is_repeat_import: bool = False
    exceptions: List[str] = field(default_factory=list)
    processed: bool = False
