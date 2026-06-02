from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RecordStatus(str, Enum):
    PENDING = "待处理"
    PENDING_REVIEW = "待财务复核"
    PENDING_LINJIE = "待林姐确认"
    REVIEWED = "已复核"
    CORRECTED = "已修正"
    RERUN = "已重跑"
    RESOLVED = "已完成"


class NextStep(str, Enum):
    FINANCIAL_REVIEWER = "找财务复核人"
    LINJIE = "找基金会计林姐"
    HOLD = "暂存待确认"
    COMPLETE = "已完成"


@dataclass
class SupplementaryRecord:
    id: str
    reminder_id: str
    why_kept: str
    missing_materials: str
    next_step: NextStep
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: str = "system"
    updated_by: str = "system"


@dataclass
class TailAdjustmentEntry:
    id: str
    reminder_id: str
    amount_diff: float
    adjustment_reason: str
    remark: str
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = "system"
    linked_supplementary_id: Optional[str] = None


@dataclass
class AuditLog:
    id: str
    reminder_id: str
    action: str
    field_changed: str
    old_value: Any
    new_value: Any
    reason: str
    operator: str
    timestamp: datetime = field(default_factory=datetime.now)
    affected_results: str = ""


@dataclass
class InstitutionAlias:
    full_name: str
    aliases: List[str]
    standard_alias: str


@dataclass
class HolidayConfig:
    holiday_dates: List[str] = field(default_factory=list)
    weekend_days: List[int] = field(default_factory=lambda: [5, 6])


@dataclass
class BondRedemptionReminder:
    id: str
    bond_code: str
    bond_name: str
    institution_full_name: str
    institution_alias: str
    redemption_date: str
    original_redemption_date: str
    exercise_amount: float
    coupon_rate: float
    status: RecordStatus
    source: str
    import_batch: str
    has_alias_mismatch: bool = False
    alias_mismatch_note: str = ""
    detected_alias: str = ""
    has_holiday_adjustment: bool = False
    holiday_adjustment_note: str = ""
    has_tail_adjustment: bool = False
    tail_adjustments: List[TailAdjustmentEntry] = field(default_factory=list)
    supplementary_records: List[SupplementaryRecord] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    import_count: int = 1
    last_rerun_at: Optional[datetime] = None
