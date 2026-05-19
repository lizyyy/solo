from dataclasses import dataclass, field
from typing import List, Dict, Set, Tuple
from collections import defaultdict
from .parser import JobResult, MatrixConfig, FailureInfo


@dataclass
class MatrixRunHistory:
    matrix: MatrixConfig
    total_runs: int = 0
    success_count: int = 0
    failure_count: int = 0
    cancelled_count: int = 0
    attempts: List[JobResult] = field(default_factory=list)
    failure_patterns: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    affected_steps: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    
    @property
    def success_rate(self) -> float:
        if self.total_runs == 0:
            return 0.0
        return self.success_count / self.total_runs
    
    @property
    def failure_rate(self) -> float:
        if self.total_runs == 0:
            return 0.0
        return self.failure_count / self.total_runs


class MatrixAggregator:
    def __init__(self):
        self.matrix_histories: Dict[str, MatrixRunHistory] = {}
        self.all_params: Set[str] = set()
    
    def aggregate(self, job_results: List[JobResult]) -> Dict[str, MatrixRunHistory]:
        for result in job_results:
            matrix_key = result.matrix.key()
            self.all_params.update(result.matrix.parameters.keys())
            
            if matrix_key not in self.matrix_histories:
                self.matrix_histories[matrix_key] = MatrixRunHistory(matrix=result.matrix)
            
            history = self.matrix_histories[matrix_key]
            history.total_runs += 1
            history.attempts.append(result)
            
            if result.status == "success":
                history.success_count += 1
            elif result.status == "failure":
                history.failure_count += 1
                if result.failure:
                    error_sig = self._get_error_signature(result.failure)
                    history.failure_patterns[error_sig] += 1
                    if result.failure.step_name:
                        history.affected_steps[result.failure.step_name] += 1
            elif result.status == "cancelled":
                history.cancelled_count += 1
        
        return self.matrix_histories
    
    def _get_error_signature(self, failure: FailureInfo) -> str:
        msg = failure.error_message
        sig = msg[:200]
        sig = ''.join(c if c.isalnum() or c.isspace() else ' ' for c in sig)
        return ' '.join(sig.split())
    
    def get_sorted_by_stability(self, descending: bool = False) -> List[Tuple[str, MatrixRunHistory]]:
        items = list(self.matrix_histories.items())
        items.sort(key=lambda x: (x[1].success_rate, -x[1].total_runs, x[0]), reverse=not descending)
        return items
