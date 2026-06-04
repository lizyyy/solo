from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SensorStatus(str, Enum):
    NORMAL = "normal"
    RESTART_DETECTED = "restart_detected"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"


class SafetyLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class NextAction(str, Enum):
    CONTACT_SAFETY_OFFICER = "contact_safety_officer"
    CONTACT_TEACHER_LIN = "contact_teacher_lin"
    AWAITING_MATERIALS = "awaiting_materials"
    COMPLETED = "completed"


class DevicePlate(BaseModel):
    device_id: str
    device_name: str
    model: str
    manufacturer: str
    purchase_date: str
    calibration_date: str
    next_calibration_date: str
    sensor_count: int
    remarks: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class SensorRecord(BaseModel):
    id: str
    timestamp: datetime
    sensor_id: str
    sensor_number: int
    wind_speed: float
    drag_force: float
    temperature: Optional[float] = None
    pressure: Optional[float] = None
    status: SensorStatus = SensorStatus.NORMAL
    is_restart_marker: bool = False
    restart_reason: Optional[str] = None
    original_sensor_number: Optional[int] = None


class MaintenanceScreenshot(BaseModel):
    id: str
    record_id: str
    filename: str
    upload_time: datetime = Field(default_factory=datetime.now)
    uploader: str
    description: Optional[str] = None
    wechat_group_name: Optional[str] = None


class SafetyReminder(BaseModel):
    id: str
    record_id: str
    level: SafetyLevel
    title: str
    reason_kept: str
    missing_materials: List[str] = Field(default_factory=list)
    next_action: NextAction
    teacher_note: Optional[str] = None
    reviewed_by_safety: bool = False
    reviewer_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ExperimentSession(BaseModel):
    id: str
    name: str
    date: str
    device_plate: Optional[DevicePlate] = None
    sensor_records: List[SensorRecord] = Field(default_factory=list)
    maintenance_screenshots: List[MaintenanceScreenshot] = Field(default_factory=list)
    safety_reminders: List[SafetyReminder] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    status: str = "processing"


class WindTunnelDatabase(BaseModel):
    sessions: Dict[str, ExperimentSession] = Field(default_factory=dict)
    current_session_id: Optional[str] = None
