from dataclasses import dataclass, field
from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict
from .parser import JobResult, MatrixConfig
from .aggregator import MatrixRunHistory
from .scoring import ShakeScore


@dataclass
class ComparisonItem:
    matrix_key: str
    run_id_a: str
    status_a: str
    run_id_b: str
    status_b: str
    changed: bool
    change_type: str  # "improved", "regressed", "flaky", "unchanged"


@dataclass
class RunComparison:
    run_a: str
    run_b: str
    total_jobs: int
    unchanged: int
    improved: int
    regressed: int
    flaky_count: int
    changes: List[ComparisonItem] = field(default_factory=list)
    
    @property
    def flakiness_rate(self) -> float:
        if self.total_jobs == 0:
            return 0.0
        return self.flaky_count / self.total_jobs


class RerunComparer:
    def compare_runs(self, job_results: List[JobResult]) -> List[RunComparison]:
        run_groups = self._group_by_run(job_results)
        run_ids = sorted(run_groups.keys())
        
        comparisons = []
        for i in range(len(run_ids) - 1):
            run_a = run_ids[i]
            run_b = run_ids[i + 1]
            comparison = self._compare_two_runs(run_a, run_b, run_groups[run_a], run_groups[run_b])
            comparisons.append(comparison)
        
        return comparisons
    
    def _group_by_run(self, job_results: List[JobResult]) -> Dict[str, Dict[str, JobResult]]:
        run_groups: Dict[str, Dict[str, JobResult]] = defaultdict(dict)
        for result in job_results:
            matrix_key = result.matrix.key()
            run_groups[result.run_id][matrix_key] = result
        return run_groups
    
    def _compare_two_runs(self, run_a: str, run_b: str, jobs_a: Dict[str, JobResult], 
                          jobs_b: Dict[str, JobResult]) -> RunComparison:
        all_keys = set(jobs_a.keys()) | set(jobs_b.keys())
        
        unchanged = 0
        improved = 0
        regressed = 0
        flaky_count = 0
        changes = []
        
        for key in sorted(all_keys):
            job_a = jobs_a.get(key)
            job_b = jobs_b.get(key)
            
            status_a = job_a.status if job_a else "missing"
            status_b = job_b.status if job_b else "missing"
            
            changed = status_a != status_b
            change_type = self._get_change_type(status_a, status_b)
            
            if not changed:
                unchanged += 1
            elif change_type == "improved":
                improved += 1
                flaky_count += 1
            elif change_type == "regressed":
                regressed += 1
                flaky_count += 1
            
            changes.append(ComparisonItem(
                matrix_key=key,
                run_id_a=run_a,
                status_a=status_a,
                run_id_b=run_b,
                status_b=status_b,
                changed=changed,
                change_type=change_type
            ))
        
        return RunComparison(
            run_a=run_a,
            run_b=run_b,
            total_jobs=len(all_keys),
            unchanged=unchanged,
            improved=improved,
            regressed=regressed,
            flaky_count=flaky_count,
            changes=changes
        )
    
    def _get_change_type(self, status_a: str, status_b: str) -> str:
        if status_a == status_b:
            return "unchanged"
        
        success_states = {"success"}
        failure_states = {"failure", "cancelled"}
        
        if status_a in failure_states and status_b in success_states:
            return "improved"
        if status_a in success_states and status_b in failure_states:
            return "regressed"
        return "flaky"
