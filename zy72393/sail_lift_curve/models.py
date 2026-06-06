from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime


class RecordStatus(str, Enum):
    PENDING = "待处理"
    NORMAL = "正常"
    OUTLIER = "超阈值"
    HIDDEN_BY_AVG = "被平均值盖掉"
    CONFIRMED_BY_LAOCEN = "老岑已确认"


@dataclass
class EquipmentRecord:
    record_id: str
    equipment_id: str
    equipment_name: str
    nameplate_params: Dict[str, Any]
    lift_coefficient: float
    angle_of_attack: float
    wind_speed: float
    measurement_time: datetime
    raw_value: float
    averaged_value: Optional[float] = None
    threshold_upper: Optional[float] = None
    threshold_lower: Optional[float] = None
    status: RecordStatus = RecordStatus.NORMAL
    notes: str = ""
    maintenance_screenshot_ref: Optional[str] = None


@dataclass
class ThresholdRecord:
    record_id: str
    equipment_record_id: str
    raw_value: float
    averaged_value: float
    threshold_upper: float
    threshold_lower: float
    deviation_percent: float
    hidden_by_averaging: bool = True
    discovered: bool = False
    status: RecordStatus = RecordStatus.HIDDEN_BY_AVG
    discovered_time: Optional[datetime] = None
    confirmed_by: Optional[str] = None
    confirmed_time: Optional[datetime] = None


@dataclass
class UnitConversionNote:
    record_id: str
    threshold_record_id: str
    original_unit: str
    converted_unit: str
    conversion_factor: float
    original_value: float
    converted_value: float
    why_kept: str = ""
    missing_materials: str = ""
    next_action: str = ""
    contact_person: str = ""
    last_updated: Optional[datetime] = None


@dataclass
class LiftCurveData:
    angles: List[float]
    lift_coefficients: List[float]
    wind_speeds: List[float]
    outlier_indices: List[int] = field(default_factory=list)
    hidden_outlier_indices: List[int] = field(default_factory=list)
    equipment_ids: List[str] = field(default_factory=list)
    record_ids: List[str] = field(default_factory=list)


@dataclass
class ProjectState:
    project_id: str
    name: str
    equipment_records: List[EquipmentRecord] = field(default_factory=list)
    threshold_records: List[ThresholdRecord] = field(default_factory=list)
    unit_conversion_notes: List[UnitConversionNote] = field(default_factory=list)
    step: int = 1
    step_description: str = "设备铭牌参数第一次导入"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
