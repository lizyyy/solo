from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class ProcessingStatus(str, Enum):
    PENDING = "待处理"
    IMPORTED = "已导入"
    CUSTODIAN_CONFIRMED = "托管已确认"
    AUDIT_UPDATED = "审计已更新"
    NEEDS_REVIEW = "需托管复核"
    RESOLVED = "已解决"
    ABNORMAL = "异常"


class AbnormalType(str, Enum):
    DUPLICATE = "重复导入"
    MIXED_CURRENCY = "币种同列"
    MISMATCH = "数据不一致"
    MISSING_DATA = "数据缺失"


class EntrySource(str, Enum):
    IMPORT = "首次导入"
    SUPPLEMENT = "补录"


@dataclass
class AuditTrail:
    timestamp: datetime
    operator: str
    action: str
    before_value: Optional[str] = None
    after_value: Optional[str] = None
    remark: Optional[str] = None


@dataclass
class AdjustmentEntry:
    id: str
    original_row_number: int
    security_code: str
    security_name: str
    original_amount: float
    original_currency: str
    manual_adjustment: Optional[float] = None
    adjusted_amount: Optional[float] = None
    current_status: ProcessingStatus = ProcessingStatus.PENDING
    abnormal_types: List[AbnormalType] = field(default_factory=list)
    audit_trails: List[AuditTrail] = field(default_factory=list)
    custodian_note: Optional[str] = None
    mixed_currency_note: Optional[str] = None
    raw_import_data: Dict[str, Any] = field(default_factory=dict)
    source: EntrySource = EntrySource.IMPORT
    supplement_batch_id: Optional[str] = None


@dataclass
class CustodianConfirmation:
    id: str
    adjustment_id: str
    custodian_operator: str
    confirm_time: datetime
    confirmed_amount: float
    confirmed_currency: str
    remark: Optional[str] = None
    is_manual_correction: bool = False


@dataclass
class PositionGapWarning:
    id: str
    report_date: str
    fund_code: str
    fund_name: str
    total_gap_amount: float = 0.0
    entries: List[AdjustmentEntry] = field(default_factory=list)
    custodian_confirmations: List[CustodianConfirmation] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    status: ProcessingStatus = ProcessingStatus.PENDING
    self_check_results: List[Dict[str, Any]] = field(default_factory=list)
    last_recalculate_time: Optional[str] = None
