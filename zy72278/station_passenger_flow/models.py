from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class DirectionStatus(str, Enum):
    NORMAL = "normal"
    REVERSED_OLD_HABIT = "reversed_old_habit"
    PENDING_REVIEW = "pending_review"


class WorkflowStep(str, Enum):
    CAD_IMPORT = "cad_import"
    RANGEFINDER_SUPPLEMENT = "rangefinder_supplement"
    PATH_REPLAY_UPDATE = "path_replay_update"
    COMPLETED = "completed"


class ConflictType(str, Enum):
    Z_AXIS_DIRECTION = "z_axis_direction"
    DISTANCE_MISMATCH = "distance_mismatch"
    LAYER_NAME_MISMATCH = "layer_name_mismatch"


class CADLayer(BaseModel):
    layer_id: str
    layer_name: str
    import_time: datetime
    z_direction: float = Field(description="Z轴方向值，正数为向上，负数为向下")
    points: List[Dict[str, float]] = Field(default_factory=list)
    is_duplicate: bool = False
    source_file: str
    import_batch: str


class RangefinderRecord(BaseModel):
    record_id: str
    measure_time: datetime
    z_direction: float = Field(description="测距仪记录的Z轴方向")
    distance: float
    measure_point: str
    operator: str
    is_supplement: bool = False
    notes: Optional[str] = None


class ConflictEvidence(BaseModel):
    conflict_type: ConflictType
    cad_value: Any
    rangefinder_value: Any
    description: str
    location: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)


class SelfCheckResult(BaseModel):
    check_name: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None


class PathPoint(BaseModel):
    x: float
    y: float
    z: float
    timestamp: datetime
    passenger_count: int


class PassengerFlowResult(BaseModel):
    result_id: str
    station_name: str
    hall_name: str
    calculate_time: datetime
    bottleneck_location: str
    bottleneck_flow: int
    capacity: int
    utilization_rate: float
    cad_layer: Optional[CADLayer] = None
    rangefinder_records: List[RangefinderRecord] = Field(default_factory=list)
    conflicts: List[ConflictEvidence] = Field(default_factory=list)
    self_check_results: List[SelfCheckResult] = Field(default_factory=list)
    current_step: WorkflowStep = WorkflowStep.CAD_IMPORT
    z_direction_status: DirectionStatus = DirectionStatus.NORMAL
    path_history: List[PathPoint] = Field(default_factory=list)
    is_supplemented: bool = False
    version: int = 1
    operator: Optional[str] = None


class UserDecision(BaseModel):
    decision_time: datetime
    operator: str
    conflict_id: str
    confirmed: bool
    comment: Optional[str] = None
