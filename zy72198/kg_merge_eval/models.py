from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any
from datetime import datetime
from enum import Enum


class EntityType(str, Enum):
    COMPANY = "company"
    PERSON = "person"
    ADDRESS = "address"
    PHONE = "phone"
    BANK_CARD = "bank_card"
    ID_CARD = "id_card"
    UNKNOWN = "unknown"


class MergeDecision(str, Enum):
    MERGE = "merge"
    NOT_MERGE = "not_merge"
    REVIEW = "review"
    UNCERTAIN = "uncertain"


class ConflictType(str, Enum):
    LABEL_CONFLICT = "label_conflict"
    SAMPLE_LEAK = "sample_leak"
    MISSING_DATA = "missing_data"
    DUPLICATE = "duplicate"
    BOUNDARY_CASE = "boundary_case"


@dataclass
class SourceInfo:
    source_system: str
    source_batch: str
    source_id: str
    imported_at: datetime = field(default_factory=datetime.now)
    processed_by: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_system": self.source_system,
            "source_batch": self.source_batch,
            "source_id": self.source_id,
            "imported_at": self.imported_at.isoformat(),
            "processed_by": self.processed_by,
        }


@dataclass
class Entity:
    entity_id: str
    entity_type: EntityType
    entity_value: str
    attributes: Dict[str, Any] = field(default_factory=dict)
    source: Optional[SourceInfo] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "entity_type": self.entity_type.value,
            "entity_value": self.entity_value,
            "attributes": self.attributes,
            "source": self.source.to_dict() if self.source else None,
        }


@dataclass
class Sample:
    sample_id: str
    entity_a: Entity
    entity_b: Entity
    ground_truth: Optional[MergeDecision] = None
    created_at: datetime = field(default_factory=datetime.now)
    source: Optional[SourceInfo] = None
    tags: List[str] = field(default_factory=list)
    is_boundary: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "entity_a": self.entity_a.to_dict(),
            "entity_b": self.entity_b.to_dict(),
            "ground_truth": self.ground_truth.value if self.ground_truth else None,
            "created_at": self.created_at.isoformat(),
            "source": self.source.to_dict() if self.source else None,
            "tags": self.tags,
            "is_boundary": self.is_boundary,
        }

    def has_duplicate_entities(self) -> bool:
        return (
            self.entity_a.entity_value is not None
            and self.entity_b.entity_value is not None
            and self.entity_a.entity_value.strip() == self.entity_b.entity_value.strip()
        )

    def has_missing_values(self) -> bool:
        return (
            not self.entity_a.entity_value
            or not self.entity_b.entity_value
            or not self.entity_a.entity_id
            or not self.entity_b.entity_id
        )


@dataclass
class ModelOutput:
    sample_id: str
    decision: MergeDecision
    confidence: float
    model_version: str
    merge_reason: Optional[str] = None
    predicted_cluster_id: Optional[str] = None
    processed_at: datetime = field(default_factory=datetime.now)
    execution_time_ms: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "decision": self.decision.value,
            "confidence": self.confidence,
            "model_version": self.model_version,
            "merge_reason": self.merge_reason,
            "predicted_cluster_id": self.predicted_cluster_id,
            "processed_at": self.processed_at.isoformat(),
            "execution_time_ms": self.execution_time_ms,
        }


@dataclass
class HumanCorrection:
    sample_id: str
    original_decision: MergeDecision
    corrected_decision: MergeDecision
    correction_reason: str
    corrected_by: str
    corrected_at: datetime = field(default_factory=datetime.now)
    is_overridden: bool = False
    override_note: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "original_decision": self.original_decision.value,
            "corrected_decision": self.corrected_decision.value,
            "correction_reason": self.correction_reason,
            "corrected_by": self.corrected_by,
            "corrected_at": self.corrected_at.isoformat(),
            "is_overridden": self.is_overridden,
            "override_note": self.override_note,
        }


@dataclass
class FeedbackRecord:
    sample_id: str
    feedback_type: str
    feedback_content: str
    feedback_channel: str
    feedback_by: Optional[str] = None
    feedback_at: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "feedback_type": self.feedback_type,
            "feedback_content": self.feedback_content,
            "feedback_channel": self.feedback_channel,
            "feedback_by": self.feedback_by,
            "feedback_at": self.feedback_at.isoformat(),
            "resolved": self.resolved,
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolution_note": self.resolution_note,
        }


@dataclass
class ConflictAlert:
    conflict_type: ConflictType
    sample_id: str
    severity: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_type": self.conflict_type.value,
            "sample_id": self.sample_id,
            "severity": self.severity,
            "message": self.message,
            "details": self.details,
        }


@dataclass
class MergedRecord:
    sample: Sample
    model_output: Optional[ModelOutput] = None
    human_correction: Optional[HumanCorrection] = None
    feedback: Optional[List[FeedbackRecord]] = None
    conflicts: List[ConflictAlert] = field(default_factory=list)
    final_decision: Optional[MergeDecision] = None

    def __post_init__(self):
        self.feedback = self.feedback or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample": self.sample.to_dict(),
            "model_output": self.model_output.to_dict() if self.model_output else None,
            "human_correction": (
                self.human_correction.to_dict() if self.human_correction else None
            ),
            "feedback": [f.to_dict() for f in self.feedback],
            "conflicts": [c.to_dict() for c in self.conflicts],
            "final_decision": self.final_decision.value if self.final_decision else None,
        }

    def get_trace(self) -> Dict[str, Any]:
        trace = {
            "sample_id": self.sample.sample_id,
            "sample_source": (
                self.sample.source.to_dict() if self.sample.source else None
            ),
            "model_processed": self.model_output is not None,
            "human_corrected": self.human_correction is not None,
            "has_feedback": len(self.feedback) > 0,
            "conflict_count": len(self.conflicts),
            "decision_trail": [],
        }

        if self.sample.ground_truth:
            trace["decision_trail"].append(
                {
                    "stage": "ground_truth",
                    "decision": self.sample.ground_truth.value,
                    "time": self.sample.created_at.isoformat(),
                }
            )

        if self.model_output:
            trace["decision_trail"].append(
                {
                    "stage": "model",
                    "decision": self.model_output.decision.value,
                    "confidence": self.model_output.confidence,
                    "time": self.model_output.processed_at.isoformat(),
                    "model_version": self.model_output.model_version,
                }
            )

        if self.human_correction:
            trace["decision_trail"].append(
                {
                    "stage": "human_correction",
                    "from_decision": self.human_correction.original_decision.value,
                    "to_decision": self.human_correction.corrected_decision.value,
                    "corrected_by": self.human_correction.corrected_by,
                    "time": self.human_correction.corrected_at.isoformat(),
                }
            )

        return trace
