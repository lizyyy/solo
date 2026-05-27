from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class ItemStatus(str, Enum):
    NORMAL = "normal"
    PENDING = "pending"
    FAILED = "failed"


class SuggestedAction(str, Enum):
    APPROVE = "approve"
    MANUAL_REVIEW = "manual_review"
    REQUEST_EVIDENCE = "request_evidence"
    REJECT = "reject"
    RECALCULATE = "recalculate"


class ElectricityTier(BaseModel):
    min_kwh: float
    max_kwh: Optional[float]
    price_per_kwh: float


class Property(BaseModel):
    property_id: str
    electricity_tiers: List[ElectricityTier]
    water_price_per_ton: float
    deposit_amount: float


class MeterReading(BaseModel):
    property_id: str
    order_id: str
    checkin_date: str
    checkout_date: str
    electricity_start: float
    electricity_end: float
    water_start: float
    water_end: float
    raw_data: Dict[str, Any]


class Order(BaseModel):
    order_id: str
    property_id: str
    guest_name: str
    checkin_date: str
    checkout_date: str
    daily_rate: float
    total_amount: float
    deposit_amount: float
    actual_deposit_refund: Optional[float] = None
    deductions: List[Dict[str, Any]] = Field(default_factory=list)


class DamageClaim(BaseModel):
    order_id: str
    property_id: str
    damage_type: str
    description: str
    claimed_amount: float
    has_photo: bool
    photo_filename: Optional[str] = None
    raw_data: Dict[str, Any]


class ReconcileItem(BaseModel):
    item_id: str
    order_id: str
    property_id: str
    guest_name: str
    status: ItemStatus
    category: str
    description: str
    original_amount: float
    calculated_amount: float
    difference: float
    raw_fields: Dict[str, Any]
    suggested_action: SuggestedAction
    reason: str
    evidence_status: Optional[str] = None
    rule_applied: Optional[str] = None


class ReconcileResult(BaseModel):
    batch_id: str
    processed_at: datetime
    total_items: int
    normal_count: int
    pending_count: int
    failed_count: int
    normal_items: List[ReconcileItem]
    pending_items: List[ReconcileItem]
    failed_items: List[ReconcileItem]


class BatchSubmission(BaseModel):
    batch_id: str
    submitted_at: datetime
    meter_reading_count: int
    order_count: int
    damage_count: int
    status: str
