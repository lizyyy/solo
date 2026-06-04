from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "normal"
    OVER_THRESHOLD = "over_threshold"
    MASKED_BY_AVERAGE = "masked_by_average"
    SUPPLEMENTED_FROM_CALIBRATION = "supplemented_from_calibration"
    PENDING_REVIEW = "pending_review"
    REVIEWED_NORMAL = "reviewed_normal"
    REVIEWED_ABNORMAL = "reviewed_abnormal"


class UnitCaliber(str, Enum):
    OLD = "old"
    NEW = "new"


@dataclass
class SamplingInterval:
    start_time: datetime
    end_time: datetime
    interval_minutes: int
    description: str = ""
    imported_at: Optional[datetime] = None
    import_note: str = ""


@dataclass
class TemperatureCalibration:
    record_time: datetime
    sensor_id: str
    raw_temperature: float
    calibrated_temperature: float
    calibration_offset: float
    calibration_note: str = ""
    recorded_by: str = ""
    caliber: UnitCaliber = UnitCaliber.NEW
    caliber_note: str = ""


@dataclass
class DefrostEnergyRecord:
    id: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    energy_consumption_kwh: float
    ambient_temp: float
    coil_temp: float
    status: RecordStatus = RecordStatus.NORMAL
    status_note: str = ""
    threshold_exceeded: bool = False
    masked_value: Optional[float] = None
    original_value: Optional[float] = None
    supplemented_from: Optional[str] = None
    caliber: UnitCaliber = UnitCaliber.NEW
    caliber_note: str = ""
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    run_id: str = "initial"


@dataclass
class UnitConversionNote:
    current_caliber: UnitCaliber = UnitCaliber.NEW
    old_to_new_coefficient: float = 0.85
    new_to_old_coefficient: float = 1.176
    last_updated_at: Optional[datetime] = None
    updated_by: str = ""
    update_reason: str = ""
    history: List[Dict[str, Any]] = field(default_factory=list)

    def get_conversion_text(self) -> str:
        if self.current_caliber == UnitCaliber.NEW:
            return (
                f"当前口径：新口径\n"
                f"说明：2024年起采用新计量标准，老岑师傅说新表走得准，"
                f"旧口径数据 × {self.old_to_new_coefficient} = 新口径数据。"
            )
        else:
            return (
                f"当前口径：旧口径（补录校准记录时自动切换）\n"
                f"说明：这是2024年以前的老标准，"
                f"新口径数据 × {self.new_to_old_coefficient:.3f} ≈ 旧口径数据。"
                f"老岑师傅提醒：补了校准记录就得按老规矩算。"
            )

    def update_caliber(self, new_caliber: UnitCaliber, updated_by: str, reason: str):
        if self.current_caliber != new_caliber:
            self.history.append({
                "from_caliber": self.current_caliber,
                "to_caliber": new_caliber,
                "updated_at": self.last_updated_at,
                "updated_by": self.updated_by,
                "reason": self.update_reason
            })
            self.current_caliber = new_caliber
            self.last_updated_at = datetime.now()
            self.updated_by = updated_by
            self.update_reason = reason


@dataclass
class ReviewRecord:
    record_id: str
    reviewed_by: str
    reviewed_at: datetime
    original_status: RecordStatus
    new_status: RecordStatus
    review_note: str


@dataclass
class ReplayRun:
    run_id: str
    run_time: datetime
    run_by: str
    description: str
    previous_records_count: int
    new_records_count: int
    changes: List[str] = field(default_factory=list)


@dataclass
class ManualCorrection:
    correction_id: str
    record_id: str
    corrected_by: str
    corrected_at: datetime
    original_value: float
    corrected_value: float
    correction_note: str
