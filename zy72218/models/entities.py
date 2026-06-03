from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from uuid import uuid4


class MatchStatus(str, Enum):
    PENDING = "待匹配"
    MATCHED = "已匹配"
    DISCREPANCY = "存在差异"
    CONFLICT = "规则冲突"
    PENDING_REVIEW = "待主管复核"
    CONFIRMED = "已确认"


class RecordType(str, Enum):
    PRINCIPAL = "本金"
    FEE = "手续费"
    COMBINED = "合并"


class DiscrepancyStatus(str, Enum):
    OPEN = "待处理"
    CONFIRMED = "已确认"
    RESOLVED = "已解决"
    REJECTED = "已驳回"


class SelfCheckType(str, Enum):
    DUPLICATE_IMPORT = "重复导入检测"
    SPLIT_RECORD = "同一业务号拆分检测"
    RECALCULATION = "补录后重算校验"
    EXPORT_CONSISTENCY = "导出一致性校验"


@dataclass
class Invoice:
    invoice_id: str
    invoice_no: str
    invoice_date: date
    amount: float
    tax_amount: float
    total_amount: float
    seller: str
    buyer: str
    business_no: Optional[str] = None
    import_batch: Optional[str] = None
    imported_at: datetime = field(default_factory=datetime.now)
    imported_by: str = "system"


@dataclass
class FundMatchRecord:
    record_id: str = field(default_factory=lambda: str(uuid4()))
    business_no: str = ""
    record_type: RecordType = RecordType.COMBINED
    expected_amount: float = 0.0
    matched_amount: float = 0.0
    match_date: Optional[date] = None
    status: MatchStatus = MatchStatus.PENDING
    related_record_id: Optional[str] = None
    invoice_ids: List[str] = field(default_factory=list)
    calculation_details: Dict[str, Any] = field(default_factory=dict)
    holiday_extension_applied: bool = False
    tail_adjustment_applied: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    updated_by: str = "system"

    def is_split_record(self) -> bool:
        return self.related_record_id is not None and self.record_type in [
            RecordType.PRINCIPAL,
            RecordType.FEE,
        ]


@dataclass
class HolidayExtension:
    extension_id: str = field(default_factory=lambda: str(uuid4()))
    business_no: str = ""
    original_due_date: Optional[date] = None
    extended_due_date: Optional[date] = None
    extension_days: int = 0
    reason: str = ""
    conclusion: str = ""
    is_active: bool = True
    imported_at: datetime = field(default_factory=datetime.now)
    imported_by: str = "system"
    import_batch: Optional[str] = None


@dataclass
class TailAdjustment:
    adjustment_id: str = field(default_factory=lambda: str(uuid4()))
    business_no: str = ""
    adjustment_date: Optional[date] = None
    adjustment_amount: float = 0.0
    reason: str = ""
    calculation_rule: str = ""
    is_active: bool = True
    imported_at: datetime = field(default_factory=datetime.now)
    imported_by: str = "system"
    import_batch: Optional[str] = None


@dataclass
class ConflictEvidence:
    business_no: str
    holiday_conclusion: str
    tail_adjustment_rule: str
    holiday_amount: float
    tail_adjustment_amount: float
    difference: float
    description: str
    holiday_source: str
    tail_adjustment_source: str


@dataclass
class ConflictResolution:
    business_no: str
    resolution: DiscrepancyStatus
    chosen_rule: Optional[str] = None
    final_amount: Optional[float] = None
    operator: str = ""
    reason: str = ""
    resolved_at: Optional[datetime] = None


@dataclass
class DiscrepancyItem:
    discrepancy_id: str = field(default_factory=lambda: str(uuid4()))
    business_no: str = ""
    discrepancy_type: str = ""
    description: str = ""
    expected_value: Optional[float] = None
    actual_value: Optional[float] = None
    status: DiscrepancyStatus = DiscrepancyStatus.OPEN
    related_record_ids: List[str] = field(default_factory=list)
    is_split_record: bool = False
    requires_supervisor_review: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None


@dataclass
class AuditLog:
    log_id: str = field(default_factory=lambda: str(uuid4()))
    business_no: str = ""
    operator: str = ""
    action: str = ""
    field_changed: str = ""
    old_value: Any = None
    new_value: Any = None
    reason: str = ""
    affected_record_ids: List[str] = field(default_factory=list)
    affected_calculation_fields: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class SelfCheckResult:
    check_type: SelfCheckType
    passed: bool
    business_no: Optional[str] = None
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    checked_at: datetime = field(default_factory=datetime.now)
