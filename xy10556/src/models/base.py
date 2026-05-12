from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional


def timestamp_now() -> str:
    return datetime.now().isoformat()


@dataclass
class BaseRecord:
    created_at: str = field(default_factory=timestamp_now)
    updated_at: str = field(default_factory=timestamp_now)


@dataclass
class Order:
    order_id: str
    user_id: str
    total_amount: float
    paid_amount: float
    status: str
    created_at: str
    updated_at: str
    items: list
    activity_id: Optional[str] = None
    parent_order_id: Optional[str] = None
    split_order_ids: list = field(default_factory=list)
    returned_amount: float = 0.0
    reissued: bool = False
    reissue_count: int = 0
    gift_status: str = "待判断"
    gift_sku: Optional[str] = None
    gift_qty: int = 0
    gift_allocated_qty: int = 0
    gift_shipped_qty: int = 0
    gift_returned_qty: int = 0
    gift_deducted: bool = False
    gift_deduct_amount: float = 0.0
    remarks: str = ""


@dataclass
class OrderItem:
    sku: str
    name: str
    price: float
    quantity: int
    returned_quantity: int = 0


@dataclass
class ActivityRule:
    activity_id: str
    name: str
    start_time: str
    end_time: str
    threshold_amount: float
    gift_sku: str
    gift_name: str
    gift_qty_per_order: int
    is_active: bool = True
    description: str = ""
    return_deduct_rule: str = "amount_below_threshold"
    max_reissue_count: int = 1
    created_at: str = field(default_factory=timestamp_now)
    updated_at: str = field(default_factory=timestamp_now)


@dataclass
class GiftInventory:
    sku: str
    name: str
    total_qty: int
    available_qty: int
    allocated_qty: int = 0
    shipped_qty: int = 0
    returned_qty: int = 0
    reissued_qty: int = 0
    created_at: str = field(default_factory=timestamp_now)
    updated_at: str = field(default_factory=timestamp_now)


@dataclass
class ShipmentRecord:
    shipment_id: str
    order_id: str
    gift_sku: str
    gift_qty: int
    shipped_at: str
    operator: str = "system"
    tracking_no: Optional[str] = None
    created_at: str = field(default_factory=timestamp_now)
    updated_at: str = field(default_factory=timestamp_now)


@dataclass
class ReturnRecord:
    return_id: str
    order_id: str
    returned_amount: float
    returned_at: str
    reason: str = ""
    operator: str = "system"
    created_at: str = field(default_factory=timestamp_now)
    updated_at: str = field(default_factory=timestamp_now)


@dataclass
class ReissueTask:
    task_id: str
    order_id: str
    gift_sku: str
    qty: int
    reason: str
    status: str = "待处理"
    operator: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = field(default_factory=timestamp_now)
    updated_at: str = field(default_factory=timestamp_now)


@dataclass
class InventoryOperation:
    operation_id: str
    sku: str
    operation_type: str
    qty_change: int
    before_qty: int
    after_qty: int
    order_id: Optional[str] = None
    operator: str = "system"
    reason: str = ""
    created_at: str = field(default_factory=timestamp_now)
    updated_at: str = field(default_factory=timestamp_now)


@dataclass
class AuditLog:
    log_id: str
    entity_type: str
    entity_id: str
    action: str
    before: Dict[str, Any]
    after: Dict[str, Any]
    operator: str = "system"
    reason: str = ""
    created_at: str = field(default_factory=timestamp_now)
    updated_at: str = field(default_factory=timestamp_now)


@dataclass
class SystemState:
    initialized: bool = False
    version: int = 1
    last_action: Optional[str] = None
    last_action_time: Optional[str] = None
