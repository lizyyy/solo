import enum
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _uid() -> str:
    return uuid.uuid4().hex[:12]


class EvalStatus(enum.Enum):
    AUTO = "auto"
    MANUAL_CORRECTED = "manual_corrected"
    CONFLICT = "conflict"
    NEEDS_REVIEW = "needs_review"


class ConflictResolution(enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    DEFERRED = "deferred"


@dataclass
class Sample:
    sample_id: str
    raw_log: str
    source: str
    imported_at: str = field(default_factory=_now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    fingerprint: str = ""

    def __post_init__(self):
        if not self.fingerprint:
            self.fingerprint = self._compute_fingerprint()

    def _compute_fingerprint(self) -> str:
        import hashlib
        normalized = " ".join(self.raw_log.split())
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


@dataclass
class Evidence:
    kind: str
    location: str
    content: str
    confidence: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "kind": self.kind,
            "location": self.location,
            "content": self.content,
            "confidence": self.confidence,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Evidence":
        return cls(**d)


@dataclass
class Evaluation:
    eval_id: str = field(default_factory=_uid)
    sample_id: str = ""
    cluster_label: str = ""
    root_cause: str = ""
    confidence: float = 0.0
    evidence: List[Evidence] = field(default_factory=list)
    model_version: str = ""
    evaluated_at: str = field(default_factory=_now)
    status: EvalStatus = EvalStatus.AUTO
    source: str = "model"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "eval_id": self.eval_id,
            "sample_id": self.sample_id,
            "cluster_label": self.cluster_label,
            "root_cause": self.root_cause,
            "confidence": self.confidence,
            "evidence": [e.to_dict() for e in self.evidence],
            "model_version": self.model_version,
            "evaluated_at": self.evaluated_at,
            "status": self.status.value,
            "source": self.source,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Evaluation":
        ev = d.get("evidence", [])
        return cls(
            eval_id=d.get("eval_id", _uid()),
            sample_id=d.get("sample_id", ""),
            cluster_label=d.get("cluster_label", ""),
            root_cause=d.get("root_cause", ""),
            confidence=d.get("confidence", 0.0),
            evidence=[Evidence.from_dict(e) for e in ev],
            model_version=d.get("model_version", ""),
            evaluated_at=d.get("evaluated_at", _now()),
            status=EvalStatus(d.get("status", "auto")),
            source=d.get("source", "model"),
        )


@dataclass
class Correction:
    correction_id: str = field(default_factory=_uid)
    eval_id: str = ""
    field_corrected: str = ""
    old_value: str = ""
    new_value: str = ""
    corrector: str = ""
    reason: str = ""
    corrected_at: str = field(default_factory=_now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "correction_id": self.correction_id,
            "eval_id": self.eval_id,
            "field_corrected": self.field_corrected,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "corrector": self.corrector,
            "reason": self.reason,
            "corrected_at": self.corrected_at,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Correction":
        return cls(
            correction_id=d.get("correction_id", _uid()),
            eval_id=d.get("eval_id", ""),
            field_corrected=d.get("field_corrected", ""),
            old_value=d.get("old_value", ""),
            new_value=d.get("new_value", ""),
            corrector=d.get("corrector", ""),
            reason=d.get("reason", ""),
            corrected_at=d.get("corrected_at", _now()),
        )


@dataclass
class Conflict:
    conflict_id: str = field(default_factory=_uid)
    sample_id: str = ""
    model_claim: str = ""
    imported_claim: str = ""
    model_evidence: List[Evidence] = field(default_factory=list)
    imported_evidence: List[Evidence] = field(default_factory=list)
    suggested_action: str = ""
    detected_at: str = field(default_factory=_now)
    resolution: ConflictResolution = ConflictResolution.PENDING
    resolution_detail: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_id": self.conflict_id,
            "sample_id": self.sample_id,
            "model_claim": self.model_claim,
            "imported_claim": self.imported_claim,
            "model_evidence": [e.to_dict() for e in self.model_evidence],
            "imported_evidence": [e.to_dict() for e in self.imported_evidence],
            "suggested_action": self.suggested_action,
            "detected_at": self.detected_at,
            "resolution": self.resolution.value,
            "resolution_detail": self.resolution_detail,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Conflict":
        me = d.get("model_evidence", [])
        ie = d.get("imported_evidence", [])
        return cls(
            conflict_id=d.get("conflict_id", _uid()),
            sample_id=d.get("sample_id", ""),
            model_claim=d.get("model_claim", ""),
            imported_claim=d.get("imported_claim", ""),
            model_evidence=[Evidence.from_dict(e) for e in me],
            imported_evidence=[Evidence.from_dict(e) for e in ie],
            suggested_action=d.get("suggested_action", ""),
            detected_at=d.get("detected_at", _now()),
            resolution=ConflictResolution(d.get("resolution", "pending")),
            resolution_detail=d.get("resolution_detail", ""),
        )


@dataclass
class OnlineFeedback:
    feedback_id: str = field(default_factory=_uid)
    sample_id: str = ""
    feedback_type: str = ""
    feedback_content: str = ""
    reporter: str = ""
    reported_at: str = field(default_factory=_now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feedback_id": self.feedback_id,
            "sample_id": self.sample_id,
            "feedback_type": self.feedback_type,
            "feedback_content": self.feedback_content,
            "reporter": self.reporter,
            "reported_at": self.reported_at,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "OnlineFeedback":
        return cls(
            feedback_id=d.get("feedback_id", _uid()),
            sample_id=d.get("sample_id", ""),
            feedback_type=d.get("feedback_type", ""),
            feedback_content=d.get("feedback_content", ""),
            reporter=d.get("reporter", ""),
            reported_at=d.get("reported_at", _now()),
        )
