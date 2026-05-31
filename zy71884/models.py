from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class MeasurementMethod(str, Enum):
    STANDING_WAVE = "驻波法"
    PHASE_COMPARISON = "相位比较法"


class AnomalyType(str, Enum):
    SAMPLING_GAP = "采样缺口"
    UNIT_CONVERSION_ERROR = "单位换算错误"
    ZERO_DRIFT = "零点漂移"
    ABNORMAL_VALUE = "数值异常"


class Status(str, Enum):
    PENDING = "待确认"
    NORMAL = "正常"
    ABNORMAL = "异常"


@dataclass
class JudgmentTrail:
    timestamp: str
    criterion: str
    reason: str
    result: str


@dataclass
class AnomalyMark:
    anomaly_type: AnomalyType
    description: str
    position: Optional[str] = None
    severity: str = "medium"


@dataclass
class SensorLog:
    version: int
    upload_time: str
    filename: str
    raw_data: List[Dict[str, Any]]
    data_hash: str


@dataclass
class CalibrationResult:
    method: MeasurementMethod
    measured_velocity: float
    theoretical_velocity: float
    relative_error: float
    temperature: float
    frequency: float
    wavelength: float
    judgment_trails: List[JudgmentTrail] = field(default_factory=list)
    anomalies: List[AnomalyMark] = field(default_factory=list)
    status: Status = Status.PENDING


@dataclass
class MaterialBatch:
    batch_id: str
    material_name: str
    student_name: str
    student_id: str
    experiment_date: str
    created_at: str
    logs: List[SensorLog] = field(default_factory=list)
    calibration_records: List[CalibrationResult] = field(default_factory=list)
    latest_status: Status = Status.PENDING


@dataclass
class DiffItem:
    field: str
    old_value: Any
    new_value: Any
    change_type: str
    impact: str


@dataclass
class VersionDiff:
    old_version: int
    new_version: int
    diff_items: List[DiffItem]
    anomaly_changes: List[str]
    status_change: Optional[str] = None


@dataclass
class GradingSheet:
    batch_id: str
    student_name: str
    student_id: str
    experiment_date: str
    final_status: str
    methods_used: List[str]
    results_summary: List[Dict[str, Any]]
    anomalies_found: List[Dict[str, str]]
    reasons: List[str]
    next_steps: List[str]
    generated_at: str
