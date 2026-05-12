from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum


class SourceType(str, Enum):
    AD = "ad"
    EVENT = "event"
    REFERRAL = "referral"
    ORGANIC = "organic"


class CustomerType(str, Enum):
    B2B = "b2b"
    INDIVIDUAL = "individual"


class AttributionType(str, Enum):
    FIRST_TOUCH = "first_touch"
    LAST_TOUCH = "last_touch"
    WEIGHTED = "weighted"


class RecordStatus(str, Enum):
    ACTIVE = "active"
    BLACKLISTED = "blacklisted"
    MERGED = "merged"


class ImportStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class Customer:
    id: str
    name: str
    customer_type: CustomerType
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    external_id: Optional[str] = None
    status: RecordStatus = RecordStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Lead:
    id: str
    customer_id: str
    source_type: SourceType
    source_details: Dict[str, Any] = field(default_factory=dict)
    touch_time: datetime = field(default_factory=datetime.now)
    external_id: Optional[str] = None
    status: RecordStatus = RecordStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class AdClick:
    id: str
    customer_id: str
    campaign_id: str
    campaign_name: str
    channel: str
    click_time: datetime
    cost: float = 0.0
    external_id: Optional[str] = None
    status: RecordStatus = RecordStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EventAttendance:
    id: str
    customer_id: str
    event_id: str
    event_name: str
    event_type: str
    checkin_time: datetime
    booth: Optional[str] = None
    salesperson: Optional[str] = None
    external_id: Optional[str] = None
    status: RecordStatus = RecordStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Referral:
    id: str
    customer_id: str
    referrer_id: Optional[str]
    referrer_name: Optional[str]
    referral_time: datetime
    referral_channel: Optional[str] = None
    external_id: Optional[str] = None
    status: RecordStatus = RecordStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Deal:
    id: str
    customer_id: str
    deal_name: str
    amount: float
    close_time: datetime
    salesperson: Optional[str] = None
    pipeline_stage: Optional[str] = None
    external_id: Optional[str] = None
    status: str = "won"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Attribution:
    id: str
    deal_id: str
    customer_id: str
    attribution_type: AttributionType
    source_type: SourceType
    source_record_id: str
    source_record_type: str
    percentage: float
    amount: float
    is_manual: bool = False
    operator: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class AuditLog:
    id: str
    action: str
    record_type: str
    record_id: str
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    operator: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ImportSession:
    id: str
    source_type: str
    file_path: str
    total_records: int = 0
    success_count: int = 0
    failed_count: int = 0
    duplicate_count: int = 0
    blacklisted_count: int = 0
    status: ImportStatus = ImportStatus.PENDING
    error_message: Optional[str] = None
    started_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


@dataclass
class Blacklist:
    id: str
    identifier: str
    identifier_type: str
    reason: Optional[str] = None
    added_by: Optional[str] = None
    added_at: datetime = field(default_factory=datetime.now)


@dataclass
class SalesFollowUp:
    id: str
    customer_id: str
    deal_id: Optional[str] = None
    follow_up_time: datetime = field(default_factory=datetime.now)
    salesperson: Optional[str] = None
    status: str = "pending"
    notes: Optional[str] = None
    next_follow_up: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
