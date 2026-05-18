from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Optional, List, Dict
from uuid import uuid4


class SubscriptionStatus(Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class ChangeType(Enum):
    SWAP_FLOWER = "swap_flower"
    PAUSE = "pause"
    RESUME = "resume"
    CANCEL = "cancel"


class AdjustmentStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"


@dataclass
class Flower:
    flower_id: str
    name: str
    price: float
    current_stock: int
    min_stock: int = 0
    supplier: str = ""
    last_updated: datetime = field(default_factory=datetime.now)


@dataclass
class SubscriptionPlan:
    plan_id: str
    name: str
    frequency_days: int
    base_price: float
    flower_count: int
    description: str = ""


@dataclass
class Subscription:
    subscription_id: str
    customer_id: str
    plan_id: str
    start_date: date
    end_date: Optional[date]
    status: SubscriptionStatus
    current_flower_ids: List[str]
    total_price: float
    pause_history: List[Dict] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    notes: str = ""


@dataclass
class DeliverySchedule:
    schedule_id: str
    subscription_id: str
    delivery_date: date
    flower_ids: List[str]
    status: str
    actual_delivery_date: Optional[date] = None
    address: str = ""
    driver_id: str = ""
    notes: str = ""


@dataclass
class ChangeRequest:
    request_id: str = field(default_factory=lambda: str(uuid4()))
    subscription_id: str = ""
    change_type: ChangeType = ChangeType.SWAP_FLOWER
    request_date: datetime = field(default_factory=datetime.now)
    effective_date: date = field(default_factory=date.today)
    old_flower_ids: List[str] = field(default_factory=list)
    new_flower_ids: List[str] = field(default_factory=list)
    pause_end_date: Optional[date] = None
    status: AdjustmentStatus = AdjustmentStatus.PENDING
    requested_by: str = ""
    notes: str = ""
    execution_order: int = 0


@dataclass
class PriceDifference:
    diff_id: str = field(default_factory=lambda: str(uuid4()))
    subscription_id: str = ""
    change_request_id: str = ""
    old_price: float = 0.0
    new_price: float = 0.0
    difference: float = 0.0
    adjustment_type: str = ""
    recorded_at: datetime = field(default_factory=datetime.now)
    billing_status: str = "pending"


@dataclass
class InventoryLog:
    log_id: str = field(default_factory=lambda: str(uuid4()))
    flower_id: str = ""
    change_type: str = ""
    quantity_change: int = 0
    previous_stock: int = 0
    new_stock: int = 0
    reason: str = ""
    related_request_id: str = ""
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class DeliveryReport:
    report_id: str = field(default_factory=lambda: str(uuid4()))
    subscription_id: str = ""
    period_start: date = field(default_factory=date.today)
    period_end: date = field(default_factory=date.today)
    total_deliveries: int = 0
    completed_deliveries: int = 0
    paused_days: int = 0
    total_adjustments: int = 0
    price_adjustments_total: float = 0.0
    flower_changes: List[Dict] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)
