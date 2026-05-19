from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class EventStatus(str, Enum):
    RECEIVED_OLD = "received_old"
    RECEIVED_NEW = "received_new"
    DUAL_DELIVERED = "dual_delivered"
    MISSING_NEW = "missing_new"
    MISSING_OLD = "missing_old"
    VERIFIED = "verified"
    FAILED = "failed"


class SwitchState(str, Enum):
    INIT = "init"
    DUAL_DELIVERY = "dual_delivery"
    VERIFYING = "verifying"
    READY_TO_SWITCH = "ready_to_switch"
    SWITCHED = "switched"
    ROLLBACK = "rollback"


class WebhookEvent(BaseModel):
    vendor: str
    event_type: str
    event_id: str
    timestamp: datetime
    endpoint: str
    payload_hash: Optional[str] = None
    status_code: Optional[int] = None
    raw: Optional[str] = None
    source_file: str
    line_number: int


class DualDeliveryResult(BaseModel):
    event_id: str
    event_type: str
    vendor: str
    old_received: bool
    new_received: bool
    old_timestamp: Optional[datetime] = None
    new_timestamp: Optional[datetime] = None
    payload_match: Optional[bool] = None
    within_window: bool
    status: EventStatus
    time_diff_seconds: Optional[float] = None


class VerificationRule(BaseModel):
    vendor: str
    event_type: str
    dual_delivery_window_seconds: int = 300
    min_success_rate: float = 0.95
    required_consecutive_success: int = 100


class SwitchConclusion(BaseModel):
    vendor: str
    event_type: str
    state: SwitchState
    can_switch: bool
    success_rate: float
    verified_count: int
    failed_count: int
    total_events: int
    recommendation: str
    details: Dict[str, Any] = Field(default_factory=dict)


class BadLine(BaseModel):
    source_file: str
    line_number: int
    content: str
    error: str


class ParseResult(BaseModel):
    valid_events: list[WebhookEvent]
    bad_lines: list[BadLine]
    total_lines: int
