from __future__ import annotations

import enum
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


class ConflictType(enum.Enum):
    MODEL_VS_MANUAL = "model_vs_manual"
    MODEL_VS_ONLINE = "model_vs_online"
    MANUAL_VS_ONLINE = "manual_vs_online"
    MULTI_MODEL_CONFLICT = "multi_model_conflict"
    MANUAL_DISAGREEMENT = "manual_disagreement"


class Severity(enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Sample:
    sample_id: str
    patient_id: str
    image_path: str
    modality: str
    body_part: str
    study_date: str


@dataclass
class ModelOutput:
    sample_id: str
    model_version: str
    predicted_label: str
    confidence: float
    predicted_at: str


@dataclass
class ManualCorrection:
    sample_id: str
    annotator_id: str
    corrected_label: str
    correction_reason: str
    corrected_at: str


@dataclass
class OnlineFeedback:
    sample_id: str
    feedback_source: str
    feedback_label: str
    feedback_note: str
    feedback_at: str


@dataclass
class EvidenceItem:
    source: str
    label: str
    detail: str
    timestamp: str


@dataclass
class ConflictRecord:
    conflict_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    sample_id: str = ""
    conflict_type: ConflictType = ConflictType.MODEL_VS_MANUAL
    severity: Severity = Severity.MEDIUM
    model_version: str = ""
    sources_involved: list[str] = field(default_factory=list)
    auto_judgment: str = ""
    evidence_chain: list[EvidenceItem] = field(default_factory=list)
    detected_at: str = field(default_factory=lambda: datetime.now().isoformat())
    resolved: bool = False
    resolution: str = ""


@dataclass
class AuditNote:
    note_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    target_id: str = ""
    target_type: str = "conflict"
    operator: str = ""
    note_content: str = ""
    prev_value: str = ""
    new_value: str = ""
    diff_description: str = ""
    source: str = "manual_note"
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
