from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    Absence, DataSource, Performance, Piece, RehearsalReport, Section,
)
from .state import AppState


class DataLoader:
    def __init__(self, state: AppState):
        self.state = state

    def load_pieces_csv(self, path: str, source: DataSource = DataSource.SYSTEM) -> int:
        rows = self._read_csv(path)
        count = 0
        for row in rows:
            piece = Piece(
                id=row.get("id", ""),
                name=row.get("name", ""),
                composer=row.get("composer", ""),
                duration_minutes=float(row.get("duration_minutes", 0)),
                difficulty_score=float(row.get("difficulty_score", 5)),
                difficulty_weight=float(row.get("difficulty_weight", 1.0)),
                required_sections=row.get("required_sections", "").split(",") if row.get("required_sections") else [],
                source=source,
            )
            if not piece.id:
                continue
            self.state.pieces[piece.id] = piece
            count += 1
        return count

    def load_pieces_json(self, path: str, source: DataSource = DataSource.SYSTEM) -> int:
        data = self._read_json(path)
        if not isinstance(data, list):
            data = [data]
        count = 0
        for item in data:
            item_with_source = dict(item)
            item_with_source["source"] = source.value
            piece = Piece.from_dict(item_with_source)
            if not piece.id:
                continue
            self.state.pieces[piece.id] = piece
            count += 1
        return count

    def load_sections_json(self, path: str) -> int:
        data = self._read_json(path)
        if not isinstance(data, list):
            data = [data]
        count = 0
        for item in data:
            section = Section.from_dict(item)
            if not section.id:
                continue
            self.state.sections[section.id] = section
            count += 1
        return count

    def load_absences_csv(self, path: str, source: DataSource = DataSource.SYSTEM) -> int:
        rows = self._read_csv(path)
        count = 0
        for row in rows:
            absence = Absence(
                id=row.get("id", ""),
                person_name=row.get("person_name", ""),
                section_id=row.get("section_id", ""),
                date=row.get("date", ""),
                reason=row.get("reason", ""),
                source=source,
            )
            if not absence.id:
                continue
            self.state.absences[absence.id] = absence
            count += 1
        return count

    def load_absences_json(self, path: str, source: DataSource = DataSource.SYSTEM) -> int:
        data = self._read_json(path)
        if not isinstance(data, list):
            data = [data]
        count = 0
        for item in data:
            item_with_source = dict(item)
            item_with_source["source"] = source.value
            absence = Absence.from_dict(item_with_source)
            if not absence.id:
                continue
            self.state.absences[absence.id] = absence
            count += 1
        return count

    def load_performances_json(self, path: str, source: DataSource = DataSource.SYSTEM) -> int:
        data = self._read_json(path)
        if not isinstance(data, list):
            data = [data]
        count = 0
        for item in data:
            item_with_source = dict(item)
            item_with_source["source"] = source.value
            perf = Performance.from_dict(item_with_source)
            if not perf.id:
                continue
            self.state.performances[perf.id] = perf
            count += 1
        return count

    def load_reports_json(self, path: str, source: DataSource = DataSource.SYSTEM) -> int:
        data = self._read_json(path)
        if not isinstance(data, list):
            data = [data]
        count = 0
        for item in data:
            item_with_source = dict(item)
            item_with_source["source"] = source.value
            report = RehearsalReport.from_dict(item_with_source)
            if not report.id:
                continue
            self.state.reports[report.id] = report
            count += 1
        return count

    def add_piece_manual(
        self, name: str, composer: str = "", duration_minutes: float = 0,
        difficulty_score: float = 5.0, difficulty_weight: float = 1.0,
        required_sections: Optional[List[str]] = None,
    ) -> Piece:
        piece = Piece(
            name=name,
            composer=composer,
            duration_minutes=duration_minutes,
            difficulty_score=difficulty_score,
            difficulty_weight=difficulty_weight,
            required_sections=required_sections or [],
            source=DataSource.MANUAL,
        )
        self.state.pieces[piece.id] = piece
        return piece

    def add_absence_manual(
        self, person_name: str, section_id: str, date: str, reason: str = "",
    ) -> Absence:
        absence = Absence(
            person_name=person_name,
            section_id=section_id,
            date=date,
            reason=reason,
            source=DataSource.MANUAL,
        )
        self.state.absences[absence.id] = absence
        return absence

    def add_performance_manual(self, piece_id: str, date: str, venue: str = "") -> Performance:
        perf = Performance(
            piece_id=piece_id,
            date=date,
            venue=venue,
            source=DataSource.MANUAL,
        )
        self.state.performances[perf.id] = perf
        return perf

    def add_report_manual(
        self, date: str, piece_id: str, duration_actual: float, notes: str = "",
    ) -> RehearsalReport:
        report = RehearsalReport(
            date=date,
            piece_id=piece_id,
            duration_actual=duration_actual,
            notes=notes,
            source=DataSource.MANUAL,
        )
        self.state.reports[report.id] = report
        return report

    def _read_csv(self, path: str) -> List[Dict[str, str]]:
        p = Path(path)
        if not p.exists():
            return []
        with open(p, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return list(reader)

    def _read_json(self, path: str) -> Any:
        p = Path(path)
        if not p.exists():
            return []
        with open(p, encoding="utf-8") as f:
            return json.load(f)
