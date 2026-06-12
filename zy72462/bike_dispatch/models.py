from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class EvidenceSource(Enum):
    GRID_INSPECTOR = "网格员巡查表"
    CONSTRUCTION_NOTICE = "施工告示"
    RAMP_SUPPLEMENT = "坡道补录"


class ReviewStatus(Enum):
    PENDING = "待复核"
    CONFIRMED = "已确认"
    NEEDS_SUPPLEMENT = "需补材料"
    ESCALATED = "转交通协管"


class ResponsibleRole(Enum):
    GRID_INSPECTOR = "网格员"
    COMMUNITY_SECRETARY = "社区书记周姐"
    TRAFFIC_ASSISTANT = "交通协管"
    SYSTEM = "系统"


@dataclass
class Evidence:
    source: EvidenceSource
    description: str
    photo_url: Optional[str] = None
    recorded_at: datetime = field(default_factory=datetime.now)
    recorded_by: str = ""


@dataclass
class Ramp:
    id: str
    location: str
    is_accessible: bool = True
    has_bike_parking: bool = False
    issues: List[str] = field(default_factory=list)
    score_before: float = 0.0
    score_after: float = 0.0
    score_changed: bool = False
    supplementary_note: str = ""
    provided_materials: List[str] = field(default_factory=list)
    review_status: ReviewStatus = ReviewStatus.PENDING


@dataclass
class GridInspection:
    id: str
    inspector_name: str
    inspection_date: datetime
    location: str
    bike_overflow: bool = False
    blocked_access: bool = False
    damaged_facilities: bool = False
    notes: str = ""
    photos: List[str] = field(default_factory=list)
    score: float = 0.0


@dataclass
class ConstructionNotice:
    id: str
    title: str
    location: str
    start_date: datetime
    end_date: datetime
    impact_description: str
    site_statement: str = ""
    photos: List[str] = field(default_factory=list)
    reviewed_by_secretary: bool = False


@dataclass
class RectificationSuggestion:
    id: str
    ramp_id: str
    issue_description: str
    why_kept: str
    missing_materials: List[str]
    provided_materials: List[str]
    evidence_trace: List[str]
    next_step: str
    responsible_role: ResponsibleRole
    priority: int = 1
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class DispatchCase:
    id: str
    title: str
    created_at: datetime = field(default_factory=datetime.now)
    grid_inspections: List[GridInspection] = field(default_factory=list)
    construction_notices: List[ConstructionNotice] = field(default_factory=list)
    ramps: List[Ramp] = field(default_factory=list)
    suggestions: List[RectificationSuggestion] = field(default_factory=list)
    evidences: List[Evidence] = field(default_factory=list)
    display_mode: str = "list"
    status: str = "active"
