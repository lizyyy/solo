from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum


class RecordStatus(Enum):
    PENDING = "待处理"
    SENSOR_ABNORMAL = "传感器异常"
    SENSOR_UPDATED = "传感器已补录"
    PENDING_REVIEW = "待安全员复核"
    REVIEWED = "安全员已复核"
    CONVERTED = "已换算"
    MANUAL_CORRECTED = "已人工修正"
    RERUN = "已重跑"


class ReminderLevel(Enum):
    INFO = "提示"
    WARNING = "警告"
    CRITICAL = "严重"


class NextAction(Enum):
    FIND_SAFETY_OFFICER = "找安全员"
    FIND_COACH_TANG = "找训练教练老唐"
    FIND_FIELD_TECH = "找现场技术"
    NO_ACTION = "无需处理"


@dataclass
class Sensor:
    sensor_id: str
    physical_tag: str
    location: str
    install_date: datetime
    last_restart: Optional[datetime] = None


@dataclass
class TemperatureCalibration:
    record_id: str
    calibrate_time: datetime
    raw_temperature: float
    calibrated_temperature: float
    calibration_method: str
    operator: str
    sensor_id_reported: str
    caliber: str = "PT100"


@dataclass
class SafetyReminder:
    reminder_id: str
    level: ReminderLevel
    title: str
    reason: str
    missing_materials: List[str]
    next_action: NextAction
    is_resolved: bool = False
    resolved_note: Optional[str] = None
    resolved_time: Optional[datetime] = None
    created_time: datetime = field(default_factory=datetime.now)


@dataclass
class CylinderConversionRecord:
    conversion_id: str
    cylinder_id: str
    calibrate_time: datetime
    raw_temperature: float
    raw_pressure: float
    calibrated_temperature: float
    converted_pressure: Optional[float] = None
    temperature_calibration_id: Optional[str] = None
    sensor_id_original: Optional[str] = None
    sensor_id_confirmed: Optional[str] = None
    status: RecordStatus = RecordStatus.PENDING
    is_sensor_id_changed: bool = False
    caliber_mismatch: bool = False
    caliber_expected: str = "PT100"
    caliber_actual: Optional[str] = None
    manual_correction_note: Optional[str] = None
    rerun_count: int = 0
    safety_reminders: List[SafetyReminder] = field(default_factory=list)
    operation_log: List[Dict] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def add_log(self, action: str, operator: str, note: str = ""):
        self.operation_log.append({
            "time": datetime.now(),
            "action": action,
            "operator": operator,
            "note": note
        })
        self.updated_at = datetime.now()

    def add_reminder(self, reminder: SafetyReminder):
        self.safety_reminders.append(reminder)
        self.add_log("生成安全提醒", "系统", reminder.title)
