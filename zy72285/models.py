from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class ReviewStatus(str, Enum):
    PENDING = "pending"
    NORMAL = "normal"
    NEED_TRAINEE_REVIEW = "need_trainee_review"
    NEED_DESIGNER_REVIEW = "need_designer_review"


class DisplayMode(str, Enum):
    LIST = "list"
    VIEW_3D = "3d"
    CHART = "chart"


class Role(str, Enum):
    DESIGNER_AJING = "designer_ajing"
    TRAINEE = "trainee"
    REVIEWER = "reviewer"
    SYSTEM = "system"


@dataclass
class FloorSectionSketch:
    id: str
    floor: str
    section_name: str
    sketch_data: str
    import_hash: str
    imported_at: datetime
    imported_by: Role
    obstacles: List["Obstacle"] = field(default_factory=list)
    source_file: Optional[str] = None


@dataclass
class PointCloudLog:
    id: str
    sketch_id: str
    log_data: str
    log_hash: str
    recorded_at: datetime
    reviewed_by: Optional[Role] = None
    reviewed_at: Optional[datetime] = None
    notes: Optional[str] = None


@dataclass
class Obstacle:
    id: str
    sketch_id: str
    name: str
    position_3d: Dict[str, float]
    bounds: Dict[str, float]
    material_type: Optional[str] = None
    material_status: str = "pending"
    review_status: ReviewStatus = ReviewStatus.PENDING
    conflicting_name: Optional[str] = None
    source_log_ids: List[str] = field(default_factory=list)


@dataclass
class SprinklerCoverage:
    id: str
    sketch_id: str
    obstacle_id: str
    coverage_area: float
    sprinkler_count: int
    is_covered: bool
    remark: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    updated_by: Optional[Role] = None


@dataclass
class ChangeHistory:
    id: str
    entity_type: str
    entity_id: str
    field_name: str
    old_value: Any
    new_value: Any
    changed_by: Role
    changed_at: datetime
    change_reason: str
    affected_results: List[str] = field(default_factory=list)


@dataclass
class ReviewReport:
    id: str
    coverage_id: str
    obstacle_id: str
    why_kept: str
    missing_materials: List[str]
    next_step_role: Role
    next_step_action: str
    generated_at: datetime
    generated_by: Role


@dataclass
class ThreeDView:
    id: str
    coverage_id: str
    display_mode: DisplayMode
    source_sketch_id: str
    source_log_ids: List[str]
    created_at: datetime
