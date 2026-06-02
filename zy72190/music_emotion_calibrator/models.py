from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional


class Emotion(str, Enum):
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    RELAXED = "relaxed"
    EXCITED = "excited"
    MELANCHOLY = "melancholic"
    ROMANTIC = "romantic"
    NOSTALGIC = "nostalgic"
    ANXIOUS = "anxious"
    NEUTRAL = "neutral"


class JudgmentSource(str, Enum):
    MODEL = "model"
    MANUAL = "manual"
    ONLINE_FEEDBACK = "online_feedback"
    REQUIRES_REVIEW = "requires_review"


class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class StratificationLayer(str, Enum):
    BY_EMOTION = "by_emotion"
    BY_CONFIDENCE = "by_confidence"
    BY_SOURCE = "by_source"
    BY_AGREEMENT = "by_agreement"


@dataclass
class Sample:
    sample_id: str
    title: str
    artist: str
    duration_sec: float
    genre: str
    tags: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def fingerprint(self) -> str:
        blob = json.dumps(
            {"sample_id": self.sample_id, "title": self.title, "artist": self.artist},
            sort_keys=True,
            ensure_ascii=False,
        )
        return hashlib.sha256(blob.encode()).hexdigest()[:12]


@dataclass
class ModelOutput:
    sample_id: str
    predicted_emotion: str
    confidence_score: float
    model_version: str
    inference_timestamp: str
    logits: dict[str, float] = field(default_factory=dict)

    def confidence_level(self) -> Confidence:
        if self.confidence_score >= 0.85:
            return Confidence.HIGH
        if self.confidence_score >= 0.6:
            return Confidence.MEDIUM
        return Confidence.LOW


@dataclass
class ManualCorrection:
    sample_id: str
    corrected_emotion: str
    annotator_id: str
    correction_timestamp: str
    reason: str = ""
    previous_emotion: str = ""

    def to_evidence(self) -> dict:
        return {
            "type": "manual_correction",
            "annotator": self.annotator_id,
            "corrected_from": self.previous_emotion,
            "corrected_to": self.corrected_emotion,
            "reason": self.reason,
            "timestamp": self.correction_timestamp,
        }


@dataclass
class OnlineFeedback:
    sample_id: str
    user_reported_emotion: str
    feedback_source: str
    feedback_timestamp: str
    user_id: str = ""
    thumbs_up: Optional[bool] = None
    comment: str = ""

    def to_evidence(self) -> dict:
        return {
            "type": "online_feedback",
            "reported_emotion": self.user_reported_emotion,
            "source": self.feedback_source,
            "user_id": self.user_id,
            "thumbs_up": self.thumbs_up,
            "comment": self.comment,
            "timestamp": self.feedback_timestamp,
        }


@dataclass
class EvidenceChain:
    sample_id: str
    decision: str
    decision_source: JudgmentSource
    evidence_items: list[dict] = field(default_factory=list)
    reasoning: str = ""

    def to_dict(self) -> dict:
        return {
            "sample_id": self.sample_id,
            "decision": self.decision,
            "decision_source": self.decision_source.value,
            "evidence_items": self.evidence_items,
            "reasoning": self.reasoning,
        }


@dataclass
class CalibrationRecord:
    sample_id: str
    sample_fingerprint: str
    final_emotion: str
    final_source: JudgmentSource
    evidence_chain: EvidenceChain
    model_prediction: str
    model_confidence: float
    model_version: str
    manual_correction: Optional[str] = None
    online_feedback: Optional[str] = None
    agreement_status: str = ""
    processing_timestamp: str = ""
    original_source_file: str = ""

    def to_dict(self) -> dict:
        return {
            "sample_id": self.sample_id,
            "sample_fingerprint": self.sample_fingerprint,
            "final_emotion": self.final_emotion,
            "final_source": self.final_source.value,
            "evidence_chain": self.evidence_chain.to_dict(),
            "model_prediction": self.model_prediction,
            "model_confidence": self.model_confidence,
            "model_version": self.model_version,
            "manual_correction": self.manual_correction,
            "online_feedback": self.online_feedback,
            "agreement_status": self.agreement_status,
            "processing_timestamp": self.processing_timestamp,
            "original_source_file": self.original_source_file,
        }


@dataclass
class Annotation:
    sample_id: str
    annotation_text: str
    annotator_id: str
    annotation_timestamp: str
    previous_final_emotion: str = ""
    previous_source: str = ""
    diff_description: str = ""

    def to_dict(self) -> dict:
        return {
            "sample_id": self.sample_id,
            "annotation_text": self.annotation_text,
            "annotator_id": self.annotator_id,
            "annotation_timestamp": self.annotation_timestamp,
            "previous_final_emotion": self.previous_final_emotion,
            "previous_source": self.previous_source,
            "diff_description": self.diff_description,
        }


@dataclass
class CalibratorRun:
    run_id: str
    run_timestamp: str
    input_files: dict[str, str]
    records: list[CalibrationRecord] = field(default_factory=list)
    annotations: list[Annotation] = field(default_factory=list)
    summary: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "run_timestamp": self.run_timestamp,
            "input_files": self.input_files,
            "records": [r.to_dict() for r in self.records],
            "annotations": [a.to_dict() for a in self.annotations],
            "summary": self.summary,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)
