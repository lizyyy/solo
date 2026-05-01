from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    DOOR_OPEN = "door_open"
    DOOR_CLOSE = "door_close"
    ITEM_TAKE = "item_take"
    ITEM_RETURN = "item_return"
    WEIGHT_SAMPLE = "weight_sample"
    PAYMENT_CALLBACK = "payment_callback"
    MANUAL_CORRECTION = "manual_correction"


class OrderStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    PAID = "paid"
    CANCELLED = "cancelled"
    DISPUTED = "disputed"


class WeightChange(BaseModel):
    channel_id: str
    weight_before: float
    weight_after: float
    delta_weight: float


class ItemChange(BaseModel):
    sku_id: str
    channel_id: str
    quantity: int
    unit_price: float


class Event(BaseModel):
    event_id: str
    event_type: EventType
    cabinet_id: str
    order_id: Optional[str] = None
    timestamp: datetime
    raw_data: Dict[str, Any]
    batch_id: Optional[str] = None
    validated: bool = False
    validation_errors: List[str] = Field(default_factory=list)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class DoorOpenEvent(Event):
    user_id: Optional[str] = None
    session_id: Optional[str] = None


class DoorCloseEvent(Event):
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    duration_seconds: Optional[int] = None


class ItemTakeEvent(Event):
    sku_id: str
    channel_id: str
    quantity: int
    recognized_by: str = "ai"


class ItemReturnEvent(Event):
    sku_id: str
    channel_id: str
    quantity: int
    recognized_by: str = "ai"


class WeightSampleEvent(Event):
    changes: List[WeightChange]
    total_weight_before: float
    total_weight_after: float


class PaymentCallbackEvent(Event):
    payment_id: str
    payment_status: str
    amount: float
    payment_method: str = "wechat"


class ManualCorrectionEvent(Event):
    operator_id: Optional[str] = None
    reason: str = ""
    item_changes: List[ItemChange]
    override_ai: bool = True


class QuarantinedEvent(BaseModel):
    event: Event
    quarantine_time: datetime
    reason: str
    batch_id: str


class CabinetInventory(BaseModel):
    cabinet_id: str
    last_updated: datetime
    channels: Dict[str, int] = Field(default_factory=dict)
    version: int = 0


class OrderReplayState(BaseModel):
    order_id: str
    cabinet_id: str
    status: OrderStatus
    events: List[Event] = Field(default_factory=list)
    item_takes: List[ItemTakeEvent] = Field(default_factory=list)
    item_returns: List[ItemReturnEvent] = Field(default_factory=list)
    payment_events: List[PaymentCallbackEvent] = Field(default_factory=list)
    manual_corrections: List[ManualCorrectionEvent] = Field(default_factory=list)
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    total_amount: float = 0.0
    paid_amount: float = 0.0
    has_manual_override: bool = False
    replay_notes: List[str] = Field(default_factory=list)


class BatchInfo(BaseModel):
    batch_id: str
    import_time: datetime
    source_files: List[str]
    event_count: int
    valid_event_count: int
    quarantined_count: int
    applied: bool = False
    applied_at: Optional[datetime] = None
    dry_run: bool = False


class AuditEntry(BaseModel):
    timestamp: datetime
    action: str
    batch_id: str
    user: str = "system"
    details: Dict[str, Any] = Field(default_factory=dict)
