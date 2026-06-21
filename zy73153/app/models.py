from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class DutyRole(str, Enum):
    STATION_KEEPER = "海洋站值班员"
    SCHEDULER = "排班同事"
    LAB_TECH = "实验室技术员"
    SENSOR_TECH = "传感器运维"


class SensorStatus(str, Enum):
    NORMAL = "正常"
    DRIFT_SUSPECTED = "疑似漂移"
    DRIFT_CONFIRMED = "确认漂移"
    OFFLINE = "离线"


class RecordStatus(str, Enum):
    PENDING = "待处理"
    NORMAL = "已标注"
    TIME_MISMATCH = "采样时间与结果不符"
    LATE_ATTACHMENT = "附件晚到"
    SENSOR_DRIFT = "传感器漂移"
    DUPLICATE = "重复导入"


@dataclass
class DutyStaff:
    staff_id: str
    name: str
    role: DutyRole
    phone: str = ""
    contact_hint: str = ""


@dataclass
class Sensor:
    sensor_id: str
    name: str
    location: str
    status: SensorStatus = SensorStatus.NORMAL
    drift_threshold: float = 0.15
    last_calibration: Optional[datetime] = None
    responsible_person_id: str = ""
    data_source_url: str = ""


@dataclass
class FormulaStep:
    step_index: int
    description: str
    formula: str
    unit: str
    input_value: float
    output_value: float
    boundary_check: Optional[str] = None
    note: str = ""


@dataclass
class CalculationTrail:
    final_result: float
    final_unit: str
    formula_steps: list[FormulaStep] = field(default_factory=list)
    boundary_values: dict[str, tuple[float, float]] = field(default_factory=dict)
    warning_flags: list[str] = field(default_factory=list)


@dataclass
class LabResult:
    lab_result_id: str
    sample_id: str
    sample_time: datetime
    report_time: datetime
    experiment_time: datetime
    result_value: float
    result_unit: str
    test_item: str
    attachment_arrived: bool = True
    attachment_arrival_time: Optional[datetime] = None
    remark: str = ""
    remark_editable: bool = True


@dataclass
class SamplingRecord:
    sample_id: str
    station_id: str
    station_name: str
    sampling_time: datetime
    location_lng: float
    location_lat: float
    sensor_id: str
    sensor_value: float
    operator_id: str
    remark: str = ""
    remark_editable: bool = True


@dataclass
class SpatialAnnotation:
    annotation_id: str
    sample_id: str
    station_id: str
    location_lng: float
    location_lat: float
    zone_level: str
    zone_name: str
    calculation_trail: CalculationTrail
    status: RecordStatus = RecordStatus.PENDING
    alerts: list[str] = field(default_factory=list)
    handler_hint: str = ""
    data_sources: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""


@dataclass
class SensorReading:
    reading_time: datetime
    value: float
    unit: str
    source: str = "现场浮标"
    note: str = ""


@dataclass
class DriftEvidence:
    threshold_pct: float
    observed_deviation_pct: float
    last_calibration: Optional[datetime]
    days_since_calibration: int
    reference_value: float
    basis: str
    conclusion: str


@dataclass
class PendingRecord:
    annotation_id: str
    sample_id: str
    station_name: str
    status: RecordStatus
    summary: str
    created_at: datetime
    action_needed: str
    contact_person: str = ""
    check_first_source: str = ""
