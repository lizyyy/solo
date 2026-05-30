from __future__ import annotations

from collections import defaultdict
from datetime import date as date_type, datetime
from typing import Dict, List, Optional, Tuple

from .models import ScheduleEntry, SchedulePlan
from .state import AppState


class ScheduleOptimizer:
    DIFFICULTY_WEIGHT = 0.4
    ABSENCE_WEIGHT = 0.35
    URGENCY_WEIGHT = 0.25
    DEFAULT_URGENCY_DAYS = 90

    def __init__(self, state: AppState):
        self.state = state

    def optimize(
        self,
        total_available_minutes: float,
        reference_date: Optional[str] = None,
        difficulty_weight: float = 0.4,
        absence_weight: float = 0.35,
        urgency_weight: float = 0.25,
    ) -> SchedulePlan:
        self.DIFFICULTY_WEIGHT = difficulty_weight
        self.ABSENCE_WEIGHT = absence_weight
        self.URGENCY_WEIGHT = urgency_weight

        pieces = self.state.filtered_pieces()
        absences = self.state.filtered_absences()
        performances = self.state.filtered_performances()

        ref_date = self._parse_date(reference_date) if reference_date else date_type.today()

        absence_by_section: Dict[str, int] = defaultdict(int)
        absence_by_piece: Dict[str, float] = defaultdict(float)
        for a in absences.values():
            absence_by_section[a.section_id] += 1

        for pid, piece in pieces.items():
            for sec_id in piece.required_sections:
                if sec_id in absence_by_section:
                    section = self.state.sections.get(sec_id)
                    member_count = len(section.members) if section else 1
                    impact = min(absence_by_section[sec_id] / max(member_count, 1), 1.0)
                    absence_by_piece[pid] += impact

        nearest_perf: Dict[str, Tuple[str, int]] = {}
        for perf in performances.values():
            perf_date = self._parse_date(perf.date)
            days = (perf_date - ref_date).days
            if days < 0:
                continue
            if perf.piece_id not in nearest_perf or days < nearest_perf[perf.piece_id][1]:
                nearest_perf[perf.piece_id] = (perf.date, days)

        scored: List[Tuple[str, float, float, float, float]] = []
        for pid, piece in pieces.items():
            diff_factor = (piece.difficulty_score / 10.0) * piece.difficulty_weight

            abs_impact = absence_by_piece.get(pid, 0.0)

            days_until = nearest_perf.get(pid, ("", self.DEFAULT_URGENCY_DAYS))[1]
            urgency = 1.0 / (1.0 + days_until / 7.0) if days_until >= 0 else 0.0

            priority = (
                self.DIFFICULTY_WEIGHT * diff_factor
                + self.ABSENCE_WEIGHT * abs_impact
                + self.URGENCY_WEIGHT * urgency
            )
            scored.append((pid, priority, urgency, abs_impact, diff_factor))

        scored.sort(key=lambda x: x[1], reverse=True)

        entries: List[ScheduleEntry] = []
        allocated = 0.0
        excluded: List[str] = []

        for pid, priority, urgency, abs_impact, diff_factor in scored:
            piece = pieces[pid]
            needed = piece.duration_minutes
            if allocated + needed <= total_available_minutes:
                entries.append(ScheduleEntry(
                    piece_id=pid,
                    piece_name=piece.name,
                    order=len(entries) + 1,
                    allocated_minutes=needed,
                    priority_score=priority,
                    urgency_factor=urgency,
                    absence_impact=abs_impact,
                    difficulty_factor=diff_factor,
                ))
                allocated += needed
            else:
                excluded.append(pid)

        plan = SchedulePlan(
            created_at=datetime.now().isoformat(),
            total_available_minutes=total_available_minutes,
            total_allocated_minutes=allocated,
            entries=entries,
            excluded_piece_ids=excluded,
        )
        self.state.schedules.append(plan)
        return plan

    def compare_plans(self) -> List[Dict]:
        results = []
        for i, plan in enumerate(self.state.schedules):
            results.append({
                "plan_index": i,
                "plan_id": plan.id,
                "created_at": plan.created_at,
                "total_allocated": plan.total_allocated_minutes,
                "total_available": plan.total_available_minutes,
                "scheduled_count": len(plan.entries),
                "excluded_count": len(plan.excluded_piece_ids),
                "excluded_ids": plan.excluded_piece_ids,
            })
        return results

    def _parse_date(self, date_str: str) -> date_type:
        try:
            return date_type.fromisoformat(date_str)
        except (ValueError, TypeError):
            return date_type.today()
