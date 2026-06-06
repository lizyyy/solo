from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "正常"
    AREA_MISSING = "授权地区待复核"
    PENDING_REVIEW = "待店长复核"
    NEEDS_VERIFICATION = "信息待补全"
    FROM_OLD_STANDARD = "旧口径补录"
    UPDATED = "已更新"


@dataclass
class EquipmentRecord:
    id: str
    equipment_name: str
    borrower: str
    authorized_cities: List[str]
    actual_cities: List[str]
    authorized_start: str
    authorized_end: str
    actual_use_date: str
    hours_used: float
    tuner_message: Optional[str] = None
    status: RecordStatus = RecordStatus.NORMAL
    review_note: Optional[str] = None
    is_old_standard: bool = False
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))


@dataclass
class VerificationResult:
    record_id: str
    issues: List[str]
    suggestions: List[str]
    needs_manager_review: bool


@dataclass
class HourlyVerification:
    id: str
    record_id: str
    equipment_name: str
    original_hours: float
    adjusted_hours: float
    reason: str
    updated_by: str
    updated_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
