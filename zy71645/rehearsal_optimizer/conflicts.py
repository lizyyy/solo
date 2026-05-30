from __future__ import annotations

from typing import Dict, List

from .models import (
    ConflictItem, ConflictSeverity, ConflictType,
)
from .state import AppState
from .validator import DataValidator


class ConflictDetector:
    def __init__(self, state: AppState):
        self.state = state
        self.validator = DataValidator(state)

    def detect_all(self, total_available_minutes: float = 0) -> Dict[str, List[ConflictItem]]:
        absence_dups = self.validator.find_duplicate_absences()
        diff_inversions = self.validator.find_difficulty_inversions()
        time_overruns = self.validator.find_time_overruns(total_available_minutes) if total_available_minutes > 0 else []
        return {
            "absence_duplicate": absence_dups,
            "difficulty_inversion": diff_inversions,
            "time_overrun": time_overruns,
        }

    def detect_by_type(self, conflict_type: str, total_available_minutes: float = 0) -> List[ConflictItem]:
        all_conflicts = self.detect_all(total_available_minutes)
        return all_conflicts.get(conflict_type, [])

    def summary(self, total_available_minutes: float = 0) -> Dict[str, Dict[str, int]]:
        all_conflicts = self.detect_all(total_available_minutes)
        result = {}
        for ctype, items in all_conflicts.items():
            warnings = sum(1 for c in items if c.severity == ConflictSeverity.WARNING)
            errors = sum(1 for c in items if c.severity == ConflictSeverity.ERROR)
            result[ctype] = {"total": len(items), "warnings": warnings, "errors": errors}
        return result

    def refresh_state(self, total_available_minutes: float = 0) -> List[ConflictItem]:
        all_conflicts = self.detect_all(total_available_minutes)
        flat = []
        for items in all_conflicts.values():
            flat.extend(items)
        self.state.conflicts = flat
        return flat
