from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class DataStatus(Enum):
    KEPT = "kept"
    DUPLICATE = "duplicate"
    EMPTY = "empty"
    BOUNDARY = "boundary"
    CONFLICT = "conflict"


class LabelType(Enum):
    ACCEPT = "accept"
    REVISE = "revise"
    REJECT = "reject"
    PENDING = "pending"


@dataclass
class EvaluationRecord:
    sample_id: str
    problem_id: str
    model_output: str
    model_version: str
    score: float
    timestamp: datetime
    raw_source: Dict[str, Any]
    record_id: str = field(init=False)

    def __post_init__(self):
        self.record_id = f"{self.sample_id}_{self.model_version}_{self.timestamp.strftime('%Y%m%d%H%M%S')}"

    def is_empty(self) -> bool:
        return not self.model_output.strip() or self.score == 0.0


@dataclass
class AnnotationRecord:
    sample_id: str
    problem_id: str
    human_label: LabelType
    annotator: str
    annotation_time: datetime
    confidence: str
    notes: str


@dataclass
class ConflictCase:
    case_id: str
    sample_id: str
    description: str
    expected_action: str
    severity: str


@dataclass
class ProcessedRecord:
    primary_record: EvaluationRecord
    status: DataStatus
    duplicates: List[EvaluationRecord] = field(default_factory=list)
    annotation: Optional[AnnotationRecord] = None
    conflict_case: Optional[ConflictCase] = None
    similarity_scores: Dict[str, float] = field(default_factory=dict)
    processed_at: datetime = field(default_factory=datetime.now)
    human_decision_override: Optional[LabelType] = None
    needs_review: bool = False
    review_notes: str = ""
    processing_reason: str = ""

    def get_final_label(self) -> LabelType:
        if self.human_decision_override:
            return self.human_decision_override
        if self.annotation:
            return self.annotation.human_label
        return LabelType.PENDING

    def get_source_trace(self) -> List[str]:
        traces = [f"主记录: {self.primary_record.record_id} (来源: {self.primary_record.timestamp.isoformat()})"]
        for dup in self.duplicates:
            traces.append(f"重复记录: {dup.record_id} (来源: {dup.timestamp.isoformat()}, 版本: {dup.model_version})")
        return traces
