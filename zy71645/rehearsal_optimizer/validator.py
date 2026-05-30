from __future__ import annotations

from datetime import date as date_type
from typing import Dict, List, Tuple

from .models import Absence, ConflictItem, ConflictSeverity, ConflictType, Piece
from .state import AppState


class DataValidator:
    def __init__(self, state: AppState):
        self.state = state

    def find_duplicate_absences(self) -> List[ConflictItem]:
        absences = self.state.filtered_absences()
        seen: Dict[Tuple[str, str, str], List[str]] = {}
        for aid, a in absences.items():
            key = (a.person_name, a.section_id, a.date)
            seen.setdefault(key, []).append(aid)

        conflicts = []
        for key, ids in seen.items():
            if len(ids) > 1:
                person, section, dt = key
                section_name = self._section_name(section)
                conflicts.append(ConflictItem(
                    conflict_type=ConflictType.ABSENCE_DUPLICATE,
                    severity=ConflictSeverity.WARNING,
                    title=f"缺勤重复：{person} 在 {section_name} 于 {dt} 有 {len(ids)} 条记录",
                    details={
                        "person_name": person,
                        "section_id": section,
                        "section_name": section_name,
                        "date": dt,
                        "duplicate_count": len(ids),
                        "absence_ids": ids,
                        "sources": [absences[aid].source.value for aid in ids],
                    },
                    affected_ids=ids,
                ))
        return conflicts

    def find_difficulty_inversions(self) -> List[ConflictItem]:
        pieces = self.state.filtered_pieces()
        inversions = []
        for pid, piece in pieces.items():
            if piece.difficulty_weight < 0:
                inversions.append(ConflictItem(
                    conflict_type=ConflictType.DIFFICULTY_INVERSION,
                    severity=ConflictSeverity.ERROR,
                    title=f"难度权重为负：{piece.name}（权重={piece.difficulty_weight}）",
                    details={
                        "piece_id": pid,
                        "piece_name": piece.name,
                        "difficulty_score": piece.difficulty_score,
                        "difficulty_weight": piece.difficulty_weight,
                        "source": piece.source.value,
                        "problem": "difficulty_weight 为负数，会导致高难度曲目优先级反而降低",
                    },
                    affected_ids=[pid],
                ))
            elif piece.difficulty_weight == 0 and piece.difficulty_score > 5:
                inversions.append(ConflictItem(
                    conflict_type=ConflictType.DIFFICULTY_INVERSION,
                    severity=ConflictSeverity.WARNING,
                    title=f"难度权重为零但评分偏高：{piece.name}（评分={piece.difficulty_score}, 权重=0）",
                    details={
                        "piece_id": pid,
                        "piece_name": piece.name,
                        "difficulty_score": piece.difficulty_score,
                        "difficulty_weight": piece.difficulty_weight,
                        "source": piece.source.value,
                        "problem": "difficulty_weight 为零，该曲目的难度评分将被完全忽略",
                    },
                    affected_ids=[pid],
                ))

        sorted_pieces = sorted(pieces.values(), key=lambda p: p.difficulty_score * p.difficulty_weight, reverse=True)
        for i in range(len(sorted_pieces) - 1):
            curr = sorted_pieces[i]
            nxt = sorted_pieces[i + 1]
            if curr.difficulty_score > nxt.difficulty_score and curr.difficulty_weight < nxt.difficulty_weight:
                inversions.append(ConflictItem(
                    conflict_type=ConflictType.DIFFICULTY_INVERSION,
                    severity=ConflictSeverity.WARNING,
                    title=f"难度评分与权重方向相反：{curr.name} vs {nxt.name}",
                    details={
                        "piece_a": {"id": curr.id, "name": curr.name, "score": curr.difficulty_score, "weight": curr.difficulty_weight},
                        "piece_b": {"id": nxt.id, "name": nxt.name, "score": nxt.difficulty_score, "weight": nxt.difficulty_weight},
                        "problem": "评分更高的曲目权重反而更低，可能导致排练优先级反转",
                    },
                    affected_ids=[curr.id, nxt.id],
                ))
        return inversions

    def find_time_overruns(self, total_available_minutes: float) -> List[ConflictItem]:
        pieces = self.state.filtered_pieces()
        total_needed = sum(p.duration_minutes for p in pieces.values())
        overruns = []

        if total_needed > total_available_minutes:
            overruns.append(ConflictItem(
                conflict_type=ConflictType.TIME_OVERRUN,
                severity=ConflictSeverity.ERROR,
                title=f"排练时间超排：需要 {total_needed:.0f} 分钟，可用 {total_available_minutes:.0f} 分钟（超出 {total_needed - total_available_minutes:.0f} 分钟）",
                details={
                    "total_needed_minutes": total_needed,
                    "total_available_minutes": total_available_minutes,
                    "overrun_minutes": total_needed - total_available_minutes,
                    "piece_count": len(pieces),
                },
                affected_ids=list(pieces.keys()),
            ))

        schedule = self.state.current_schedule()
        if schedule and schedule.total_allocated_minutes > total_available_minutes:
            overruns.append(ConflictItem(
                conflict_type=ConflictType.TIME_OVERRUN,
                severity=ConflictSeverity.ERROR,
                title=f"当前排练方案超排：已分配 {schedule.total_allocated_minutes:.0f} 分钟，可用 {total_available_minutes:.0f} 分钟",
                details={
                    "schedule_id": schedule.id,
                    "allocated_minutes": schedule.total_allocated_minutes,
                    "available_minutes": total_available_minutes,
                    "overrun_minutes": schedule.total_allocated_minutes - total_available_minutes,
                    "excluded_count": len(schedule.excluded_piece_ids),
                },
                affected_ids=[schedule.id],
            ))

        for pid, piece in pieces.items():
            if piece.difficulty_weight <= 0:
                continue
            effective_minutes = piece.duration_minutes * piece.difficulty_weight
            if effective_minutes > piece.duration_minutes * 1.5:
                overruns.append(ConflictItem(
                    conflict_type=ConflictType.TIME_OVERRUN,
                    severity=ConflictSeverity.WARNING,
                    title=f"单一曲目加权时长过大：{piece.name}（原始 {piece.duration_minutes:.0f} 分钟 × 权重 {piece.difficulty_weight} = {effective_minutes:.0f} 分钟）",
                    details={
                        "piece_id": pid,
                        "piece_name": piece.name,
                        "base_minutes": piece.duration_minutes,
                        "weight": piece.difficulty_weight,
                        "weighted_minutes": effective_minutes,
                    },
                    affected_ids=[pid],
                ))

        return overruns

    def _section_name(self, section_id: str) -> str:
        sec = self.state.sections.get(section_id)
        return sec.name if sec else section_id
