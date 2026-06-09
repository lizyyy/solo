from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
import json
import copy
from enum import Enum


class RecordStatus(Enum):
    NORMAL = "正常"
    CONFLICT = "冲突待确认"
    REJECTED = "已驳回"
    CONFIRMED = "已确认"
    PENDING_REVIEW = "待安全员复核"
    CORRECTED = "已修正"
    SUPPLEMENTED = "已补录"


class SensorStatus(Enum):
    ORIGINAL = "原始编号"
    RESTARTED = "重启后编号变更"


@dataclass
class ReviewInfo:
    original_value: Any
    corrected_value: Any
    field_name: str
    reason: str
    next_handler: str
    handled_by: str
    handled_time: Optional[datetime] = None
    result: Optional[str] = None


@dataclass
class SamplingRecord:
    record_id: str
    ship_id: str
    sensor_id: str
    sampling_interval: float
    sampling_start_time: datetime
    sampling_end_time: datetime
    roll_periods: List[float]
    import_time: datetime
    import_user: str
    status: RecordStatus = RecordStatus.NORMAL
    sensor_status: SensorStatus = SensorStatus.ORIGINAL
    previous_sensor_id: Optional[str] = None
    is_supplementary: bool = False
    original_record_id: Optional[str] = None
    remarks: str = ""
    original_sampling_interval: Optional[float] = None
    correction_reason: str = ""
    next_handler: str = ""
    review_infos: List[ReviewInfo] = field(default_factory=list)
    version: int = 1
    last_modified_time: Optional[datetime] = None
    last_modified_by: str = ""
    supplementary_ids: List[str] = field(default_factory=list)
    related_calibration_ids: List[str] = field(default_factory=list)
    related_reminder_ids: List[str] = field(default_factory=list)
    related_conflict_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "record_id": self.record_id,
            "ship_id": self.ship_id,
            "sensor_id": self.sensor_id,
            "sampling_interval": self.sampling_interval,
            "sampling_start_time": self.sampling_start_time.isoformat(),
            "sampling_end_time": self.sampling_end_time.isoformat(),
            "roll_periods": self.roll_periods,
            "import_time": self.import_time.isoformat(),
            "import_user": self.import_user,
            "status": self.status.value,
            "sensor_status": self.sensor_status.value,
            "previous_sensor_id": self.previous_sensor_id,
            "is_supplementary": self.is_supplementary,
            "original_record_id": self.original_record_id,
            "remarks": self.remarks,
            "original_sampling_interval": self.original_sampling_interval,
            "correction_reason": self.correction_reason,
            "next_handler": self.next_handler,
            "version": self.version,
            "last_modified_time": self.last_modified_time.isoformat() if self.last_modified_time else None,
            "last_modified_by": self.last_modified_by,
            "supplementary_ids": self.supplementary_ids,
            "related_calibration_ids": self.related_calibration_ids,
            "related_reminder_ids": self.related_reminder_ids,
            "related_conflict_ids": self.related_conflict_ids,
            "review_infos": [
                {
                    "field_name": ri.field_name,
                    "original_value": ri.original_value,
                    "corrected_value": ri.corrected_value,
                    "reason": ri.reason,
                    "next_handler": ri.next_handler,
                    "handled_by": ri.handled_by,
                    "handled_time": ri.handled_time.isoformat() if ri.handled_time else None,
                    "result": ri.result
                }
                for ri in self.review_infos
            ]
        }

    def add_review_info(self, review: ReviewInfo):
        self.review_infos.append(review)
        self.last_modified_time = datetime.now()
        self.version += 1


@dataclass
class TemperatureCalibration:
    calibration_id: str
    ship_id: str
    sensor_id: str
    calibration_time: datetime
    effective_sampling_interval: float
    calibration_temperature: float
    operator: str
    remarks: str = ""
    related_sampling_record_ids: List[str] = field(default_factory=list)
    affected_conflict_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "calibration_id": self.calibration_id,
            "ship_id": self.ship_id,
            "sensor_id": self.sensor_id,
            "calibration_time": self.calibration_time.isoformat(),
            "effective_sampling_interval": self.effective_sampling_interval,
            "calibration_temperature": self.calibration_temperature,
            "operator": self.operator,
            "remarks": self.remarks,
            "related_sampling_record_ids": self.related_sampling_record_ids,
            "affected_conflict_ids": self.affected_conflict_ids
        }


@dataclass
class ConflictEvidence:
    conflict_id: str
    sampling_record_id: str
    calibration_id: str
    conflict_type: str
    description: str
    sampling_value: float
    calibration_value: float
    discovered_time: datetime
    resolved: bool = False
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_time: Optional[datetime] = None
    original_status: Optional[str] = None
    corrected_status: Optional[str] = None
    handler_after_resolve: str = ""
    result_summary: str = ""
    reminder_id: Optional[str] = None


@dataclass
class SafetyReminder:
    reminder_id: str
    related_record_id: str
    level: str
    title: str
    content: str
    created_time: datetime
    reviewed: bool = False
    reviewed_by: Optional[str] = None
    reviewed_time: Optional[datetime] = None
    related_conflict_id: Optional[str] = None
    reminder_type: str = ""
    next_step: str = ""
    original_value: Optional[Any] = None
    current_value: Optional[Any] = None


@dataclass
class RollPeriodEstimate:
    estimate_id: str
    ship_id: str
    sampling_records: List[str] = field(default_factory=list)
    average_period: float = 0.0
    period_variance: float = 0.0
    calculated_time: Optional[datetime] = None
    calculated_by: Optional[str] = None
    status: str = "待计算"
    excluded_records: List[Dict] = field(default_factory=list)

    def calculate(self, records: List[SamplingRecord]) -> None:
        valid_periods = []
        self.excluded_records = []
        for r in records:
            if r.status in [RecordStatus.NORMAL, RecordStatus.CONFIRMED, RecordStatus.CORRECTED, RecordStatus.SUPPLEMENTED]:
                valid_periods.extend(r.roll_periods)
            else:
                self.excluded_records.append({
                    "record_id": r.record_id,
                    "status": r.status.value,
                    "reason": f"状态为{r.status.value}，未纳入计算"
                })
        
        if valid_periods:
            self.average_period = sum(valid_periods) / len(valid_periods)
            variance = sum((p - self.average_period) ** 2 for p in valid_periods) / len(valid_periods)
            self.period_variance = variance
            self.calculated_time = datetime.now()
            self.status = "已计算"
