from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class TempUnit(str, Enum):
    CELSIUS = "°C"
    KELVIN = "K"
    UNKNOWN = "?"


class WorkflowStage(str, Enum):
    STEP1_IMPORTED = "第一步：采样间隔说明已导入"
    STEP2_LIN_REVIEWED = "第二步：林老师已补看校准记录"
    STEP3_REPORT_UPDATED = "第三步：交接报告已更新"
    COACH_REVIEW_PENDING = "待训练教练复核"


class NextContact(str, Enum):
    COACH = "训练教练"
    TEACHER_LIN = "实验老师林老师"
    BOTH = "双方共同确认"


@dataclass
class TemperatureReading:
    timestamp: datetime
    value: float
    unit: TempUnit
    raw_text: str
    source_line: int


@dataclass
class SamplingIntervalSpec:
    file_name: str
    imported_at: datetime
    raw_content: str
    readings: List[TemperatureReading] = field(default_factory=list)
    has_mixed_units: bool = False
    mixed_unit_points: List[int] = field(default_factory=list)
    notes: str = ""


@dataclass
class CalibrationRecord:
    record_id: str
    recorded_by: str
    recorded_at: datetime
    calibration_temperature: float
    calibration_unit: TempUnit
    instrument_id: str
    offset_correction: Optional[float] = None
    remarks: str = ""


@dataclass
class ShockDataPoint:
    time_ms: float
    acceleration_g: float
    altitude_m: float
    velocity_m_s: float
    temperature_reading: Optional[TemperatureReading] = None
    has_mixed_units: bool = False
    linked_calibration_id: Optional[str] = None


@dataclass
class RetentionNote:
    data_point_id: int
    reason_kept: str
    missing_materials: List[str]
    next_contact: NextContact
    priority: str = "中"


@dataclass
class HandoverReport:
    report_id: str
    generated_at: datetime
    workflow_stage: WorkflowStage
    total_data_points: int
    mixed_unit_count: int
    calibration_count: int
    retention_notes: List[RetentionNote] = field(default_factory=list)
    summary_for_coach: str = ""
    summary_for_lin: str = ""
    pending_actions: List[str] = field(default_factory=list)


@dataclass
class ProjectState:
    sampling_spec: Optional[SamplingIntervalSpec] = None
    calibration_records: List[CalibrationRecord] = field(default_factory=list)
    shock_data: List[ShockDataPoint] = field(default_factory=list)
    handover_report: Optional[HandoverReport] = None
    current_stage: WorkflowStage = WorkflowStage.STEP1_IMPORTED
    clickable_links: Dict[int, Dict[str, Any]] = field(default_factory=dict)
