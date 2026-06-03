from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ObstacleSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class OcclusionStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    RESOLVED = "resolved"
    ESCALATED_SAFETY = "escalated_safety"


class NextAction(str, Enum):
    SAFETY_OFFICER = "safety_officer"
    INSTRUCTOR_LIANG = "instructor_liang"


class WorkflowPhase(str, Enum):
    OBSTACLE_IMPORT = "obstacle_import"
    FLOOR_PROFILE_SUPPLEMENT = "floor_profile_supplement"
    OCCLUSION_UPDATE = "occlusion_update"


class ObstacleRemark(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    location: str
    description: str
    severity: ObstacleSeverity = ObstacleSeverity.MEDIUM
    photo_refs: list[str] = Field(default_factory=list)
    created_by: str = "unknown"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    status: str = "active"
    notes: str = ""


class FloorProfile(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    floor_name: str
    sketch_data: Optional[str] = None
    photo_refs: list[str] = Field(default_factory=list)
    created_by: str = "unknown"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    notes: str = ""


class PhotoLocation(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    photo_ref: str
    x: float
    y: float
    z: float = 0.0
    floor_profile_id: Optional[str] = None
    obstacle_remark_id: Optional[str] = None
    source: str = "photo"
    label: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class CoordinateRow(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    point_label: str
    x: float
    y: float
    z: float = 0.0
    floor_profile_id: Optional[str] = None
    verified: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class OcclusionPoint(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    photo_location_id: str
    photo_ref: str
    point_x: float
    point_y: float
    point_z: float
    status: OcclusionStatus = OcclusionStatus.PENDING_REVIEW
    reason: str = ""
    missing_material: str = ""
    next_action: NextAction = NextAction.SAFETY_OFFICER
    obstacle_remark_id: Optional[str] = None
    floor_profile_id: Optional[str] = None
    resolved_by: str = ""
    resolved_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class InspectionProject(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str
    plant_name: str = ""
    created_by: str = "unknown"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    current_phase: WorkflowPhase = WorkflowPhase.OBSTACLE_IMPORT
    obstacle_remarks: list[ObstacleRemark] = Field(default_factory=list)
    floor_profiles: list[FloorProfile] = Field(default_factory=list)
    photo_locations: list[PhotoLocation] = Field(default_factory=list)
    coordinate_rows: list[CoordinateRow] = Field(default_factory=list)
    occlusion_points: list[OcclusionPoint] = Field(default_factory=list)
