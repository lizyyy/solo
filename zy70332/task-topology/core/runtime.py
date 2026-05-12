import yaml
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Set, Optional, Tuple
from collections import deque

import sys
from pathlib import Path
CORE_DIR = Path(__file__).resolve().parent
ROOT_DIR = CORE_DIR.parent
sys.path.insert(0, str(ROOT_DIR))

from core.models import (
    TaskDefinition, RunStatus, FailureRecord, SkipRecord,
    TaskStatus, SkipType, ImpactAnalysis, RerunPlan
)
from core.dependency_graph import DependencyGraph
from core.parser import load_task_definitions
from storage.json_store import JsonStore


class RuntimeManager:
    def __init__(self, graph: DependencyGraph, store: JsonStore = None):
        self.graph = graph
        self.store = store or JsonStore()
        self._tasks = graph.tasks
    
    def import_statuses(self, run_date: str, data: dict) -> Tuple[int, int, str]:
        status_records = data.get('statuses', [])
        import_hash = self._compute_import_hash(status_records)
        
        if self.store.has_imported(run_date, import_hash):
            return 0, 0, import_hash
        
        existing_statuses = self.store.load_statuses(run_date)
        existing_failures = self.store.load_failures(run_date)
        existing_skips = self.store.load_skips(run_date)
        
        new_statuses = dict(existing_statuses)
        new_failures = dict(existing_failures)
        added_statuses = 0
        added_failures = 0
        
        for record in status_records:
            task_id = record['task_id']
            status_value = record.get('status', 'pending')
            reason = record.get('reason', '')
            start_time = datetime.fromisoformat(record['start_time']) if record.get('start_time') else None
            end_time = datetime.fromisoformat(record['end_time']) if record.get('end_time') else None
            
            if task_id in existing_skips:
                continue
            
            if task_id not in existing_statuses or \
               existing_statuses[task_id].status.value != status_value:
                new_statuses[task_id] = RunStatus(
                    task_id=task_id,
                    run_date=run_date,
                    status=TaskStatus(status_value),
                    start_time=start_time,
                    end_time=end_time,
                    reason=reason,
                    import_hash=import_hash
                )
                added_statuses += 1
            
            if status_value == 'failed' and task_id not in existing_failures:
                new_failures[task_id] = FailureRecord(
                    task_id=task_id,
                    run_date=run_date,
                    failure_time=end_time or datetime.now(),
                    reason=reason,
                    import_hash=import_hash
                )
                added_failures += 1
        
        self.store.save_statuses(run_date, new_statuses, import_hash)
        self.store.save_failures(run_date, new_failures, import_hash)
        self.store.record_import(run_date, import_hash, f"Imported {len(status_records)} statuses")
        
        return added_statuses, added_failures, import_hash
    
    def _compute_import_hash(self, records: List[Dict]) -> str:
        if not records:
            return hashlib.md5(b"empty").hexdigest()
        sorted_records = sorted(records, key=lambda x: x.get('task_id', ''))
        combined = json.dumps(sorted_records, sort_keys=True, default=str)
        return hashlib.md5(combined.encode()).hexdigest()
    
    def load_statuses(self, run_date: str) -> Dict[str, RunStatus]:
        return self.store.load_statuses(run_date)
    
    def load_failures(self, run_date: str) -> Dict[str, FailureRecord]:
        return self.store.load_failures(run_date)
    
    def load_skips(self, run_date: str) -> Dict[str, SkipRecord]:
        return self.store.load_skips(run_date)
    
    def analyze_impact(self, run_date: str, source_task_id: str = None) -> ImpactAnalysis:
        failures = self.load_failures(run_date)
        statuses = self.load_statuses(run_date)
        skips = self.load_skips(run_date)
        
        failed_task_ids = list(failures.keys())
        if source_task_id and source_task_id in failed_task_ids:
            source_ids = [source_task_id]
        else:
            source_ids = failed_task_ids
        
        if not source_ids:
            return ImpactAnalysis()
        
        all_downstream = set()
        for sid in source_ids:
            all_downstream.update(self.graph.get_downstream(sid))
        
        blocked = set()
        safe = set()
        
        for ds in all_downstream:
            if ds in skips:
                continue
            
            status = statuses.get(ds)
            upstream_failures = []
            for upstream in self.graph.get_upstream(ds):
                if upstream in failures:
                    upstream_failures.append(upstream)
            
            if upstream_failures:
                blocked.add(ds)
            elif status and status.status != TaskStatus.SUCCESS:
                safe.add(ds)
        
        safe_to_rerun = list()
        for task_id in self._tasks:
            if task_id in failed_task_ids:
                continue
            if task_id in skips:
                continue
            status = statuses.get(task_id)
            has_failed_upstream = any(u in failures for u in self.graph.get_upstream(task_id))
            if not has_failed_upstream and status and status.status != TaskStatus.SUCCESS:
                safe_to_rerun.append(task_id)
        
        return ImpactAnalysis(
            failed_tasks=sorted(source_ids),
            affected_downstream=sorted(list(all_downstream)),
            blocked_tasks=sorted(list(blocked)),
            safe_to_rerun=sorted(safe_to_rerun)
        )
    
    def compute_rerun_plan(self, run_date: str) -> List[RerunPlan]:
        failures = self.load_failures(run_date)
        statuses = self.load_statuses(run_date)
        skips = self.load_skips(run_date)
        
        plan = []
        sorted_tasks = self.graph.analyze_graph().topological_order
        
        for task_id in sorted_tasks:
            if task_id not in self._tasks:
                continue
            
            upstream = self.graph.get_upstream(task_id)
            has_failed_upstream = any(u in failures for u in upstream)
            deps = self.graph.get_direct_dependencies(task_id)
            failed_deps = [d for d in deps if d in failures]
            
            is_skipped = task_id in skips
            skip_record = skips.get(task_id)
            
            if is_skipped:
                technical_safe = False
                business_recommended = False
                action = "SKIPPED"
                reason = skip_record.reason if skip_record else ""
            elif task_id in failures:
                technical_safe = not has_failed_upstream
                business_recommended = True
                action = "RERUN" if technical_safe else "BLOCKED"
                reason = ""
            elif has_failed_upstream:
                technical_safe = False
                business_recommended = False
                action = "BLOCKED"
                reason = ""
            else:
                status = statuses.get(task_id)
                if status and status.status == TaskStatus.SUCCESS:
                    technical_safe = True
                    business_recommended = False
                    action = "SKIP"
                else:
                    technical_safe = True
                    business_recommended = self._is_business_recommended(task_id, status)
                    action = "RERUN" if business_recommended else "SKIP"
                reason = ""
            
            plan.append(RerunPlan(
                task_id=task_id,
                technical_safe=technical_safe,
                business_recommended=business_recommended,
                suggested_action=action,
                blocked_by=failed_deps,
                depends_on=deps,
                skip_reason=reason
            ))
        
        return plan
    
    def _is_business_recommended(self, task_id: str, status: Optional[RunStatus]) -> bool:
        if not status:
            return True
        if status.status == TaskStatus.FAILED:
            return True
        if status.status == TaskStatus.PENDING:
            return True
        if status.status == TaskStatus.BLOCKED:
            return True
        task = self._tasks.get(task_id)
        if task and task.category in ['report', 'user_profile']:
            if status.status != TaskStatus.SUCCESS:
                return True
        return False
    
    def mark_fixed(self, run_date: str, task_id: str) -> bool:
        failures = self.load_failures(run_date)
        if task_id not in failures:
            return False
        self.store.mark_task_fixed(run_date, task_id)
        return True
    
    def add_skip(self, run_date: str, task_id: str, reason: str) -> SkipRecord:
        if not reason or not reason.strip():
            raise ValueError("Skip reason is required")
        return self.store.add_skip(run_date, task_id, reason.strip())
    
    def update_statuses_on_fix(self, run_date: str, fixed_task_id: str):
        statuses = self.load_statuses(run_date)
        failures = self.load_failures(run_date)
        downstream = self.graph.get_downstream(fixed_task_id)
        
        for ds in downstream:
            upstream = self.graph.get_upstream(ds)
            if any(u in failures for u in upstream):
                continue
            
            if ds in statuses and statuses[ds].status == TaskStatus.BLOCKED:
                statuses[ds].status = TaskStatus.PENDING
                statuses[ds].reason = f"Upstream {fixed_task_id} fixed, ready to run"
        
        self.store.save_statuses(run_date, statuses)
