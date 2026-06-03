from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid


class SourceType(str, Enum):
    RANGEFINDER = "rangefinder"
    REMARK = "remark"
    MERGED = "merged"
    REJECTED = "rejected"


class ConfirmStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class ConflictType(str, Enum):
    NAME_CONFLICT = "name_conflict"
    POSITION_CONFLICT = "position_conflict"
    TYPE_CONFLICT = "type_conflict"
    CONCLUSION_CONFLICT = "conclusion_conflict"


class OperationLog(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    operator: str
    action: str
    detail: str


class TrajectoryPoint(BaseModel):
    point_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None


class RangefinderRecord(BaseModel):
    record_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_batch: str
    import_time: datetime = Field(default_factory=datetime.now)
    obstacle_name: str
    obstacle_type: str
    distance: float
    angle: float
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    raw_conclusion: str
    confidence: float
    imported_by: str
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    import_hash: str


class ObstacleRemark(BaseModel):
    remark_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    obstacle_name: str
    obstacle_type: str
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    field_remark: str
    conclusion: str
    submit_time: datetime = Field(default_factory=datetime.now)
    submitted_by: str
    source: str = "group_chat_supplement"


class ConflictEvidence(BaseModel):
    conflict_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conflict_type: ConflictType
    rangefinder_record_id: str
    remark_id: Optional[str] = None
    rangefinder_value: Any
    remark_value: Any
    description: str
    detected_at: datetime = Field(default_factory=datetime.now)
    confirm_status: ConfirmStatus = ConfirmStatus.PENDING
    decided_by: Optional[str] = None
    decided_at: Optional[datetime] = None


class NameAliasCandidate(BaseModel):
    candidate_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    primary_name: str
    alias_name: str
    similarity: float
    distance_meters: float
    primary_record_id: str
    alias_record_id: str
    confirm_status: ConfirmStatus = ConfirmStatus.PENDING
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class CalculationMeta(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_version: str
    parameter_version: str
    calculation_time: datetime = Field(default_factory=datetime.now)
    parameters_used: Dict[str, Any]
    justification: Dict[str, str]
    algorithm_description: str


class ObstacleAnnotation(BaseModel):
    annotation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    canonical_name: str
    obstacle_type: str
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    radius: float
    source_records: List[str] = Field(default_factory=list)
    source_remarks: List[str] = Field(default_factory=list)
    final_conclusion: str
    calculation_meta: CalculationMeta
    has_name_alias_issue: bool = False
    alias_candidates: List[NameAliasCandidate] = Field(default_factory=list)
    conflicts: List[ConflictEvidence] = Field(default_factory=list)
    needs_review: bool = False
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    version: int = 1
    previous_version: Optional[str] = None
    change_reason: Optional[str] = None


class AnnotationResult(BaseModel):
    result_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    creation_time: datetime = Field(default_factory=datetime.now)
    trajectory_points: List[TrajectoryPoint] = Field(default_factory=list)
    rangefinder_records: List[RangefinderRecord] = Field(default_factory=list)
    obstacle_remarks: List[ObstacleRemark] = Field(default_factory=list)
    annotations: List[ObstacleAnnotation] = Field(default_factory=list)
    conflicts: List[ConflictEvidence] = Field(default_factory=list)
    alias_candidates: List[NameAliasCandidate] = Field(default_factory=list)
    operations_log: List[OperationLog] = Field(default_factory=list)
    calculation_meta: CalculationMeta
    version: int = 1
    is_latest: bool = True


class SelfCheckItem(BaseModel):
    check_name: str
    passed: bool
    message: str
    details: List[str] = Field(default_factory=list)
    severity: str = "info"


class SelfCheckReport(BaseModel):
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    check_time: datetime = Field(default_factory=datetime.now)
    overall_passed: bool
    checks: List[SelfCheckItem] = Field(default_factory=list)
    result_hash: str
