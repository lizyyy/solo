from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime
import json


@dataclass
class FeatureValue:
    name: str
    value: Optional[float]
    is_default: bool
    source: str
    line_no: Optional[int] = None


@dataclass
class FeatureSnapshot:
    snapshot_id: str
    imported_at: str
    features: List[FeatureValue]
    raw_data: Dict[str, Any]
    source_file: Optional[str] = None

    def to_dict(self):
        return {
            "snapshot_id": self.snapshot_id,
            "imported_at": self.imported_at,
            "features": [
                {
                    "name": f.name,
                    "value": f.value,
                    "is_default": f.is_default,
                    "source": f.source,
                    "line_no": f.line_no
                }
                for f in self.features
            ],
            "raw_data": self.raw_data,
            "source_file": self.source_file
        }


@dataclass
class TrainingLogPoint:
    step: int
    loss: float
    temperature: float
    accuracy: float
    timestamp: str


@dataclass
class TrainingLog:
    log_id: str
    snapshot_id: str
    imported_at: str
    points: List[TrainingLogPoint]
    source_file: Optional[str] = None

    def to_dict(self):
        return {
            "log_id": self.log_id,
            "snapshot_id": self.snapshot_id,
            "imported_at": self.imported_at,
            "points": [
                {
                    "step": p.step,
                    "loss": p.loss,
                    "temperature": p.temperature,
                    "accuracy": p.accuracy,
                    "timestamp": p.timestamp
                }
                for p in self.points
            ],
            "source_file": self.source_file
        }


@dataclass
class Correction:
    correction_id: str
    snapshot_id: str
    corrected_by: str
    corrected_at: str
    corrections: Dict[str, float]
    reason: str

    def to_dict(self):
        return {
            "correction_id": self.correction_id,
            "snapshot_id": self.snapshot_id,
            "corrected_by": self.corrected_by,
            "corrected_at": self.corrected_at,
            "corrections": self.corrections,
            "reason": self.reason
        }


@dataclass
class ExplainableSummary:
    summary_id: str
    snapshot_id: str
    generated_at: str
    version: int
    has_training_log: bool
    has_correction: bool
    default_features: List[str]
    conclusion: str
    next_action: str
    reviewer: Optional[str]
    temperature_result: Optional[float]
    confidence: Optional[str]
    missing_materials: List[str]
    notes: List[str]

    def to_dict(self):
        return {
            "summary_id": self.summary_id,
            "snapshot_id": self.snapshot_id,
            "generated_at": self.generated_at,
            "version": self.version,
            "has_training_log": self.has_training_log,
            "has_correction": self.has_correction,
            "default_features": self.default_features,
            "conclusion": self.conclusion,
            "next_action": self.next_action,
            "reviewer": self.reviewer,
            "temperature_result": self.temperature_result,
            "confidence": self.confidence,
            "missing_materials": self.missing_materials,
            "notes": self.notes
        }


@dataclass
class RunRecord:
    run_id: str
    snapshot_id: str
    run_at: str
    run_type: str
    temperature: Optional[float]
    parameters: Dict[str, Any]
    status: str

    def to_dict(self):
        return {
            "run_id": self.run_id,
            "snapshot_id": self.snapshot_id,
            "run_at": self.run_at,
            "run_type": self.run_type,
            "temperature": self.temperature,
            "parameters": self.parameters,
            "status": self.status
        }


@dataclass
class TrialRecord:
    trial_id: str
    created_at: str
    snapshot: Optional[FeatureSnapshot] = None
    training_log: Optional[TrainingLog] = None
    corrections: List[Correction] = field(default_factory=list)
    summaries: List[ExplainableSummary] = field(default_factory=list)
    runs: List[RunRecord] = field(default_factory=list)
    status: str = "initial"

    def to_dict(self):
        return {
            "trial_id": self.trial_id,
            "created_at": self.created_at,
            "status": self.status,
            "snapshot": self.snapshot.to_dict() if self.snapshot else None,
            "training_log": self.training_log.to_dict() if self.training_log else None,
            "corrections": [c.to_dict() for c in self.corrections],
            "summaries": [s.to_dict() for s in self.summaries],
            "runs": [r.to_dict() for r in self.runs]
        }

    def save(self, path: str):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)
