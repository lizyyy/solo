from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "正常"
    OVER_THRESHOLD = "超阈值"
    AVERAGED = "平均值覆盖"
    PENDING_REVIEW = "待维修复核"
    CALIBRATION_UPDATED = "口径修正"
    BACKFILLED = "补录"


class CorrectionType(str, Enum):
    SENSOR_ID_LOOKUP = "传感器编号补查"
    MANUAL_CALIBRATION = "人工口径修正"
    UNIT_UPDATE = "单位换算说明更新"
    RERUN = "重跑"


@dataclass
class TemperatureCalibration:
    calibration_id: str
    sensor_id: str
    temp_c: float
    pressure_kpa: float
    calibrated_at: datetime
    operator: str


@dataclass
class SensorInfo:
    sensor_id: str
    nozzle_diameter_mm: float
    calibration_factor: float
    installed_at: datetime
    location: str
    notes: Optional[str] = None


@dataclass
class CorrectionRecord:
    correction_id: str
    correction_type: CorrectionType
    record_id: Optional[str]
    old_value: Optional[float]
    new_value: Optional[float]
    old_diameter: Optional[float]
    new_diameter: Optional[float]
    operator: str
    corrected_at: datetime
    reason: str
    notes: Optional[str] = None


@dataclass
class LeakRecord:
    record_id: str
    sensor_id: str
    measured_at: datetime
    raw_flow_rate: float
    temp_c: float
    pressure_kpa: float
    nozzle_diameter_mm: float
    status: RecordStatus
    estimated_leak_lmin: Optional[float] = None
    is_averaged: bool = False
    source_run_id: Optional[str] = None
    is_backfilled: bool = False
    original_diameter_mm: Optional[float] = None
    run_id: Optional[str] = None


@dataclass
class RunHistory:
    run_id: str
    started_at: datetime
    ended_at: Optional[datetime]
    operator: str
    description: str
    record_ids: List[str] = field(default_factory=list)
    correction_ids: List[str] = field(default_factory=list)
