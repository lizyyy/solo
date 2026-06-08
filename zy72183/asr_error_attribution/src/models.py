from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid


class ErrorType(Enum):
    HOMOPHONE = "homophone"
    ACRONYM = "acronym"
    PROPER_NOUN = "proper_noun"
    BACKGROUND_NOISE = "background_noise"
    ACCENT = "accent"
    UNKNOWN = "unknown"


class AttributionStatus(Enum):
    PENDING = "pending"
    AUTO_ATTRIBUTED = "auto_attributed"
    MANUAL_REVIEWED = "manual_reviewed"
    CONFLICT = "conflict"
    RESOLVED = "resolved"


class ReviewAction(Enum):
    CONFIRM = "confirm"
    REVISE = "revise"
    REJECT = "reject"


@dataclass
class ThresholdConfig:
    version: str
    confidence_high: float = 0.9
    confidence_medium: float = 0.7
    confidence_low: float = 0.5
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = "system"
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "confidence_high": self.confidence_high,
            "confidence_medium": self.confidence_medium,
            "confidence_low": self.confidence_low,
            "created_at": self.created_at.isoformat(),
            "created_by": self.created_by,
            "description": self.description,
        }


@dataclass
class EvaluationLog:
    log_id: str
    audio_id: str
    reference_text: str
    asr_output: str
    model_version: str
    wer: float
    cer: float
    created_at: datetime
    source_file: str
    raw_data: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EvaluationLog":
        return cls(
            log_id=data.get("log_id", str(uuid.uuid4())),
            audio_id=data.get("audio_id", ""),
            reference_text=data.get("reference_text", ""),
            asr_output=data.get("asr_output", ""),
            model_version=data.get("model_version", ""),
            wer=float(data.get("wer", 0.0)),
            cer=float(data.get("cer", 0.0)),
            created_at=datetime.fromisoformat(data["created_at"]) if isinstance(data.get("created_at"), str) else data.get("created_at", datetime.now()),
            source_file=data.get("source_file", ""),
            raw_data=data.get("raw_data", {}),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "log_id": self.log_id,
            "audio_id": self.audio_id,
            "reference_text": self.reference_text,
            "asr_output": self.asr_output,
            "model_version": self.model_version,
            "wer": self.wer,
            "cer": self.cer,
            "created_at": self.created_at.isoformat(),
            "source_file": self.source_file,
            "raw_data": self.raw_data,
        }


@dataclass
class AnnotationRecord:
    annotation_id: str
    log_id: str
    error_word: str
    correct_word: str
    error_type: str
    confidence: float
    annotated_by: str
    annotated_at: datetime
    notes: str = ""
    is_valid: bool = True

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AnnotationRecord":
        return cls(
            annotation_id=data.get("annotation_id", str(uuid.uuid4())),
            log_id=data.get("log_id", ""),
            error_word=data.get("error_word", ""),
            correct_word=data.get("correct_word", ""),
            error_type=data.get("error_type", ErrorType.UNKNOWN.value),
            confidence=float(data.get("confidence", 0.0)),
            annotated_by=data.get("annotated_by", ""),
            annotated_at=datetime.fromisoformat(data["annotated_at"]) if isinstance(data.get("annotated_at"), str) else data.get("annotated_at", datetime.now()),
            notes=data.get("notes", ""),
            is_valid=bool(data.get("is_valid", True)),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "annotation_id": self.annotation_id,
            "log_id": self.log_id,
            "error_word": self.error_word,
            "correct_word": self.correct_word,
            "error_type": self.error_type,
            "confidence": self.confidence,
            "annotated_by": self.annotated_by,
            "annotated_at": self.annotated_at.isoformat(),
            "notes": self.notes,
            "is_valid": self.is_valid,
        }


@dataclass
class AttributionResult:
    attribution_id: str
    log_id: str
    annotation_id: str
    error_type: str
    confidence: float
    evidence: List[str]
    status: AttributionStatus
    threshold_version: str
    model_version: str
    created_at: datetime
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: str = ""
    review_action: Optional[str] = None
    final_error_type: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AttributionResult":
        return cls(
            attribution_id=data.get("attribution_id", str(uuid.uuid4())),
            log_id=data.get("log_id", ""),
            annotation_id=data.get("annotation_id", ""),
            error_type=data.get("error_type", ErrorType.UNKNOWN.value),
            confidence=float(data.get("confidence", 0.0)),
            evidence=data.get("evidence", []),
            status=AttributionStatus(data.get("status", AttributionStatus.PENDING.value)),
            threshold_version=data.get("threshold_version", ""),
            model_version=data.get("model_version", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if isinstance(data.get("created_at"), str) else data.get("created_at", datetime.now()),
            reviewed_by=data.get("reviewed_by"),
            reviewed_at=datetime.fromisoformat(data["reviewed_at"]) if data.get("reviewed_at") else None,
            review_notes=data.get("review_notes", ""),
            review_action=data.get("review_action"),
            final_error_type=data.get("final_error_type"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "attribution_id": self.attribution_id,
            "log_id": self.log_id,
            "annotation_id": self.annotation_id,
            "error_type": self.error_type,
            "result_error_type": self.final_error_type or self.error_type,
            "confidence": self.confidence,
            "evidence": self.evidence,
            "status": self.status.value,
            "threshold_version": self.threshold_version,
            "model_version": self.model_version,
            "created_at": self.created_at.isoformat(),
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "review_notes": self.review_notes,
            "review_action": self.review_action,
            "final_error_type": self.final_error_type,
        }


@dataclass
class ConflictRecord:
    conflict_id: str
    log_id: str
    annotation_id: str
    attribution_id: str
    conflict_type: str
    description: str
    auto_attribution: str
    manual_attribution: Optional[str] = None
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConflictRecord":
        return cls(
            conflict_id=data.get("conflict_id", str(uuid.uuid4())),
            log_id=data.get("log_id", ""),
            annotation_id=data.get("annotation_id", ""),
            attribution_id=data.get("attribution_id", ""),
            conflict_type=data.get("conflict_type", ""),
            description=data.get("description", ""),
            auto_attribution=data.get("auto_attribution", ""),
            manual_attribution=data.get("manual_attribution"),
            resolved=bool(data.get("resolved", False)),
            resolved_by=data.get("resolved_by"),
            resolved_at=datetime.fromisoformat(data["resolved_at"]) if data.get("resolved_at") else None,
            resolution_notes=data.get("resolution_notes", ""),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_id": self.conflict_id,
            "log_id": self.log_id,
            "annotation_id": self.annotation_id,
            "attribution_id": self.attribution_id,
            "conflict_type": self.conflict_type,
            "description": self.description,
            "auto_attribution": self.auto_attribution,
            "manual_attribution": self.manual_attribution,
            "resolved": self.resolved,
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolution_notes": self.resolution_notes,
        }
