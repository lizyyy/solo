from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class PointStatus(Enum):
    NORMAL = "normal"
    MISSING_COORD = "missing_coord"
    FROM_SAFETY_RADIUS = "from_safety_radius"
    PENDING_REVIEW = "pending_review"


class RecordStatus(Enum):
    SUCCESS = "顺利完成"
    NEED_REVIEW = "待安全员复核"
    SUPPLEMENTED = "旧口径补录"


@dataclass
class PointCloudLog:
    log_id: str
    photo_id: str
    point_index: int
    timestamp: datetime
    raw_coords: Optional[tuple] = None
    confidence: float = 0.0
    notes: str = ""


@dataclass
class SafetyRadiusEntry:
    point_id: str
    photo_id: str
    point_index: int
    radius_meters: float
    obstacle_type: str
    measured_date: str
    source: str = "manual"
    is_old_caliber: bool = False


@dataclass
class CoordRow:
    photo_id: str
    point_index: int
    x: float
    y: float
    z: float
    coord_source: str = "auto"


@dataclass
class OcclusionPoint:
    point_id: str
    photo_id: str
    point_index: int
    status: PointStatus
    is_occluded: bool = False
    occlusion_reason: str = ""
    safety_radius: Optional[float] = None
    obstacle_type: str = ""
    reviewer_notes: str = ""
    last_updated: datetime = field(default_factory=datetime.now)


@dataclass
class ReviewRecord:
    photo_id: str
    record_status: RecordStatus
    point_cloud_logs: List[PointCloudLog] = field(default_factory=list)
    coord_rows: List[CoordRow] = field(default_factory=list)
    safety_radius_entries: List[SafetyRadiusEntry] = field(default_factory=list)
    occlusion_points: List[OcclusionPoint] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    has_manual_correction: bool = False
    has_rerun: bool = False
