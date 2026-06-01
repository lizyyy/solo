from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class DataSource(str, Enum):
    EXPERIMENT_TABLE = "实验表"
    PHOTO_NOTE = "照片说明"
    WORKING_CONDITION = "工况记录"
    WECHAT_GROUP = "维修微信群"
    MANUAL_SUPPLEMENT = "人工补录"


class Direction(str, Enum):
    SUPPLY = "送风"
    EXHAUST = "排风"
    RECIRCULATE = "回风"
    UNKNOWN = "方向未明"


class VerificationStatus(str, Enum):
    AUTO_PASS = "自动通过"
    NEED_MANUAL_CHECK = "需人工确认"
    WECHAT_SUPPLEMENT = "微信群补录"
    PENDING = "待处理"
    REJECTED = "已驳回"


@dataclass
class AirExchangeRecord:
    record_id: str
    measure_time: datetime
    location: str
    direction: Direction
    air_volume: float
    unit: str
    time_interval_min: int
    source: DataSource
    wechat_notes: Optional[str] = None
    photo_desc: Optional[str] = None
    working_condition: Optional[str] = None
    raw_wechat_content: Optional[str] = None
    verification_status: VerificationStatus = VerificationStatus.PENDING
    verification_notes: List[str] = field(default_factory=list)
    is_extreme_value: bool = False
    extreme_value_reason: Optional[str] = None
    calculated_efficiency: Optional[float] = None
    processing_suggestion: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    version: int = 1
    parent_record_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        for enum_field in ['direction', 'source', 'verification_status']:
            if isinstance(data.get(enum_field), Enum):
                data[enum_field] = data[enum_field].value
        data['measure_time'] = self.measure_time.isoformat()
        data['created_at'] = self.created_at.isoformat()
        data['updated_at'] = self.updated_at.isoformat()
        return data


@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    suggestions: List[str]


@dataclass
class EfficiencyResult:
    record_id: str
    raw_efficiency: float
    adjusted_efficiency: float
    is_extreme: bool
    extreme_type: Optional[str]
    calculation_method: str
    raw_values: List[float]
    notes: List[str]


@dataclass
class VersionComparison:
    record_id: str
    old_version: int
    new_version: int
    field_changes: Dict[str, Dict[str, Any]]
    efficiency_change: Optional[float]
    status_change: Optional[tuple]
    processing_note: str
