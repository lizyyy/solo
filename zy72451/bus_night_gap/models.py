from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class Role(str, Enum):
    SYSTEM = "system"
    COMMUNITY_SECRETARY = "community_secretary"
    TRAFFIC_COORDINATOR = "traffic_coordinator"


class RecordStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    NEEDS_SUPPLEMENT = "needs_supplement"
    SCORE_UNCHANGED = "score_unchanged"
    READY_FOR_COORDINATOR = "ready_for_coordinator"
    RESOLVED = "resolved"


class NextAction(str, Enum):
    CONTACT_TRAFFIC_COORDINATOR = "contact_traffic_coordinator"
    CONTACT_COMMUNITY_SECRETARY = "contact_community_secretary"
    COLLECT_MORE_MATERIALS = "collect_more_materials"
    RESOLVED = "resolved"


class ConstructionNotice(BaseModel):
    id: str = ""
    road_name: str
    construction_type: str
    start_date: str
    end_date: str
    notes: str = ""
    raw_notes: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
    source: str = "manual"


class RampRecord(BaseModel):
    id: str = ""
    notice_id: str
    location: str
    has_ramp: bool
    ramp_condition: Optional[str] = None
    width_cm: Optional[int] = None
    notes: str = ""
    raw_notes: str = ""
    recorded_by: Role
    recorded_at: datetime = Field(default_factory=datetime.now)
    is_supplement: bool = False


class AuditLog(BaseModel):
    id: str = ""
    entity_type: str
    entity_id: str
    action: str
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    changed_by: Role
    changed_at: datetime = Field(default_factory=datetime.now)
    reason: str = ""


class RectificationSuggestion(BaseModel):
    id: str = ""
    notice_id: str
    status: RecordStatus
    why_kept: str
    missing_materials: List[str]
    next_action: NextAction
    next_action_person: str
    notes: str = ""
    generated_at: datetime = Field(default_factory=datetime.now)
    version: int = 1
    is_latest: bool = True


class ScoreResult(BaseModel):
    id: str = ""
    notice_id: str
    score: float
    max_score: float = 100.0
    factors: Dict[str, float]
    calculated_at: datetime = Field(default_factory=datetime.now)
    version: int = 1
    ramp_records_used: List[str] = Field(default_factory=list)


class WorkflowState(BaseModel):
    notice_id: str
    step: int = 0
    step_description: str = ""
    has_ramp_supplement: bool = False
    score_changed_after_supplement: Optional[bool] = None
    status: RecordStatus = RecordStatus.PENDING_REVIEW
    status_reason: str = ""
    current_assignee: Optional[Role] = None
    history: List[Dict[str, Any]] = Field(default_factory=list)
