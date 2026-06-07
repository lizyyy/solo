from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class BaseModelWithConfig(BaseModel):
    model_config = ConfigDict(protected_namespaces=())


class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    HIDDEN_BY_AVG = "hidden_by_avg"


class SampleStatus(str, Enum):
    IMPORTED = "imported"
    ANNOTATED = "annotated"
    NEEDS_REVIEW = "needs_review"
    SUPPLEMENTED = "supplemented"
    RESOLVED = "resolved"
    ESCALATED = "escalated"


class NextAction(str, Enum):
    TO_KB_EDITOR = "to_kb_editor"
    TO_ALGO_OPER = "to_algo_oper"
    TO_REANNOTATE = "to_reannotate"
    TO_MODEL_RETRAIN = "to_model_retrain"


class ModelOutput(BaseModelWithConfig):
    model_version: str
    summary: str
    confidence: float = Field(ge=0.0, le=1.0)
    entities: List[Dict[str, Any]] = Field(default_factory=list)
    mask_details: List[Dict[str, Any]] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.now)
    raw_output: Optional[str] = None


class Annotation(BaseModelWithConfig):
    annotator: str
    corrected_summary: str
    comment: str
    timestamp: datetime = Field(default_factory=datetime.now)
    error_type: Optional[str] = None


class Supplement(BaseModelWithConfig):
    operator: str
    model_output_snippet: str
    reason: str
    timestamp: datetime = Field(default_factory=datetime.now)
    additional_notes: Optional[str] = None


class Sample(BaseModelWithConfig):
    sample_id: str
    original_text: str
    hotline_number: str
    call_time: datetime
    model_outputs: List[ModelOutput] = Field(default_factory=list)
    annotations: List[Annotation] = Field(default_factory=list)
    supplements: List[Supplement] = Field(default_factory=list)
    status: SampleStatus = SampleStatus.IMPORTED
    confidence_level: ConfidenceLevel = ConfidenceLevel.MEDIUM
    hidden_by_avg: bool = False
    next_action: Optional[NextAction] = None
    review_notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ModelVersionCompare(BaseModelWithConfig):
    sample_id: str
    baseline_version: str
    current_version: str
    baseline_confidence: float
    current_confidence: float
    confidence_diff: float
    baseline_summary: str
    current_summary: str
    key_differences: List[str]
    reason_kept: str
    missing_materials: List[str]
    next_action: NextAction
    is_low_conf_hidden: bool = False
    needs_kb_review: bool = False


class BatchImportResult(BaseModelWithConfig):
    total: int
    success: int
    failed: int
    low_confidence_count: int
    hidden_by_avg_count: int
    sample_ids: List[str]


class WorkflowStep(BaseModelWithConfig):
    step_name: str
    operator: str
    timestamp: datetime
    action: str
    notes: Optional[str] = None


class DemoDataset(BaseModelWithConfig):
    name: str
    description: str
    samples: List[Sample]
    workflow_steps: List[WorkflowStep]
    model_versions: List[str]
