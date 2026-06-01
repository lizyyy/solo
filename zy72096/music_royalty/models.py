from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum


class RevenueType(str, Enum):
    STREAMING = "流媒体播放"
    SYNC_LICENSE = "同步授权"
    DOWNLOAD = "下载收益"
    PUBLIC_PERFORMANCE = "公播收益"


class Currency(str, Enum):
    CNY = "CNY"
    USD = "USD"


class PlayCountUnit(str, Enum):
    TIMES = "次"
    TEN_THOUSAND = "万次"
    MILLION = "百万次"


class RevenueUnit(str, Enum):
    YUAN = "元"
    WAN_YUAN = "万元"
    USD_UNIT = "美元"


class PerPlayUnit(str, Enum):
    YUAN_PER_PLAY = "元/次"
    YUAN_PER_1K = "元/千次"
    USD_PER_STREAM = "美元/流"


class TimePeriod(str, Enum):
    MONTH = "月"
    YEAR = "年"


class ShareFormat(str, Enum):
    DECIMAL = "小数"
    PERCENT = "百分比"


@dataclass
class RoyaltyRecord:
    record_id: str
    work_title: str
    revenue_type: RevenueType
    play_count: float
    play_count_unit: PlayCountUnit
    per_play_revenue: float
    per_play_revenue_unit: PerPlayUnit
    decay_factor: Optional[float] = None
    platform_share: Optional[float] = None
    rights_share: Optional[float] = None
    months_since_release: Optional[int] = None
    share_format: ShareFormat = ShareFormat.DECIMAL
    currency: Currency = Currency.CNY
    source: str = ""
    raw_fields: Dict[str, Any] = field(default_factory=dict)
    manually_adjusted: bool = False
    is_exception: bool = False
    exception_note: str = ""


@dataclass
class RoyaltyResult:
    record_id: str
    work_title: str
    revenue_type: str
    play_count_normalized: float
    play_count_unit_used: str
    per_play_revenue_normalized: float
    per_play_revenue_unit_used: str
    decay_factor_used: float
    decay_source: str
    platform_share_used: float
    platform_share_source: str
    rights_share_used: float
    rights_share_source: str
    months_since_release: int
    gross_revenue: float
    net_revenue: float
    revenue_currency: str
    formula_steps: List[str]
    boundary_warnings: List[str]
    is_exception: bool
    exception_note: str
    audit_entries: List['AuditEntry'] = field(default_factory=list)


@dataclass
class ConflictItem:
    record_id: str
    field_name: str
    param_value: Any
    param_source: str
    data_value: Any
    data_source: str
    suggestion: str


@dataclass
class AuditEntry:
    record_id: str
    timestamp: str
    action: str
    detail: str
    original_source: str
