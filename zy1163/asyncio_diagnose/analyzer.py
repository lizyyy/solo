import re
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set, Tuple

from .importer import DataImporter
from .models import (
    AnalysisResult,
    EventLoopTrace,
    TaskInfo,
    TaskState,
    TimeoutRule,
)


class AsyncioAnalyzer:
    def __init__(self, importer: DataImporter):
        self.importer = importer
        self.result = AnalysisResult()

    def analyze_long_pending_tasks(
        self, threshold_seconds: float = 60.0
    ) -> List[TaskInfo]:
        tasks = self.importer.get_all_tasks()
        now = datetime.now(timezone.utc)
        long_pending = []

        for task in tasks:
            if task.state in [TaskState.PENDING, TaskState.RUNNING, TaskState.CANCEL_PENDING]:
                duration = (now - task.created_at).total_seconds()
                if duration > threshold_seconds:
                    long_pending.append(task)

        self.result.long_pending_tasks = long_pending
        return long_pending

    def analyze_task_leaks(self) -> List[TaskInfo]:
        tasks = self.importer.get_all_tasks()
        leaks = []

        for task in tasks:
            if task.state in [TaskState.PENDING, TaskState.RUNNING, TaskState.CANCEL_PENDING]:
                if not task.awaited_by:
                    has_timeout_watchdog = self._has_timeout_watchdog(task)
                    if not has_timeout_watchdog:
                        leaks.append(task)

        self.result.task_leaks = leaks
        return leaks

    def _has_timeout_watchdog(self, task: TaskInfo) -> bool:
        for rule in self.importer.timeout_rules:
            if re.search(rule.task_pattern, task.coro_name):
                return True
            if task.name and re.search(rule.task_pattern, task.name):
                return True
        return False

    def analyze_ineffective_cancellations(self, grace_period_seconds: float = 5.0) -> List[TaskInfo]:
        tasks = self.importer.get_all_tasks()
        ineffective = []
        now = datetime.now(timezone.utc)

        for task in tasks:
            if task.cancel_requested and task.cancel_time:
                if task.state not in [TaskState.CANCELLED, TaskState.DONE]:
                    time_since_cancel = (now - task.cancel_time).total_seconds()
                    if time_since_cancel > grace_period_seconds:
                        ineffective.append(task)

        self.result.ineffective_cancellations = ineffective
        return ineffective

    def analyze_timeout_chains(self) -> List[List[str]]:
        timeout_chains = []
        tasks = self.importer.get_all_tasks()
        task_map = {t.task_id: t for t in tasks}

        for rule in self.importer.timeout_rules:
            for task in tasks:
                if self._matches_pattern(task, rule.task_pattern):
                    chain = self._build_wait_chain(task, task_map)
                    if len(chain) > 1:
                        timeout_chains.append(chain)

        for task in tasks:
            if task.waiting_on and task.waiting_on in task_map:
                chain = self._build_wait_chain(task, task_map)
                if len(chain) > 1 and chain not in timeout_chains:
                    has_timeout = any(
                        self._matches_pattern(task_map.get(t_id, task), r.task_pattern)
                        for r in self.importer.timeout_rules
                        for t_id in chain
                    )
                    if has_timeout:
                        timeout_chains.append(chain)

        self.result.timeout_chains = timeout_chains
        return timeout_chains

    def _matches_pattern(self, task: TaskInfo, pattern: str) -> bool:
        if re.search(pattern, task.coro_name):
            return True
        if task.name and re.search(pattern, task.name):
            return True
        return False

    def _build_wait_chain(self, start_task: TaskInfo, task_map: Dict[str, TaskInfo]) -> List[str]:
        chain = [start_task.task_id]
        visited = set(chain)
        current = start_task

        while current.waiting_on and current.waiting_on in task_map:
            next_task = task_map[current.waiting_on]
            if next_task.task_id in visited:
                break
            chain.append(next_task.task_id)
            visited.add(next_task.task_id)
            current = next_task

        return chain

    def analyze_queue_congestion(self) -> List[Dict]:
        congestion = []
        traces = self.importer.traces

        queue_operations = {}
        for trace in traces:
            if "queue" in trace.event_type.lower():
                queue_name = trace.details.get("queue_name", "default")
                if queue_name not in queue_operations:
                    queue_operations[queue_name] = {
                        "puts": 0,
                        "gets": 0,
                        "pending_tasks": set(),
                        "size": 0,
                    }

                if "put" in trace.event_type.lower():
                    queue_operations[queue_name]["puts"] += 1
                    queue_operations[queue_name]["size"] += 1
                elif "get" in trace.event_type.lower():
                    queue_operations[queue_name]["gets"] += 1
                    if queue_operations[queue_name]["size"] > 0:
                        queue_operations[queue_name]["size"] -= 1

        tasks = self.importer.get_all_tasks()
        for task in tasks:
            waiting = task.waiting_on
            if waiting and "queue" in waiting.lower():
                queue_name = waiting
                if queue_name not in queue_operations:
                    queue_operations[queue_name] = {
                        "puts": 0,
                        "gets": 0,
                        "pending_tasks": set(),
                        "size": 0,
                    }
                queue_operations[queue_name]["pending_tasks"].add(task.task_id)

        for queue_name, data in queue_operations.items():
            pending_count = len(data["pending_tasks"])
            if pending_count > 0 or data["size"] > 0:
                congestion.append({
                    "queue_name": queue_name,
                    "pending_tasks": list(data["pending_tasks"]),
                    "pending_count": pending_count,
                    "queue_size": data["size"],
                    "total_puts": data["puts"],
                    "total_gets": data["gets"],
                })

        self.result.queue_congestion = congestion
        return congestion

    def analyze_wait_chains(self) -> List[List[str]]:
        chains = []
        tasks = self.importer.get_all_tasks()
        task_map = {t.task_id: t for t in tasks}
        visited = set()

        for task in tasks:
            if task.task_id not in visited:
                chain = self._build_wait_chain(task, task_map)
                if len(chain) > 1:
                    chains.append(chain)
                visited.update(chain)

        self.result.wait_chains = chains
        return chains

    def detect_deadlocks(self) -> List[List[str]]:
        tasks = self.importer.get_all_tasks()
        task_map = {t.task_id: t for t in tasks}
        deadlocks = []

        for task in tasks:
            if task.state in [TaskState.PENDING, TaskState.RUNNING]:
                chain = self._build_wait_chain(task, task_map)
                if len(chain) >= 2:
                    first = chain[0]
                    last = chain[-1]
                    if task_map[last].waiting_on == first:
                        deadlocks.append(chain)

        return deadlocks

    def run_full_analysis(
        self,
        pending_threshold_seconds: float = 60.0,
        cancel_grace_seconds: float = 5.0,
    ) -> AnalysisResult:
        self.analyze_long_pending_tasks(pending_threshold_seconds)
        self.analyze_task_leaks()
        self.analyze_ineffective_cancellations(cancel_grace_seconds)
        self.analyze_timeout_chains()
        self.analyze_queue_congestion()
        self.analyze_wait_chains()

        deadlocks = self.detect_deadlocks()

        all_tasks = self.importer.get_all_tasks()
        self.result.summary = {
            "total_tasks": len(all_tasks),
            "by_state": {
                state.value: len([t for t in all_tasks if t.state == state])
                for state in TaskState
            },
            "long_pending_count": len(self.result.long_pending_tasks),
            "task_leak_count": len(self.result.task_leaks),
            "ineffective_cancel_count": len(self.result.ineffective_cancellations),
            "timeout_chain_count": len(self.result.timeout_chains),
            "queue_congestion_count": len(self.result.queue_congestion),
            "wait_chain_count": len(self.result.wait_chains),
            "deadlock_count": len(deadlocks),
            "issues_found": (
                len(self.result.long_pending_tasks)
                + len(self.result.task_leaks)
                + len(self.result.ineffective_cancellations)
                + len(deadlocks)
            ),
        }

        return self.result

    def get_task_details(self, task_id: str) -> Optional[Dict]:
        task = self.importer.get_task(task_id)
        if not task:
            return None

        traces = self.importer.get_traces_by_task(task_id)

        return {
            "task": task,
            "traces": traces,
            "wait_chain": self._build_wait_chain(task, {t.task_id: t for t in self.importer.get_all_tasks()}),
            "awaited_by": task.awaited_by,
        }
