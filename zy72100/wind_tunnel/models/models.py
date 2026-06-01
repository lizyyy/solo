from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import uuid


@dataclass
class SensorRecord:
    raw_line: str
    timestamp: datetime
    angle_of_attack: Optional[float] = None
    lift_force: Optional[float] = None
    drag_force: Optional[float] = None
    pressure: Optional[float] = None
    temperature: Optional[float] = None
    wind_speed: Optional[float] = None
    lift_unit: str = ""
    drag_unit: str = ""
    pressure_unit: str = ""
    temperature_unit: str = ""
    wind_speed_unit: str = ""
    raw_annotation: str = ""
    source_file: str = ""
    line_number: int = 0
    is_gap: bool = False
    has_unit_issue: bool = False
    unit_issue_detail: str = ""

    @property
    def record_id(self) -> str:
        return f"{self.source_file}:L{self.line_number}"


@dataclass
class DataGap:
    start_time: datetime
    end_time: datetime
    gap_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    expected_interval_sec: float = 0.0
    actual_gap_sec: float = 0.0
    interpolated: bool = False
    interpolation_method: str = ""


@dataclass
class UnitIssue:
    record_id: str
    field_name: str
    original_unit: str
    target_unit: str
    original_value: float
    converted_value: float
    conversion_factor: float
    issue_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])


@dataclass
class ThresholdConfig:
    config_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = "system"
    reason: str = "initial"
    cl_max: float = 2.0
    cl_min: float = -1.5
    cd_max: float = 0.5
    cd_min: float = 0.0
    ld_ratio_min: float = 0.0
    ld_ratio_max: float = 200.0
    pressure_max_kpa: float = 150.0
    wind_speed_max_mps: float = 120.0

    def to_dict(self) -> dict:
        return {
            "config_id": self.config_id,
            "created_at": self.created_at.isoformat(),
            "created_by": self.created_by,
            "reason": self.reason,
            "cl_max": self.cl_max,
            "cl_min": self.cl_min,
            "cd_max": self.cd_max,
            "cd_min": self.cd_min,
            "ld_ratio_min": self.ld_ratio_min,
            "ld_ratio_max": self.ld_ratio_max,
            "pressure_max_kpa": self.pressure_max_kpa,
            "wind_speed_max_mps": self.wind_speed_max_mps,
        }


@dataclass
class CalculationResult:
    record_id: str
    timestamp: datetime
    angle_of_attack: float
    cl: float
    cd: float
    ld_ratio: float
    dynamic_pressure: float
    threshold_config_id: str
    threshold_version: str
    exceeds_threshold: bool = False
    threshold_violation_detail: str = ""
    data_gap_ids: list = field(default_factory=list)
    unit_issue_ids: list = field(default_factory=list)
    is_interpolated: bool = False
    raw_annotation_preserved: str = ""
    source_file: str = ""
    processing_time: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "record_id": self.record_id,
            "timestamp": self.timestamp.isoformat(),
            "angle_of_attack": self.angle_of_attack,
            "cl": self.cl,
            "cd": self.cd,
            "ld_ratio": self.ld_ratio,
            "dynamic_pressure": self.dynamic_pressure,
            "threshold_config_id": self.threshold_config_id,
            "threshold_version": self.threshold_version,
            "exceeds_threshold": self.exceeds_threshold,
            "threshold_violation_detail": self.threshold_violation_detail,
            "data_gap_ids": self.data_gap_ids,
            "unit_issue_ids": self.unit_issue_ids,
            "is_interpolated": self.is_interpolated,
            "raw_annotation_preserved": self.raw_annotation_preserved,
            "source_file": self.source_file,
            "processing_time": self.processing_time.isoformat(),
        }


@dataclass
class AuditEntry:
    entry_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    timestamp: datetime = field(default_factory=datetime.now)
    action: str = ""
    actor: str = "system"
    details: str = ""
    threshold_config_id: str = ""
    affected_record_ids: list = field(default_factory=list)
    before_value: str = ""
    after_value: str = ""

    def to_dict(self) -> dict:
        return {
            "entry_id": self.entry_id,
            "timestamp": self.timestamp.isoformat(),
            "action": self.action,
            "actor": self.actor,
            "details": self.details,
            "threshold_config_id": self.threshold_config_id,
            "affected_record_ids": self.affected_record_ids,
            "before_value": self.before_value,
            "after_value": self.after_value,
        }


@dataclass
class NoteSupplement:
    supplement_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    timestamp: datetime = field(default_factory=datetime.now)
    author: str = ""
    note_text: str = ""
    affected_record_ids: list = field(default_factory=list)
    previous_values: dict = field(default_factory=dict)
    new_values: dict = field(default_factory=dict)
    diff_description: str = ""

    def compute_diff(self) -> str:
        diffs = []
        for key in self.new_values:
            old = self.previous_values.get(key, "N/A")
            new = self.new_values[key]
            if old != new:
                diffs.append(f"{key}: {old} -> {new}")
        self.diff_description = "; ".join(diffs)
        return self.diff_description

    def to_dict(self) -> dict:
        return {
            "supplement_id": self.supplement_id,
            "timestamp": self.timestamp.isoformat(),
            "author": self.author,
            "note_text": self.note_text,
            "affected_record_ids": self.affected_record_ids,
            "previous_values": self.previous_values,
            "new_values": self.new_values,
            "diff_description": self.diff_description,
        }


@dataclass
class ProcessingSession:
    session_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    started_at: datetime = field(default_factory=datetime.now)
    finished_at: Optional[datetime] = None
    source_files: list = field(default_factory=list)
    threshold_configs: list = field(default_factory=list)
    active_threshold_id: str = ""
    results: list = field(default_factory=list)
    audit_log: list = field(default_factory=list)
    data_gaps: list = field(default_factory=list)
    unit_issues: list = field(default_factory=list)
    note_supplements: list = field(default_factory=list)
    batch_label: str = ""
