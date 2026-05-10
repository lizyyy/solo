from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime


class DifficultyLevel(Enum):
    V0 = "V0"
    V1 = "V1"
    V2 = "V2"
    V3 = "V3"
    V4 = "V4"
    V5 = "V5"
    V6 = "V6"
    V7 = "V7"
    V8 = "V8"
    V9 = "V9"
    V10 = "V10"
    V11 = "V11"
    V12 = "V12"


class HoldType(Enum):
    JUG = "jug"
    CRIMP = "crimp"
    SLOPER = "sloper"
    POCKET = "pocket"
    PINCH = "pinch"
    FOOTHOLD = "foothold"


class RouteStatus(Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    ARCHIVED = "archived"


@dataclass
class Hold:
    id: str
    type: HoldType
    position: Dict[str, float]
    size: float
    difficulty_contribution: float
    is_start: bool = False
    is_end: bool = False


@dataclass
class Route:
    id: str
    name: str
    wall_section: str
    angle: float
    proposed_difficulty: Optional[DifficultyLevel] = None
    confirmed_difficulty: Optional[DifficultyLevel] = None
    status: RouteStatus = RouteStatus.DRAFT
    holds: List[Hold] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    notes: Optional[str] = None


@dataclass
class ClimbFeedback:
    id: str
    route_id: str
    climber_name: str
    climber_experience_level: str
    completed: bool
    time_taken: Optional[float] = None
    number_of_attempts: int = 1
    perceived_difficulty: Optional[DifficultyLevel] = None
    comments: Optional[str] = None
    submitted_at: datetime = field(default_factory=datetime.now)


@dataclass
class Issue:
    id: str
    type: str
    source: str
    data: Dict[str, Any]
    reason: str
    created_at: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolution: Optional[str] = None


@dataclass
class OperationLog:
    id: str
    operation: str
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    success: bool
    error_reason: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
