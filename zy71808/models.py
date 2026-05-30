from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import uuid4


class ConclusionStatus(str, Enum):
    NORMAL = "正常"
    PENDING = "待确认"
    ABNORMAL = "异常"
    REVISED = "已修正"


class DataSourceStatus(str, Enum):
    ORIGINAL = "原始"
    SUPPLEMENTED = "补传"
    MANUAL_MODIFIED = "手工修改"


class ChangeType(str, Enum):
    MATERIAL_ONLY = "仅补材料"
    CONCLUSION_CHANGED = "修改结论"
    MIXED = "混合变更"
    NO_CHANGE = "无变更"


class RiskFlag(str, Enum):
    NONE = "无"
    MANUAL_NOTE_OVERRIDE = "人工备注覆盖旧结论"
    DUPLICATE_CREDIT = "重复授信"
    FREEZE_NOT_RELEASED = "冻结额度未释放"
    MISSING_REVIEW_REPORT = "复核日报缺失"
    LATE_SUPPLEMENT = "后补材料"


@dataclass
class CreditLine:
    credit_id: str
    customer_id: str
    customer_name: str
    total_amount: float
    used_amount: float
    available_amount: float
    effective_date: datetime
    expiry_date: datetime
    data_source: DataSourceStatus = DataSourceStatus.ORIGINAL
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    manual_note: Optional[str] = None
    previous_conclusion: Optional[str] = None

    @property
    def utilization_rate(self) -> float:
        if self.total_amount == 0:
            return 0.0
        return self.used_amount / self.total_amount


@dataclass
class FreezeRecord:
    freeze_id: str
    credit_id: str
    amount: float
    freeze_reason: str
    freeze_date: datetime
    release_date: Optional[datetime] = None
    is_released: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    note: Optional[str] = None


@dataclass
class ReviewReport:
    report_id: str
    report_date: datetime
    version: int
    asset_pool_id: str
    content: str
    total_asset: float
    total_liability: float
    pressure_gap: float
    conclusion: str
    reviewer: str
    data_source: DataSourceStatus = DataSourceStatus.ORIGINAL
    supplementary_email_date: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    manual_note: Optional[str] = None
    previous_report_id: Optional[str] = None
    risk_flags: List[RiskFlag] = field(default_factory=list)


@dataclass
class AssetPool:
    pool_id: str
    pool_name: str
    total_asset: float
    total_liability: float
    asset_list: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class OperationLog:
    operator: str
    operation_type: str
    target_id: str
    target_type: str
    log_id: str = field(default_factory=lambda: str(uuid4()))
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class PendingConfirmation:
    gap_result_id: str
    risk_flag: RiskFlag
    description: str
    affected_items: List[str]
    confirm_id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=datetime.now)
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    is_confirmed: bool = False


@dataclass
class GapCalculationResult:
    asset_pool_id: str
    calculation_date: datetime
    base_gap: float
    adjusted_gap: float
    pressure_gap_ratio: float
    credit_lines: List[CreditLine]
    freeze_records: List[FreezeRecord]
    review_report: Optional[ReviewReport]
    conclusion: str
    status: ConclusionStatus
    risk_flags: List[RiskFlag]
    result_id: str = field(default_factory=lambda: str(uuid4()))
    pending_confirmations: List[PendingConfirmation] = field(default_factory=list)
    change_type: ChangeType = ChangeType.NO_CHANGE
    previous_result_id: Optional[str] = None
    version_diffs: List[str] = field(default_factory=list)
    human_readable_notes: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class UserFriendlyError(Exception):
    error_code: str
    user_message: str
    technical_details: Optional[str] = None
    suggestion: Optional[str] = None

    def __str__(self) -> str:
        return self.user_message
