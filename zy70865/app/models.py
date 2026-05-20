from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ItemStatus(str, Enum):
    NORMAL = "normal"
    PENDING = "pending"
    FAILED = "failed"


class DamageType(str, Enum):
    TEAR = "tear"
    STAIN = "stain"
    HOLE = "hole"
    WEAR = "wear"
    UNKNOWN = "unknown"


class WashItem(BaseModel):
    batch_id: str
    item_type: str
    quantity: int
    room_type: Optional[str] = None
    send_time: datetime
    laundry_factory: str


class RecycleItem(BaseModel):
    batch_id: str
    item_type: str
    quantity: int
    room_type: Optional[str] = None
    recycle_time: datetime
    damage_quantity: int = 0
    damage_type: Optional[DamageType] = None
    damage_note: Optional[str] = None


class RoomTypeConfig(BaseModel):
    room_type: str
    linen_config: Dict[str, int] = Field(default_factory=dict)


class CompensationRecord(BaseModel):
    compensation_id: str
    source_batch_id: str
    source_item_type: str
    reason: str
    quantity: int
    unit_price: float
    total_amount: float
    suggestion: str
    created_at: datetime


class ReconciliationItem(BaseModel):
    item_type: str
    room_type: Optional[str]
    status: ItemStatus
    wash_quantity: int
    recycle_quantity: int
    difference: int
    raw_wash_data: Optional[Dict[str, Any]] = None
    raw_recycle_data: Optional[Dict[str, Any]] = None
    suggestion: Optional[str] = None
    compensation: Optional[CompensationRecord] = None
    damage_details: Optional[Dict[str, Any]] = None


class ReconciliationResult(BaseModel):
    batch_id: str
    reconciliation_time: datetime
    total_wash: int
    total_recycle: int
    normal_count: int
    pending_count: int
    failed_count: int
    normal_items: List[ReconciliationItem]
    pending_items: List[ReconciliationItem]
    failed_items: List[ReconciliationItem]
    total_compensation: float


class BatchSubmissionResponse(BaseModel):
    success: bool
    message: str
    batch_id: str
    is_duplicate: bool
    result: Optional[ReconciliationResult] = None
