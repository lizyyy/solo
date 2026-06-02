from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class RecordStatus(str, Enum):
    SUCCESS = "success"
    NEEDS_REVIEW = "needs_review"
    CONFLICT = "conflict"
    INVALID = "invalid"
    LEGACY = "legacy"


class DataSource(str, Enum):
    ANNOTATION = "annotation"
    ONLINE_FEEDBACK = "online_feedback"
    EVAL_LOG = "eval_log"


class SchedulingDecision(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    warehouse_id: str
    priority: int
    estimated_cost: float
    model_reasoning: str = ""


class EvaluationRecord(BaseModel):
    record_id: str
    source: DataSource
    scheduling_decision: SchedulingDecision
    ground_truth: Optional[SchedulingDecision] = None
    status: RecordStatus
    conflict_reason: Optional[str] = None
    review_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    modified_at: datetime = Field(default_factory=datetime.now)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ModelVersion(BaseModel):
    version: str
    description: str
    created_at: datetime = Field(default_factory=datetime.now)
    is_active: bool = False
    threshold_config: Dict[str, float] = Field(default_factory=dict)


class EvaluationReport(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    report_id: str
    model_version: str
    total_records: int
    success_count: int
    needs_review_count: int
    conflict_count: int
    invalid_count: int
    legacy_count: int
    accuracy: float
    created_at: datetime = Field(default_factory=datetime.now)
    conflict_records: List[Dict[str, Any]] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
