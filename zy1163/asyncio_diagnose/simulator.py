from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from .importer import DataImporter
from .models import (
    AnalysisResult,
    EventLoopTrace,
    TaskInfo,
    TaskState,
)


class Simulator:
    def __init__(self, importer: DataImporter):
        self.importer = importer
        self.initial_tasks: Dict[str, TaskInfo] = {}
        self.simulated_tasks: Dict[str, TaskInfo] = {}
        self.simulated_traces: List[EventLoopTrace] = []

    def _copy_task(self, task: TaskInfo) -> TaskInfo:
        return TaskInfo(
            task_id=task.task_id,
            name=task.name,
            state=task.state,
            coro_name=task.coro_name,
            created_at=task.created_at,
            last_updated_at=task.last_updated_at,
            waiting_on=task.waiting_on,
            awaited_by=list(task.awaited_by),
            cancel_requested=task.cancel_requested,
            cancel_time=task.cancel_time,
            metadata=dict(task.metadata),
        )

    def reset(self):
        self.initial_tasks = {
            t_id: self._copy_task(t)
            for t_id, t in self.importer.tasks.items()
        }
        self.simulated_tasks = {
            t_id: self._copy_task(t)
            for t_id, t in self.initial_tasks.items()
        }
        self.simulated_traces = []

    def replay(self, steps: Optional[int] = None) -> List[Dict]:
        self.reset()
        events = []

        traces = sorted(self.importer.traces, key=lambda t: t.timestamp)
        if steps:
            traces = traces[:steps]

        for trace in traces:
            event = self._apply_trace(trace)
            events.append(event)

        return events

    def _apply_trace(self, trace: EventLoopTrace) -> Dict:
        task = self.simulated_tasks.get(trace.task_id)
        old_state = task.state.value if task else None

        if task:
            task.last_updated_at = trace.timestamp
            if trace.event_type == "task_created":
                task.created_at = trace.timestamp
                task.coro_name = trace.details.get("coro_name", task.coro_name)
            elif trace.event_type == "task_running":
                task.state = TaskState.RUNNING
            elif trace.event_type == "task_pending":
                task.state = TaskState.PENDING
                task.waiting_on = trace.details.get("waiting_on")
            elif trace.event_type == "task_done":
                task.state = TaskState.DONE
            elif trace.event_type == "task_cancelled":
                task.state = TaskState.CANCELLED
                task.cancel_requested = True
                task.cancel_time = trace.timestamp
            elif trace.event_type == "task_cancel_requested":
                task.cancel_requested = True
                task.cancel_time = trace.timestamp
                task.state = TaskState.CANCEL_PENDING

        self.simulated_traces.append(trace)

        new_state = task.state.value if task else None
        return {
            "timestamp": trace.timestamp.isoformat(),
            "task_id": trace.task_id,
            "event_type": trace.event_type,
            "old_state": old_state,
            "new_state": new_state,
            "details": trace.details,
        }

    def simulate_cancel(self, task_id: str) -> Dict:
        task = self.simulated_tasks.get(task_id)
        if not task:
            return {"error": f"Task {task_id} not found"}

        old_state = task.state.value
        task.cancel_requested = True
        task.cancel_time = datetime.now(timezone.utc)
        task.state = TaskState.CANCEL_PENDING

        return {
            "task_id": task_id,
            "action": "simulate_cancel",
            "old_state": old_state,
            "new_state": task.state.value,
            "result": "Cancellation requested",
        }

    def simulate_timeout(self, task_id: str, timeout_seconds: float) -> Dict:
        task = self.simulated_tasks.get(task_id)
        if not task:
            return {"error": f"Task {task_id} not found"}

        if task.state in [TaskState.DONE, TaskState.CANCELLED]:
            return {
                "task_id": task_id,
                "action": "simulate_timeout",
                "state": task.state.value,
                "result": "Task already completed, timeout would have no effect",
            }

        chain = self._build_simulated_wait_chain(task)
        affected_tasks = []

        for t_id in chain:
            t = self.simulated_tasks.get(t_id)
            if t:
                affected_tasks.append({
                    "task_id": t_id,
                    "coro_name": t.coro_name,
                    "state": t.state.value,
                    "waiting_on": t.waiting_on,
                })

        return {
            "task_id": task_id,
            "action": "simulate_timeout",
            "timeout_seconds": timeout_seconds,
            "current_state": task.state.value,
            "wait_chain": chain,
            "affected_tasks": affected_tasks,
            "predicted_result": f"Timeout would affect {len(chain)} tasks in the wait chain",
        }

    def _build_simulated_wait_chain(self, start_task: TaskInfo) -> List[str]:
        chain = [start_task.task_id]
        visited = set(chain)
        current = start_task

        while current.waiting_on and current.waiting_on in self.simulated_tasks:
            next_task = self.simulated_tasks[current.waiting_on]
            if next_task.task_id in visited:
                break
            chain.append(next_task.task_id)
            visited.add(next_task.task_id)
            current = next_task

        return chain

    def get_simulated_state(self) -> Dict:
        return {
            "tasks": [
                {
                    "task_id": t.task_id,
                    "name": t.name,
                    "state": t.state.value,
                    "coro_name": t.coro_name,
                    "waiting_on": t.waiting_on,
                    "awaited_by": t.awaited_by,
                    "cancel_requested": t.cancel_requested,
                }
                for t in self.simulated_tasks.values()
            ],
            "trace_count": len(self.simulated_traces),
        }

    def predict_issues(self) -> Dict:
        from .analyzer import AsyncioAnalyzer

        class MockImporter:
            def __init__(self, tasks, traces, timeout_rules):
                self.tasks = tasks
                self.traces = traces
                self.timeout_rules = timeout_rules

            def get_all_tasks(self):
                return list(self.tasks.values())

            def get_task(self, task_id):
                return self.tasks.get(task_id)

            def get_traces_by_task(self, task_id):
                return [t for t in self.traces if t.task_id == task_id]

        mock_importer = MockImporter(
            self.simulated_tasks,
            self.simulated_traces,
            self.importer.timeout_rules,
        )

        analyzer = AsyncioAnalyzer(mock_importer)
        result = analyzer.run_full_analysis()

        return {
            "predicted_issues": result.summary.get("issues_found", 0),
            "long_pending_count": len(result.long_pending_tasks),
            "task_leak_count": len(result.task_leaks),
            "ineffective_cancel_count": len(result.ineffective_cancellations),
            "details": {
                "long_pending_tasks": [t.task_id for t in result.long_pending_tasks],
                "task_leaks": [t.task_id for t in result.task_leaks],
                "ineffective_cancellations": [t.task_id for t in result.ineffective_cancellations],
            },
        }
