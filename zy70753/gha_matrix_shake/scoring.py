from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
import math
from .aggregator import MatrixRunHistory
from .parser import JobResult


@dataclass
class ShakeScore:
    matrix_key: str
    overall_score: float
    stability_score: float
    consistency_score: float
    failure_pattern_score: float
    total_runs: int
    success_count: int
    failure_count: int
    grade: str
    flags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "matrix_key": self.matrix_key,
            "overall_score": round(self.overall_score, 2),
            "stability_score": round(self.stability_score, 2),
            "consistency_score": round(self.consistency_score, 2),
            "failure_pattern_score": round(self.failure_pattern_score, 2),
            "total_runs": self.total_runs,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "grade": self.grade,
            "flags": self.flags,
        }


class ShakeScorer:
    WEIGHT_STABILITY = 0.5
    WEIGHT_CONSISTENCY = 0.3
    WEIGHT_FAILURE_PATTERN = 0.2
    
    GRADE_THRESHOLDS = [
        (90, "S"),
        (80, "A"),
        (70, "B"),
        (60, "C"),
        (50, "D"),
        (0, "F"),
    ]
    
    def calculate_scores(self, histories: Dict[str, MatrixRunHistory]) -> List[ShakeScore]:
        scores = []
        for matrix_key, history in histories.items():
            score = self._calculate_single(matrix_key, history)
            scores.append(score)
        
        scores.sort(key=lambda s: (-s.overall_score, s.matrix_key))
        return scores
    
    def _calculate_single(self, matrix_key: str, history: MatrixRunHistory) -> ShakeScore:
        flags = []
        
        stability_score = self._calc_stability_score(history, flags)
        consistency_score = self._calc_consistency_score(history, flags)
        failure_pattern_score = self._calc_failure_pattern_score(history, flags)
        
        overall_score = (
            stability_score * self.WEIGHT_STABILITY +
            consistency_score * self.WEIGHT_CONSISTENCY +
            failure_pattern_score * self.WEIGHT_FAILURE_PATTERN
        )
        
        grade = self._get_grade(overall_score)
        
        return ShakeScore(
            matrix_key=matrix_key,
            overall_score=overall_score,
            stability_score=stability_score,
            consistency_score=consistency_score,
            failure_pattern_score=failure_pattern_score,
            total_runs=history.total_runs,
            success_count=history.success_count,
            failure_count=history.failure_count,
            grade=grade,
            flags=flags
        )
    
    def _calc_stability_score(self, history: MatrixRunHistory, flags: List[str]) -> float:
        if history.total_runs < 2:
            flags.append("样本不足(<2次)")
            return 50.0
        
        base_score = history.success_rate * 100
        
        if history.total_runs < 5:
            flags.append("样本较少(<5次)")
            base_score *= 0.9
        
        if history.success_rate == 1.0:
            base_score = 100.0
        elif history.success_rate >= 0.9:
            base_score = 90 + (history.success_rate - 0.9) * 100
        elif history.success_rate >= 0.7:
            base_score = 70 + (history.success_rate - 0.7) * 100
        
        return base_score
    
    def _calc_consistency_score(self, history: MatrixRunHistory, flags: List[str]) -> float:
        if history.total_runs < 3:
            return 70.0
        
        sorted_attempts = sorted(history.attempts, key=lambda a: a.attempt)
        transitions = 0
        prev_status = None
        
        for attempt in sorted_attempts:
            if prev_status is not None and prev_status != attempt.status:
                transitions += 1
            prev_status = attempt.status
        
        max_transitions = history.total_runs - 1
        if max_transitions == 0:
            return 100.0
        
        transition_rate = transitions / max_transitions
        score = 100 * (1 - transition_rate * 0.8)
        
        if transition_rate > 0.5:
            flags.append(f"状态频繁切换({transitions}/{max_transitions})")
        
        return score
    
    def _calc_failure_pattern_score(self, history: MatrixRunHistory, flags: List[str]) -> float:
        if history.failure_count == 0:
            return 100.0
        
        unique_patterns = len(history.failure_patterns)
        total_failures = history.failure_count
        
        if unique_patterns == 0:
            return 80.0
        
        pattern_diversity = unique_patterns / min(total_failures, 5)
        
        if pattern_diversity > 0.6:
            flags.append(f"失败模式多样({unique_patterns}种)")
            score = 40.0
        elif pattern_diversity > 0.3:
            score = 60.0
        else:
            score = 80.0
        
        step_count = len(history.affected_steps)
        if step_count > 2:
            flags.append(f"影响多个步骤({step_count}个)")
            score *= 0.8
        
        return score
    
    def _get_grade(self, score: float) -> str:
        for threshold, grade in self.GRADE_THRESHOLDS:
            if score >= threshold:
                return grade
        return "F"
