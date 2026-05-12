from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any


class LeadStatus(str, Enum):
    IMPORTED = "imported"
    PENDING = "pending"
    CALLABLE = "callable"
    DEFERRED = "deferred"
    BLOCKED = "blocked"
    CONNECTED = "connected"
    REJECTED = "rejected"
    MANUAL_RELEASED = "manual_released"


class BlockReason(str, Enum):
    BLACKLIST = "blacklist"
    DUPLICATE = "duplicate"
    WRONG_TIMEZONE = "wrong_timezone"
    USER_REJECTED = "user_rejected"
    COMPLIANCE = "compliance"
    INVALID_NUMBER = "invalid_number"
    INVALID_CALLBACK = "invalid_callback"


class CallResult(str, Enum):
    CONNECTED = "connected"
    NO_ANSWER = "no_answer"
    REJECTED = "rejected"
    LINE_BUSY = "line_busy"
    INVALID_NUMBER = "invalid_number"
    CALLBACK_SCHEDULED = "callback_scheduled"


@dataclass
class Lead:
    id: str
    phone: str
    name: str
    type: str
    region: str
    timezone: str
    created_at: datetime
    status: LeadStatus = LeadStatus.IMPORTED
    block_reason: Optional[BlockReason] = None
    manual_release_reason: Optional[str] = None
    source_file: str = ""
    extra_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BlacklistEntry:
    id: str
    phone: str
    reason: str
    created_at: datetime
    source: str
    is_active: bool = True


@dataclass
class CallHistory:
    id: str
    lead_id: str
    phone: str
    call_time: datetime
    result: CallResult
    agent: str = ""
    notes: str = ""


@dataclass
class CallbackSchedule:
    id: str
    lead_id: str
    phone: str
    scheduled_time: datetime
    timezone: str
    reason: str
    created_by: str
    created_at: datetime
    is_done: bool = False


@dataclass
class TimezoneRule:
    id: str
    region: str
    timezone: str
    call_window_start: int
    call_window_end: int
    is_active: bool = True


@dataclass
class ComplianceRule:
    id: str
    name: str
    description: str
    is_active: bool = True
    phone_pattern: str = ""
    time_window_start: int = 0
    time_window_end: int = 23


@dataclass
class OperationLog:
    id: str
    operation_type: str
    target_id: str
    target_type: str
    operator: str
    timestamp: datetime
    previous_state: str
    new_state: str
    reason: str = ""


@dataclass
class CheckResult:
    lead_id: str
    phone: str
    status: LeadStatus
    block_reason: Optional[BlockReason] = None
    callback_scheduled: Optional[datetime] = None
    details: str = ""
