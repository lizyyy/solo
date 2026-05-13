import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional

from .models import SchedulerState, TenantConfig, Task, TenantRuntimeState


class JsonStorage:
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            data_dir = os.path.join(os.getcwd(), ".mt-scheduler")
        self.data_dir = Path(data_dir)
        self.state_file = self.data_dir / "scheduler_state.json"
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def load(self) -> SchedulerState:
        if not self.state_file.exists():
            return SchedulerState()
        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return self._deserialize_state(data)
        except (json.JSONDecodeError, KeyError):
            return SchedulerState()

    def save(self, state: SchedulerState) -> None:
        state.updated_at = datetime.now()
        serialized = self._serialize_state(state)
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(serialized, f, indent=2, ensure_ascii=False, default=str)

    def _serialize_state(self, state: SchedulerState) -> dict:
        data = state.model_dump()
        return data

    def _deserialize_state(self, data: dict) -> SchedulerState:
        tasks = {}
        for task_id, task_data in data.get("tasks", {}).items():
            if "created_at" in task_data:
                task_data["created_at"] = datetime.fromisoformat(task_data["created_at"])
            if "started_at" in task_data and task_data["started_at"]:
                task_data["started_at"] = datetime.fromisoformat(task_data["started_at"])
            if "completed_at" in task_data and task_data["completed_at"]:
                task_data["completed_at"] = datetime.fromisoformat(task_data["completed_at"])
            if "last_failure_time" in task_data and task_data["last_failure_time"]:
                task_data["last_failure_time"] = datetime.fromisoformat(task_data["last_failure_time"])
            tasks[task_id] = Task(**task_data)

        tenant_configs = {}
        for tenant_id, cfg_data in data.get("tenant_configs", {}).items():
            tenant_configs[tenant_id] = TenantConfig(**cfg_data)

        tenant_runtime = {}
        for tenant_id, rt_data in data.get("tenant_runtime", {}).items():
            if "last_failure_time" in rt_data and rt_data["last_failure_time"]:
                rt_data["last_failure_time"] = datetime.fromisoformat(rt_data["last_failure_time"])
            tenant_runtime[tenant_id] = TenantRuntimeState(**rt_data)

        if "updated_at" in data and data["updated_at"]:
            data["updated_at"] = datetime.fromisoformat(data["updated_at"])

        return SchedulerState(
            version=data.get("version", 1),
            tasks=tasks,
            tenant_configs=tenant_configs,
            tenant_runtime=tenant_runtime,
            total_completed=data.get("total_completed", 0),
            total_failed=data.get("total_failed", 0),
            updated_at=data.get("updated_at", datetime.now()),
        )

    def reset(self) -> None:
        if self.state_file.exists():
            self.state_file.unlink()
