from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple


class AttrStatus(str, Enum):
    PENDING = "pending"
    NORMAL = "normal"
    SUSPENDED = "suspended"
    REVISED = "revised"
    RELEASED = "released"
    NEED_MATERIAL = "need_material"


class SourceType(str, Enum):
    PARAM_OLD = "param_old"
    PARAM_CURRENT = "param_current"
    LATER_NOTE = "later_note"
    VERBAL_NOTE = "verbal_note"


@dataclass(frozen=True)
class ParamVersion:
    version: str
    created_at: datetime
    weight_matrix: Dict[Tuple[str, str], float]
    knowledge_points: List[str]
    question_ids: List[str]

    def is_empty(self) -> bool:
        return (
            len(self.knowledge_points) == 0
            or len(self.question_ids) == 0
            or len(self.weight_matrix) == 0
        )


@dataclass(frozen=True)
class Note:
    note_id: str
    source_type: SourceType
    author: str
    created_at: datetime
    content: str
    affects: List[str] = field(default_factory=list)
    weight: float = 1.0


@dataclass
class Influence:
    source_type: SourceType
    source_id: str
    delta: float
    detail: str = ""


@dataclass
class AttributionRecord:
    record_id: str
    question_id: str
    student_id: str
    status: AttrStatus = AttrStatus.PENDING
    knowledge_weights: Dict[str, float] = field(default_factory=dict)
    primary_cause: Optional[str] = None
    confidence: float = 0.0
    influences: List[Influence] = field(default_factory=list)
    suspend_reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    revision_count: int = 0

    def touch(self) -> None:
        self.updated_at = datetime.now()


@dataclass
class AuditEntry:
    audit_id: str
    record_id: str
    operator: str
    old_status: Optional[AttrStatus]
    new_status: AttrStatus
    old_primary_cause: Optional[str]
    new_primary_cause: Optional[str]
    source_ref: str
    note: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class AttrResult:
    record: AttributionRecord
    applied_sources: List[Tuple[SourceType, str]]
    is_consistent: bool
    chart_aggregable: bool
    csv_rows: List[Dict]
    teacher_hint: str = ""
