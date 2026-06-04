from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
import json
from enum import Enum


class RecordStatus(Enum):
    NORMAL = "正常"
    CONFLICT = "冲突待确认"
    REJECTED = "已驳回"
    CONFIRMED = "已确认"
    PENDING_REVIEW = "待安全员复核"


class SensorStatus(Enum):
    ORIGINAL = "原始编号"
    RESTARTED = "重启后编号变更"


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
            "remarks": self.remarks
        }


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

    def to_dict(self) -> Dict:
        return {
            "calibration_id": self.calibration_id,
            "ship_id": self.ship_id,
            "sensor_id": self.sensor_id,
            "calibration_time": self.calibration_time.isoformat(),
            "effective_sampling_interval": self.effective_sampling_interval,
            "calibration_temperature": self.calibration_temperature,
            "operator": self.operator,
            "remarks": self.remarks
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

    def calculate(self, records: List[SamplingRecord]) -> None:
        valid_periods = []
        for r in records:
            if r.status in [RecordStatus.NORMAL, RecordStatus.CONFIRMED]:
                valid_periods.extend(r.roll_periods)
        
        if valid_periods:
            self.average_period = sum(valid_periods) / len(valid_periods)
            variance = sum((p - self.average_period) ** 2 for p in valid_periods) / len(valid_periods)
            self.period_variance = variance
            self.calculated_time = datetime.now()
            self.status = "已计算"
