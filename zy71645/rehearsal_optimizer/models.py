from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Any, Dict, List, Optional


class DataSource(str, Enum):
    SYSTEM = "system"
    MANUAL = "manual"


class ConflictType(str, Enum):
    ABSENCE_DUPLICATE = "absence_duplicate"
    DIFFICULTY_INVERSION = "difficulty_inversion"
    TIME_OVERRUN = "time_overrun"


class ConflictSeverity(str, Enum):
    WARNING = "warning"
    ERROR = "error"


@dataclass
class Piece:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str = ""
    composer: str = ""
    duration_minutes: float = 0.0
    difficulty_score: float = 5.0
    difficulty_weight: float = 1.0
    required_sections: List[str] = field(default_factory=list)
    source: DataSource = DataSource.SYSTEM

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "composer": self.composer,
            "duration_minutes": self.duration_minutes,
            "difficulty_score": self.difficulty_score,
            "difficulty_weight": self.difficulty_weight,
            "required_sections": self.required_sections,
            "source": self.source.value,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> Piece:
        d = dict(d)
        d["source"] = DataSource(d.get("source", "system"))
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class Section:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str = ""
    members: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {"id": self.id, "name": self.name, "members": self.members}

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> Section:
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class Absence:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    person_name: str = ""
    section_id: str = ""
    date: str = ""
    reason: str = ""
    source: DataSource = DataSource.SYSTEM

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "person_name": self.person_name,
            "section_id": self.section_id,
            "date": self.date,
            "reason": self.reason,
            "source": self.source.value,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> Absence:
        d = dict(d)
        d["source"] = DataSource(d.get("source", "system"))
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class Performance:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    piece_id: str = ""
    date: str = ""
    venue: str = ""
    source: DataSource = DataSource.SYSTEM

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "piece_id": self.piece_id,
            "date": self.date,
            "venue": self.venue,
            "source": self.source.value,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> Performance:
        d = dict(d)
        d["source"] = DataSource(d.get("source", "system"))
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class RehearsalReport:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    date: str = ""
    piece_id: str = ""
    duration_actual: float = 0.0
    notes: str = ""
    source: DataSource = DataSource.SYSTEM

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "date": self.date,
            "piece_id": self.piece_id,
            "duration_actual": self.duration_actual,
            "notes": self.notes,
            "source": self.source.value,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> RehearsalReport:
        d = dict(d)
        d["source"] = DataSource(d.get("source", "system"))
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class ScheduleEntry:
    piece_id: str = ""
    piece_name: str = ""
    order: int = 0
    allocated_minutes: float = 0.0
    priority_score: float = 0.0
    urgency_factor: float = 0.0
    absence_impact: float = 0.0
    difficulty_factor: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "piece_id": self.piece_id,
            "piece_name": self.piece_name,
            "order": self.order,
            "allocated_minutes": self.allocated_minutes,
            "priority_score": round(self.priority_score, 4),
            "urgency_factor": round(self.urgency_factor, 4),
            "absence_impact": round(self.absence_impact, 4),
            "difficulty_factor": round(self.difficulty_factor, 4),
        }


@dataclass
class SchedulePlan:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    created_at: str = ""
    total_available_minutes: float = 0.0
    total_allocated_minutes: float = 0.0
    entries: List[ScheduleEntry] = field(default_factory=list)
    excluded_piece_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at,
            "total_available_minutes": self.total_available_minutes,
            "total_allocated_minutes": self.total_allocated_minutes,
            "entries": [e.to_dict() for e in self.entries],
            "excluded_piece_ids": self.excluded_piece_ids,
        }


@dataclass
class ConflictItem:
    conflict_type: ConflictType = ConflictType.ABSENCE_DUPLICATE
    severity: ConflictSeverity = ConflictSeverity.WARNING
    title: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    affected_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_type": self.conflict_type.value,
            "severity": self.severity.value,
            "title": self.title,
            "details": self.details,
            "affected_ids": self.affected_ids,
        }


@dataclass
class AuditEntry:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    timestamp: str = ""
    action: str = ""
    description: str = ""
    before_snapshot: Optional[Dict[str, Any]] = None
    after_snapshot: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "action": self.action,
            "description": self.description,
            "before_snapshot": self.before_snapshot,
            "after_snapshot": self.after_snapshot,
        }
