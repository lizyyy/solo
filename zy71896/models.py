from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class ThresholdLevel(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class DataSource(str, Enum):
    THRESHOLD_TABLE = "阈值表"
    MAINTENANCE_ORDER = "维修单"
    VIBRATION_CURVE = "振动曲线"
    MANUAL_EDIT = "人工修改"
    AUTO_CALC = "自动计算"


class ConclusionType(str, Enum):
    QUALIFIED = "合格"
    UNQUALIFIED = "不合格"
    PENDING = "待补充材料"
    CROSS_LEVEL = "跨档待确认"


class ChangeType(str, Enum):
    MATERIAL_ONLY = "仅补材料"
    CONCLUSION_CHANGED = "结论变更"
    CURVE_EDITED = "曲线人工修改"
    THRESHOLD_UPDATED = "阈值更新"
    MAINTENANCE_SUPPLIED = "维修单补录"


@dataclass
class ThresholdTable:
    id: str
    elevator_id: str
    received_at: datetime
    level: ThresholdLevel
    max_acceleration: float
    min_acceleration: float
    source: str = "阈值表"
    notes: Optional[str] = None


@dataclass
class MaintenanceOrder:
    id: str
    elevator_id: str
    received_at: datetime
    related_threshold_id: Optional[str] = None
    actual_max_acceleration: Optional[float] = None
    actual_min_acceleration: Optional[float] = None
    maintenance_date: Optional[datetime] = None
    operator: Optional[str] = None
    notes: Optional[str] = None
    is_late_supply: bool = False


@dataclass
class VibrationPoint:
    timestamp: float
    acceleration: float


@dataclass
class VibrationCurve:
    id: str
    elevator_id: str
    measured_at: datetime
    points: List[VibrationPoint]
    is_manually_edited: bool = False
    edited_by: Optional[str] = None
    edited_at: Optional[datetime] = None
    edit_reason: Optional[str] = None
    original_curve_id: Optional[str] = None


@dataclass
class ChangeRecord:
    id: str
    timestamp: datetime
    change_type: ChangeType
    field_name: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    data_source: DataSource = DataSource.MANUAL_EDIT
    operator: Optional[str] = None
    reason: Optional[str] = None
    affects_conclusion: bool = False


@dataclass
class JudgmentStep:
    step_order: int
    description: str
    judgment: str
    reason: str
    evidence: Dict[str, Any] = field(default_factory=dict)
    data_source: Optional[DataSource] = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ReviewConclusion:
    conclusion_type: ConclusionType
    final_level: Optional[ThresholdLevel] = None
    max_acceleration: Optional[float] = None
    min_acceleration: Optional[float] = None
    judgment_steps: List[JudgmentStep] = field(default_factory=list)
    next_action: Optional[str] = None
    next_owner: Optional[str] = None
    cross_level_source: Optional[DataSource] = None
    cross_level_from: Optional[ThresholdLevel] = None
    cross_level_to: Optional[ThresholdLevel] = None


@dataclass
class ElevatorAccelerationReview:
    id: str
    elevator_id: str
    created_at: datetime
    threshold_table: Optional[ThresholdTable] = None
    maintenance_order: Optional[MaintenanceOrder] = None
    vibration_curve: Optional[VibrationCurve] = None
    change_history: List[ChangeRecord] = field(default_factory=list)
    conclusion: Optional[ReviewConclusion] = None
    status: str = "进行中"
    version: int = 1
