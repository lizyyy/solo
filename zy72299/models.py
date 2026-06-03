from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ObstacleType(str, Enum):
    WINDOW = "window"
    AC_UNIT = "ac_unit"
    ANTENNA = "antenna"
    PIPE = "pipe"
    SIGN = "sign"
    OTHER = "other"


class RecordStatus(str, Enum):
    NORMAL = "normal"
    DUPLICATE_NAME = "duplicate_name"
    CONFLICT = "conflict"
    PENDING_REVIEW = "pending_review"
    SUPPLEMENTED = "supplemented"
    REJECTED = "rejected"
    CONFIRMED = "confirmed"


class Coordinate3D(BaseModel):
    x: float
    y: float
    z: float


class CoordinateOrigin(BaseModel):
    origin_id: str
    building_id: str
    origin_point: Coordinate3D
    description: str
    imported_at: datetime
    source: str = "coordinate_origin_spec"


class InspectionPhoto(BaseModel):
    photo_id: str
    photo_number: str
    building_id: str
    obstacle_name: str
    obstacle_type: ObstacleType
    position: Coordinate3D
    taken_at: datetime
    old_caliber: Optional[str] = None


class ObstacleRecord(BaseModel):
    record_id: str
    building_id: str
    obstacle_name: str
    obstacle_type: ObstacleType
    position: Coordinate3D
    origin_id: Optional[str] = None
    photo_number: Optional[str] = None
    status: RecordStatus = RecordStatus.NORMAL
    created_at: datetime
    updated_at: datetime
    duplicate_of: Optional[str] = None
    conflict_evidence: Optional[Dict[str, Any]] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    caliber_source: str = "coordinate_origin_spec"


class CleaningPathPoint(BaseModel):
    point_id: str
    position: Coordinate3D
    obstacle_id: Optional[str] = None
    cleaning_action: str
    sequence: int


class CleaningPath(BaseModel):
    path_id: str
    building_id: str
    path_name: str
    points: List[CleaningPathPoint]
    created_at: datetime
    version: int = 1


class ConflictEvidence(BaseModel):
    conflict_id: str
    record_id: str
    origin_data: Dict[str, Any]
    photo_data: Dict[str, Any]
    conflicting_fields: List[str]
    detected_at: datetime


class HistoryEntry(BaseModel):
    entry_id: str
    timestamp: datetime
    action: str
    actor: str
    details: Dict[str, Any]
    record_id: Optional[str] = None


class ProcessingResult(BaseModel):
    result_id: str
    building_id: str
    scenario_type: str
    processed_records: List[ObstacleRecord]
    conflicts: List[ConflictEvidence]
    pending_reviews: List[ObstacleRecord]
    cleaning_path: Optional[CleaningPath]
    history: List[HistoryEntry]
    replay_command: str
    summary: Dict[str, Any]
