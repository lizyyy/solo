from __future__ import annotations

from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class PackageStatus(str, Enum):
    PENDING = "pending"
    PICKED = "picked"
    RETURNED = "returned"
    OVERDUE = "overdue"
    LOST = "lost"
    EXCEPTION = "exception"


class DisposalType(str, Enum):
    RELEASE = "release"
    RETURN = "return"
    SUPPLEMENT = "supplement"
    MANUAL_REVIEW = "manual_review"


class SmsType(str, Enum):
    ARRIVAL = "arrival"
    REMINDER = "reminder"
    OVERDUE = "overdue"
    RETURN_NOTICE = "return_notice"


class DifferenceType(str, Enum):
    OVERDUE_PICKUP = "overdue_pickup"
    DUPLICATE_REMINDER = "duplicate_reminder"
    PRIVACY_MASKED = "privacy_masked"
    MISSING_SMS = "missing_sms"
    MISMATCH_STATUS = "mismatch_status"
    RULE_EXCEPTION = "rule_exception"


class Package(BaseModel):
    package_id: str
    tracking_no: str
    recipient_name: str
    recipient_phone: str
    pickup_code: str
    arrival_date: date
    status: PackageStatus
    pickup_date: Optional[date] = None
    shelf_location: Optional[str] = None
    courier_company: Optional[str] = None
    weight: Optional[float] = None

    @field_validator("recipient_phone")
    def mask_phone(cls, v: str) -> str:
        if len(v) >= 11:
            return v[:3] + "****" + v[-4:]
        return v

    @field_validator("recipient_name")
    def mask_name(cls, v: str) -> str:
        if len(v) > 1:
            return v[0] + "*" * (len(v) - 1)
        return v


class SmsRecord(BaseModel):
    sms_id: str
    package_id: str
    sms_type: SmsType
    send_time: datetime
    content: str
    recipient_phone: str
    delivery_status: str = "delivered"


class ReturnRule(BaseModel):
    rule_id: str
    rule_name: str
    overdue_days: int
    priority: int = 1
    description: str
    enabled: bool = True


class ReconciliationStatus(str, Enum):
    AUTO_MATCHED = "auto_matched"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    EXPORTED = "exported"


class DisposalRecord(BaseModel):
    id: str
    package_id: str
    disposal_type: DisposalType
    reason: str
    difference_types: List[DifferenceType]
    evidence: List[str]
    created_at: datetime
    created_by: str = "system"
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    review_note: Optional[str] = None
    status: ReconciliationStatus = ReconciliationStatus.AUTO_MATCHED


class AuditLog(BaseModel):
    log_id: str
    package_id: str
    action: str
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    operator: str
    timestamp: datetime
    note: Optional[str] = None


class SummaryReport(BaseModel):
    total_packages: int
    picked_on_time: int
    overdue_count: int
    returned_count: int
    manual_review_count: int
    duplicate_reminder_count: int
    pending_supplement_count: int
    average_pickup_days: float
    reconciliation_date: datetime
