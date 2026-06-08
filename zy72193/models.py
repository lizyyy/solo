from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class ExplanationStatus(str, Enum):
    AUTO_SUCCESS = "auto_success"
    NEED_HUMAN_REVIEW = "need_human_review"
    HUMAN_CONFIRMED = "human_confirmed"
    HUMAN_REVISED = "human_revised"
    LEGACY_FROM_ANNOTATION = "legacy_from_annotation"


class EvidenceType(str, Enum):
    USER_PROFILE = "user_profile"
    LEARNING_HISTORY = "learning_history"
    KNOWLEDGE_GAP = "knowledge_gap"
    SKILL_PREREQUISITE = "skill_prerequisite"
    CAREER_GOAL = "career_goal"
    ANNOTATION_TABLE = "annotation_table"
    MODEL_INFERENCE = "model_inference"


@dataclass
class ModelVersion:
    version: str
    threshold_config: Dict[str, float]
    deployed_at: str
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "threshold_config": self.threshold_config,
            "deployed_at": self.deployed_at,
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ModelVersion":
        return cls(
            version=data["version"],
            threshold_config=data["threshold_config"],
            deployed_at=data["deployed_at"],
            description=data["description"],
        )


@dataclass
class Evidence:
    evidence_type: EvidenceType
    source: str
    value: Any
    description: str
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "evidence_type": self.evidence_type.value
            if isinstance(self.evidence_type, EvidenceType)
            else self.evidence_type,
            "source": self.source,
            "value": self.value,
            "description": self.description,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Evidence":
        return cls(
            evidence_type=EvidenceType(data["evidence_type"]),
            source=data["source"],
            value=data["value"],
            description=data["description"],
            timestamp=data["timestamp"],
        )


@dataclass
class Sample:
    sample_id: str
    user_id: str
    user_profile: Dict[str, Any]
    learning_history: List[Dict[str, Any]]
    target_path: str
    online_feedback: Optional[Dict[str, Any]] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "user_id": self.user_id,
            "user_profile": self.user_profile,
            "learning_history": self.learning_history,
            "target_path": self.target_path,
            "online_feedback": self.online_feedback,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Sample":
        return cls(
            sample_id=data["sample_id"],
            user_id=data["user_id"],
            user_profile=data["user_profile"],
            learning_history=data["learning_history"],
            target_path=data["target_path"],
            online_feedback=data.get("online_feedback"),
            created_at=data.get("created_at", datetime.now().isoformat()),
        )


@dataclass
class HumanReview:
    reviewer: str
    reviewed_at: str
    original_status: str
    final_status: str
    revision_note: str
    revised_path: Optional[str] = None
    revised_evidence: Optional[List[Evidence]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reviewer": self.reviewer,
            "reviewed_at": self.reviewed_at,
            "original_status": self.original_status,
            "final_status": self.final_status,
            "revision_note": self.revision_note,
            "revised_path": self.revised_path,
            "revised_evidence": [e.to_dict() for e in self.revised_evidence]
            if self.revised_evidence
            else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HumanReview":
        return cls(
            reviewer=data["reviewer"],
            reviewed_at=data["reviewed_at"],
            original_status=data["original_status"],
            final_status=data["final_status"],
            revision_note=data["revision_note"],
            revised_path=data.get("revised_path"),
            revised_evidence=[Evidence.from_dict(e) for e in data["revised_evidence"]]
            if data.get("revised_evidence")
            else None,
        )


@dataclass
class ExplanationReport:
    report_id: str
    sample_id: str
    model_version: str
    status: ExplanationStatus
    recommended_path: str
    confidence_score: float
    evidence_chain: List[Evidence]
    threshold_used: Dict[str, float]
    generated_at: str
    generation_note: str
    human_review: Optional[HumanReview] = None
    legacy_source: Optional[str] = None
    online_feedback: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "sample_id": self.sample_id,
            "model_version": self.model_version,
            "status": self.status.value
            if isinstance(self.status, ExplanationStatus)
            else self.status,
            "recommended_path": self.recommended_path,
            "confidence_score": self.confidence_score,
            "evidence_chain": [e.to_dict() for e in self.evidence_chain],
            "threshold_used": self.threshold_used,
            "generated_at": self.generated_at,
            "generation_note": self.generation_note,
            "human_review": self.human_review.to_dict() if self.human_review else None,
            "legacy_source": self.legacy_source,
            "online_feedback": self.online_feedback,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExplanationReport":
        return cls(
            report_id=data["report_id"],
            sample_id=data["sample_id"],
            model_version=data["model_version"],
            status=ExplanationStatus(data["status"]),
            recommended_path=data["recommended_path"],
            confidence_score=data["confidence_score"],
            evidence_chain=[Evidence.from_dict(e) for e in data["evidence_chain"]],
            threshold_used=data["threshold_used"],
            generated_at=data["generated_at"],
            generation_note=data["generation_note"],
            human_review=HumanReview.from_dict(data["human_review"])
            if data.get("human_review")
            else None,
            legacy_source=data.get("legacy_source"),
            online_feedback=data.get("online_feedback"),
        )


@dataclass
class BatchRun:
    run_id: str
    run_timestamp: str
    model_version: str
    sample_count: int
    report_ids: List[str]
    metrics: Dict[str, float]
    sample_changes: List[Dict[str, str]]
    report_snapshots: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "run_timestamp": self.run_timestamp,
            "model_version": self.model_version,
            "sample_count": self.sample_count,
            "report_ids": self.report_ids,
            "metrics": self.metrics,
            "sample_changes": self.sample_changes,
            "report_snapshots": self.report_snapshots,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BatchRun":
        return cls(
            run_id=data["run_id"],
            run_timestamp=data["run_timestamp"],
            model_version=data["model_version"],
            sample_count=data["sample_count"],
            report_ids=data["report_ids"],
            metrics=data["metrics"],
            sample_changes=data.get("sample_changes", []),
            report_snapshots=data.get("report_snapshots", {}),
        )
