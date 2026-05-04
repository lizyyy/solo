import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from .models import (
    AwaitEdge,
    EventLoopTrace,
    TaskInfo,
    TaskState,
    TimeoutRule,
)


class DataImporter:
    def __init__(self):
        self.tasks: Dict[str, TaskInfo] = {}
        self.traces: List[EventLoopTrace] = []
        self.await_edges: List[AwaitEdge] = []
        self.timeout_rules: List[TimeoutRule] = []

    def parse_datetime(self, value) -> datetime:
        if isinstance(value, str):
            try:
                result = datetime.fromisoformat(value.replace("Z", "+00:00"))
                if result.tzinfo is None:
                    result = result.replace(tzinfo=timezone.utc)
                return result
            except ValueError:
                return datetime.now(timezone.utc)
        elif isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value
        return datetime.now(timezone.utc)

    def parse_task_state(self, value: str) -> TaskState:
        state_map = {
            "pending": TaskState.PENDING,
            "running": TaskState.RUNNING,
            "done": TaskState.DONE,
            "cancelled": TaskState.CANCELLED,
            "cancel_pending": TaskState.CANCEL_PENDING,
            "PENDING": TaskState.PENDING,
            "RUNNING": TaskState.RUNNING,
            "DONE": TaskState.DONE,
            "CANCELLED": TaskState.CANCELLED,
        }
        return state_map.get(value.lower(), TaskState.PENDING)

    def import_task_dump(self, file_path: Path) -> Dict[str, TaskInfo]:
        with open(file_path, "r") as f:
            data = json.load(f)

        tasks_data = data.get("tasks", data if isinstance(data, list) else [])

        for task_data in tasks_data:
            task_id = task_data.get("task_id", task_data.get("id", ""))
            if not task_id:
                continue

            task = TaskInfo(
                task_id=task_id,
                name=task_data.get("name"),
                state=self.parse_task_state(task_data.get("state", "pending")),
                coro_name=task_data.get("coro_name", task_data.get("coro", "")),
                created_at=self.parse_datetime(task_data.get("created_at", task_data.get("created"))),
                last_updated_at=self.parse_datetime(task_data.get("last_updated_at", task_data.get("updated"))),
                waiting_on=task_data.get("waiting_on"),
                awaited_by=task_data.get("awaited_by", []),
                cancel_requested=task_data.get("cancel_requested", False),
                cancel_time=self.parse_datetime(task_data.get("cancel_time")) if task_data.get("cancel_time") else None,
                metadata=task_data.get("metadata", {}),
            )
            self.tasks[task_id] = task

        return self.tasks

    def import_event_loop_trace(self, file_path: Path) -> List[EventLoopTrace]:
        with open(file_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue

                trace = EventLoopTrace(
                    timestamp=self.parse_datetime(data.get("timestamp", data.get("ts"))),
                    event_type=data.get("event_type", data.get("type", "")),
                    task_id=data.get("task_id", data.get("task", "")),
                    details=data.get("details", {k: v for k, v in data.items() if k not in ["timestamp", "ts", "event_type", "type", "task_id", "task"]}),
                )
                self.traces.append(trace)

                if trace.task_id and trace.task_id not in self.tasks:
                    self.tasks[trace.task_id] = TaskInfo(
                        task_id=trace.task_id,
                        name=None,
                        state=TaskState.PENDING,
                        coro_name="unknown",
                        created_at=trace.timestamp,
                        last_updated_at=trace.timestamp,
                    )

                task = self.tasks.get(trace.task_id)
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
                    elif trace.event_type == "task_waiting":
                        target = trace.details.get("target")
                        if target:
                            task.waiting_on = target
                            if target in self.tasks:
                                if task.task_id not in self.tasks[target].awaited_by:
                                    self.tasks[target].awaited_by.append(task.task_id)

        return self.traces

    def import_await_graph(self, file_path: Path) -> List[AwaitEdge]:
        with open(file_path, "r") as f:
            data = yaml.safe_load(f)

        edges_data = data.get("edges", data if isinstance(data, list) else [])

        for edge_data in edges_data:
            if not isinstance(edge_data, dict):
                continue

            edge = AwaitEdge(
                from_task=edge_data.get("from", edge_data.get("from_task", "")),
                to_task=edge_data.get("to", edge_data.get("to_task", "")),
                await_time=self.parse_datetime(edge_data.get("await_time", edge_data.get("time"))),
                resolved_time=self.parse_datetime(edge_data.get("resolved_time")) if edge_data.get("resolved_time") else None,
            )
            if edge.from_task and edge.to_task:
                self.await_edges.append(edge)

                if edge.from_task in self.tasks and edge.to_task in self.tasks:
                    self.tasks[edge.from_task].waiting_on = edge.to_task
                    if edge.from_task not in self.tasks[edge.to_task].awaited_by:
                        self.tasks[edge.to_task].awaited_by.append(edge.from_task)

        return self.await_edges

    def import_timeout_rules(self, file_path: Path) -> List[TimeoutRule]:
        with open(file_path, "r") as f:
            data = yaml.safe_load(f)

        rules_data = data.get("rules", data if isinstance(data, list) else [])

        for rule_data in rules_data:
            if not isinstance(rule_data, dict):
                continue

            rule = TimeoutRule(
                task_pattern=rule_data.get("pattern", rule_data.get("task_pattern", "")),
                timeout_seconds=float(rule_data.get("timeout", rule_data.get("timeout_seconds", 30))),
                description=rule_data.get("description", ""),
            )
            if rule.task_pattern:
                self.timeout_rules.append(rule)

        return self.timeout_rules

    def import_all(
        self,
        task_dump: Optional[Path] = None,
        event_loop_trace: Optional[Path] = None,
        await_graph: Optional[Path] = None,
        timeout_rules: Optional[Path] = None,
    ):
        if task_dump and task_dump.exists():
            self.import_task_dump(task_dump)
        if event_loop_trace and event_loop_trace.exists():
            self.import_event_loop_trace(event_loop_trace)
        if await_graph and await_graph.exists():
            self.import_await_graph(await_graph)
        if timeout_rules and timeout_rules.exists():
            self.import_timeout_rules(timeout_rules)

        return self

    def get_task(self, task_id: str) -> Optional[TaskInfo]:
        return self.tasks.get(task_id)

    def get_all_tasks(self) -> List[TaskInfo]:
        return list(self.tasks.values())

    def get_traces_by_task(self, task_id: str) -> List[EventLoopTrace]:
        return [t for t in self.traces if t.task_id == task_id]
