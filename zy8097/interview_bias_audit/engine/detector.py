"""偏见检测器 - 核心检测逻辑"""

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Optional

import numpy as np


def safe_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        result = float(value)
        return result if result > 0 else default
    except (ValueError, TypeError):
        return default


@dataclass
class BiasFlag:
    flag_type: str
    candidate_id: str
    candidate_name: str
    position: str
    severity: str
    description: str
    details: dict = field(default_factory=dict)


class BiasDetector:
    def __init__(
        self,
        high_threshold: float = 85.0,
        low_threshold: float = 50.0,
    ):
        self.high_threshold = high_threshold
        self.low_threshold = low_threshold
        self.flags: list[BiasFlag] = []

    def detect_scale_drift(
        self,
        candidates: list[dict[str, Any]],
        position: str,
    ) -> list[BiasFlag]:
        position_candidates = [c for c in candidates if c.get("position") == position]
        if len(position_candidates) < 3:
            return []

        scores = [safe_float(c.get("score")) for c in position_candidates]
        scores = [s for s in scores if s > 0]
        if len(scores) < 3:
            return []

        mean_score = np.mean(scores)
        std_score = np.std(scores)

        if std_score > 15:
            return [
                BiasFlag(
                    flag_type="scale_drift",
                    candidate_id="multiple",
                    candidate_name=f"{len(position_candidates)} candidates",
                    position=position,
                    severity="high",
                    description=f"岗位 {position} 评分尺度漂移严重",
                    details={
                        "mean": round(mean_score, 2),
                        "std": round(std_score, 2),
                        "min": min(scores),
                        "max": max(scores),
                        "candidate_count": len(scores),
                    },
                )
            ]
        return []

    def detect_conflict_in_rounds(
        self,
        candidate_notes: list[dict[str, Any]],
    ) -> list[BiasFlag]:
        if len(candidate_notes) < 2:
            return []

        candidate_name = candidate_notes[0].get("candidate_name") or candidate_notes[0].get("name")
        position = candidate_notes[0].get("position", "unknown")
        scores = [safe_float(n.get("score")) for n in candidate_notes]
        scores = [s for s in scores if s > 0]

        flags = []
        if len(scores) >= 2:
            score_diff = max(scores) - min(scores)
            if score_diff >= 20:
                flags.append(
                    BiasFlag(
                        flag_type="round_conflict",
                        candidate_id=candidate_notes[0].get("candidate_id", ""),
                        candidate_name=candidate_name,
                        position=position,
                        severity="high",
                        description="同一候选人不同面试轮次结论冲突",
                        details={
                            "max_diff": score_diff,
                            "scores": scores,
                            "round_count": len(scores),
                        },
                    )
                )
        return flags

    def detect_unevidenced_high_low_score(
        self,
        candidate: dict[str, Any],
        competency_extractor: Any,
    ) -> list[BiasFlag]:
        flags = []
        score = safe_float(candidate.get("score"))

        if score >= self.high_threshold or score <= self.low_threshold:
            notes_text = candidate.get("notes", "") or candidate.get("interview_notes", "")

            if not competency_extractor.has_evidence(notes_text):
                severity = "high" if score >= self.high_threshold else "medium"
                score_label = "高分" if score >= self.high_threshold else "低分"
                flags.append(
                    BiasFlag(
                        flag_type="unevidenced_extreme_score",
                        candidate_id=candidate.get("candidate_id", ""),
                        candidate_name=candidate.get("name", ""),
                        position=candidate.get("position", "unknown"),
                        severity=severity,
                        description=f"{score_label}候选人缺少能力证据",
                        details={
                            "score": score,
                            "has_notes": bool(notes_text.strip()) if notes_text else False,
                        },
                    )
                )
        return flags

    def detect_same_name_different_position(
        self,
        candidates: list[dict[str, Any]],
    ) -> list[BiasFlag]:
        name_position_map: dict[str, list[str]] = defaultdict(list)
        for c in candidates:
            name = c.get("name", "") or c.get("candidate_name", "")
            position = c.get("position", "unknown")
            if name and position:
                name_position_map[name].append(position)

        flags = []
        for name, positions in name_position_map.items():
            unique_positions = list(set(positions))
            if len(unique_positions) > 1:
                flags.append(
                    BiasFlag(
                        flag_type="same_name_different_position",
                        candidate_id="",
                        candidate_name=name,
                        position=f"{len(unique_positions)} positions",
                        severity="medium",
                        description="同名候选人出现在不同岗位",
                        details={
                            "positions": unique_positions,
                            "appearances": len(positions),
                        },
                    )
                )
        return flags

    def detect_empty_notes(
        self,
        candidate: dict[str, Any],
    ) -> list[BiasFlag]:
        notes_text = candidate.get("notes", "") or candidate.get("interview_notes", "")
        if not notes_text or not notes_text.strip():
            return [
                BiasFlag(
                    flag_type="empty_notes",
                    candidate_id=candidate.get("candidate_id", ""),
                    candidate_name=candidate.get("name", ""),
                    position=candidate.get("position", "unknown"),
                    severity="medium",
                    description="候选人面试备注为空",
                    details={},
                )
            ]
        return []

    def run_detection(
        self,
        candidates: list[dict[str, Any]],
        notes: list[dict[str, Any]],
        competency_extractor: Any,
    ) -> list[BiasFlag]:
        all_flags: list[BiasFlag] = []

        position_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for c in candidates:
            position_groups[c.get("position", "unknown")].append(c)

        for position, pos_candidates in position_groups.items():
            all_flags.extend(self.detect_scale_drift(pos_candidates, position))

        all_flags.extend(self.detect_same_name_different_position(candidates))

        for c in candidates:
            all_flags.extend(self.detect_empty_notes(c))
            all_flags.extend(self.detect_unevidenced_high_low_score(c, competency_extractor))

        notes_by_candidate: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for note in notes:
            key = note.get("candidate_id") or note.get("candidate_name") or note.get("name")
            if key:
                notes_by_candidate[key].append(note)

        for key, candidate_notes in notes_by_candidate.items():
            all_flags.extend(self.detect_conflict_in_rounds(candidate_notes))

        self.flags = all_flags
        return all_flags
