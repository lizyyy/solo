from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date as date_type
from typing import Any, Dict, List, Optional, Tuple

from .models import (
    Absence, AuditEntry, ConflictItem, DataSource,
    Performance, Piece, RehearsalReport, SchedulePlan, Section,
)


@dataclass
class FilterState:
    piece_ids: Optional[List[str]] = None
    section_ids: Optional[List[str]] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    source_filter: Optional[DataSource] = None

    def matches(self, obj: Any) -> bool:
        if self.source_filter is not None:
            obj_source = getattr(obj, "source", None)
            if obj_source is not None and obj_source != self.source_filter:
                return False
        if self.date_from is not None:
            obj_date = getattr(obj, "date", None)
            if obj_date is not None and obj_date < self.date_from:
                return False
        if self.date_to is not None:
            obj_date = getattr(obj, "date", None)
            if obj_date is not None and obj_date > self.date_to:
                return False
        if self.piece_ids is not None:
            obj_piece = getattr(obj, "piece_id", None)
            if obj_piece is not None and obj_piece not in self.piece_ids:
                return False
        if self.section_ids is not None:
            obj_section = getattr(obj, "section_id", None)
            if obj_section is not None and obj_section not in self.section_ids:
                return False
        return True


@dataclass
class AppState:
    pieces: Dict[str, Piece] = field(default_factory=dict)
    sections: Dict[str, Section] = field(default_factory=dict)
    absences: Dict[str, Absence] = field(default_factory=dict)
    performances: Dict[str, Performance] = field(default_factory=dict)
    reports: Dict[str, RehearsalReport] = field(default_factory=dict)
    schedules: List[SchedulePlan] = field(default_factory=list)
    conflicts: List[ConflictItem] = field(default_factory=list)
    audit_log: List[AuditEntry] = field(default_factory=list)
    current_filter: FilterState = field(default_factory=FilterState)

    def filtered_pieces(self) -> Dict[str, Piece]:
        if self.current_filter.piece_ids is None and self.current_filter.source_filter is None:
            return dict(self.pieces)
        return {
            k: v for k, v in self.pieces.items()
            if self.current_filter.matches(v)
        }

    def filtered_absences(self) -> Dict[str, Absence]:
        return {k: v for k, v in self.absences.items() if self.current_filter.matches(v)}

    def filtered_performances(self) -> Dict[str, Performance]:
        return {k: v for k, v in self.performances.items() if self.current_filter.matches(v)}

    def filtered_reports(self) -> Dict[str, RehearsalReport]:
        return {k: v for k, v in self.reports.items() if self.current_filter.matches(v)}

    def current_schedule(self) -> Optional[SchedulePlan]:
        if self.schedules:
            return self.schedules[-1]
        return None

    def snapshot_pieces(self) -> Dict[str, Any]:
        return {k: v.to_dict() for k, v in self.pieces.items()}

    def snapshot_absences(self) -> Dict[str, Any]:
        return {k: v.to_dict() for k, v in self.absences.items()}

    def snapshot_schedule(self) -> Optional[Dict[str, Any]]:
        s = self.current_schedule()
        return s.to_dict() if s else None

    def clear_filter(self):
        self.current_filter = FilterState()
