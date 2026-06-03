from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict
import uuid


class RecordStatus(str, Enum):
    PENDING = "pending"
    NORMAL = "normal"
    BLOCKED = "blocked"
    NEED_REVIEW = "need_review"
    COMPLETED = "completed"
    OLD_CALIBRATION = "old_calibration"


class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class CoordinateOrigin:
    origin_id: str
    name: str
    x: float
    y: float
    z: float
    description: str
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Shelf:
    shelf_id: str
    code: str
    location_x: float
    location_y: float
    max_load: float
    current_load: float
    origin_id: str


@dataclass
class AlertLabel:
    label_id: str
    position_x: float
    position_y: float
    width: float
    height: float
    severity: AlertSeverity
    message: str
    is_blocked: bool = False
    blocked_by: Optional[str] = None


@dataclass
class PhotoRecord:
    photo_id: str
    photo_number: str
    capture_time: Optional[datetime] = None
    is_mobile_screenshot: bool = False
    screenshot_bbox: Optional[tuple] = None
    labels: List[AlertLabel] = field(default_factory=list)


@dataclass
class HeatZone:
    zone_id: str
    shelf_id: str
    center_x: float
    center_y: float
    radius: float
    load_ratio: float
    severity: AlertSeverity
    safe_distance: float


@dataclass
class InspectionRecord:
    record_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    batch_id: str = ""
    shelf_code: str = ""
    origin_id: str = ""
    photo_number: Optional[str] = None
    status: RecordStatus = RecordStatus.PENDING
    heat_zones: List[HeatZone] = field(default_factory=list)
    photos: List[PhotoRecord] = field(default_factory=list)
    is_manual_correction: bool = False
    correction_note: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    run_count: int = 0
    old_calibration_data: Optional[Dict] = None


@dataclass
class SafetyReport:
    report_id: str
    batch_id: str
    generated_at: datetime = field(default_factory=datetime.now)
    total_records: int = 0
    normal_count: int = 0
    blocked_count: int = 0
    need_review_count: int = 0
    old_calibration_count: int = 0
    min_safe_distance: float = 0.0
    avg_safe_distance: float = 0.0
    max_safe_distance: float = 0.0
    records: List[InspectionRecord] = field(default_factory=list)
