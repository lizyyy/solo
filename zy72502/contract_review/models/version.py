from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


@dataclass
class ModelVersionMetrics:
    version: str
    total_samples: int = 0
    avg_confidence: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    low_confidence_count: int = 0
    masked_by_avg_count: int = 0
    pending_review_count: int = 0


@dataclass
class VersionComparisonItem:
    sample_id: str
    contract_name: str
    v1_sample_id: Optional[str] = None
    v2_sample_id: Optional[str] = None
    v1_confidence: Optional[float] = None
    v2_confidence: Optional[float] = None
    confidence_change: float = 0.0
    v1_status: str = ""
    v2_status: str = ""
    status_changed: bool = False
    was_masked_in_v1: bool = False
    was_masked_in_v2: bool = False
    v1_low_confidence_count: int = 0
    v2_low_confidence_count: int = 0
    has_ticket: bool = False
    ticket_count: int = 0
    has_desensitization_note: bool = False
    next_action: str = ""
    next_owner: str = ""
    missing_materials: List[str] = field(default_factory=list)
    reason_kept: str = ""

    def to_dict(self):
        return {
            "sample_id": self.sample_id,
            "contract_name": self.contract_name,
            "v1_sample_id": self.v1_sample_id,
            "v2_sample_id": self.v2_sample_id,
            "v1_confidence": self.v1_confidence,
            "v2_confidence": self.v2_confidence,
            "confidence_change": self.confidence_change,
            "v1_status": self.v1_status,
            "v2_status": self.v2_status,
            "status_changed": self.status_changed,
            "was_masked_in_v1": self.was_masked_in_v1,
            "was_masked_in_v2": self.was_masked_in_v2,
            "v1_low_confidence_count": self.v1_low_confidence_count,
            "v2_low_confidence_count": self.v2_low_confidence_count,
            "has_ticket": self.has_ticket,
            "ticket_count": self.ticket_count,
            "has_desensitization_note": self.has_desensitization_note,
            "next_action": self.next_action,
            "next_owner": self.next_owner,
            "missing_materials": self.missing_materials,
            "reason_kept": self.reason_kept
        }


@dataclass
class VersionComparisonReport:
    report_id: str = field(default_factory=lambda: f"REP{uuid.uuid4().hex[:8].upper()}")
    v1: str = ""
    v2: str = ""
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    generated_by: str = ""
    items: List[VersionComparisonItem] = field(default_factory=list)
    v1_metrics: Optional[ModelVersionMetrics] = None
    v2_metrics: Optional[ModelVersionMetrics] = None
    summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self):
        return {
            "report_id": self.report_id,
            "v1": self.v1,
            "v2": self.v2,
            "generated_at": self.generated_at,
            "generated_by": self.generated_by,
            "summary": self.summary,
            "v1_metrics": self.v1_metrics.__dict__ if self.v1_metrics else None,
            "v2_metrics": self.v2_metrics.__dict__ if self.v2_metrics else None,
            "items": [item.to_dict() for item in self.items]
        }
