import os
import json
from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path

from .models import (
    ChangeProject,
    ChangeRecord,
)


class JSONStorage:
    def __init__(self, base_path: str = "./metric_data"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self._ensure_initialized()

    def _ensure_initialized(self):
        if not self.base_path.exists():
            self.base_path.mkdir(parents=True, exist_ok=True)

    def _project_path(self, project_id: str) -> Path:
        return self.base_path / f"{project_id}.json"

    def _idempotent_key(self, project_id: str, operation: str) -> str:
        return f"{project_id}:{operation}"

    def _backup_file(self, project_id: str) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return self.base_path / f"{project_id}.{timestamp}.bak"

    def _custom_encoder(self, obj):
        if isinstance(obj, datetime):
            return {
                "__type__": "datetime",
                "value": obj.isoformat()
            }
        elif hasattr(obj, "dict"):
            return obj.dict()
        elif hasattr(obj, "__dict__"):
            return obj.__dict__
        return str(obj)

    def _custom_decoder(self, dct):
        if "__type__" in dct and dct["__type__"] == "datetime":
            return datetime.fromisoformat(dct["value"])
        return dct

    def save_project(self, project: ChangeProject, operator: str, reason: str = None) -> bool:
        """保存项目，自动备份并记录变更"""
        project_path = self._project_path(project.project_id)

        if project_path.exists():
            old_project = self.load_project(project.project_id)
            if old_project:
                backup_path = self._backup_file(project.project_id)
                with open(backup_path, 'w', encoding='utf-8') as f:
                    json.dump(
                        old_project,
                        f,
                        default=self._custom_encoder,
                        ensure_ascii=False,
                        indent=2
                    )

        project.updated_at = datetime.now()

        with open(project_path, 'w', encoding='utf-8') as f:
            json.dump(
                project,
                f,
                default=self._custom_encoder,
                ensure_ascii=False,
                indent=2
            )
        return True

    def load_project(self, project_id: str) -> Optional[ChangeProject]:
        project_path = self._project_path(project_id)
        if not project_path.exists():
            return None

        with open(project_path, 'r', encoding='utf-8') as f:
            data = json.load(f, object_hook=self._custom_decoder)
            if isinstance(data, dict):
                from .models import (
                    MetricDefinition, Dashboard, BackfillTask,
                    MetricChange, ChangeRecord, ChangeProject
                )

                if 'metrics' in data:
                    data['metrics'] = {
                        k: MetricDefinition(**v)
                        for k, v in data['metrics'].items()
                    }

                if 'old_metrics' in data:
                    data['old_metrics'] = {
                        k: MetricDefinition(**v)
                        for k, v in data['old_metrics'].items()
                    }

                if 'dashboards' in data:
                    data['dashboards'] = {
                        k: Dashboard(**v)
                        for k, v in data['dashboards'].items()
                    }

                if 'backfill_tasks' in data:
                    data['backfill_tasks'] = {
                        k: BackfillTask(**v)
                        for k, v in data['backfill_tasks'].items()
                    }

                if 'metric_changes' in data:
                    data['metric_changes'] = {
                        k: MetricChange(**v)
                        for k, v in data['metric_changes'].items()
                    }

                if 'history' in data:
                    data['history'] = [
                        ChangeRecord(**r)
                        for r in data['history']
                    ]

                return ChangeProject(**data)
            return None

    def add_history(self, project: ChangeProject, record: ChangeRecord):
        project.history.append(record)
        if record.entity_id in project.metric_changes:
            project.metric_changes[record.entity_id].history.append(record)

    def project_exists(self, project_id: str) -> bool:
        return self._project_path(project_id).exists()

    def list_projects(self) -> list:
        projects = []
        for file in self.base_path.glob("*.json"):
            if not file.name.endswith(".bak"):
                project_id = file.stem
                project = self.load_project(project_id)
                if project:
                    projects.append({
                        "id": project_id,
                        "name": project.name,
                        "created_at": project.created_at,
                        "changes": len(project.metric_changes),
                        "status": self._get_project_status(project)
                    })
        return projects

    def _get_project_status(self, project: ChangeProject) -> str:
        if not project.metric_changes:
            return "empty"

        all_status = [c.status for c in project.metric_changes.values()]

        if all(s == "completed" for s in all_status):
            return "completed"
        elif any(s == "failed" for s in all_status):
            return "has_failures"
        elif any(s in ["needs_review", "needs_backfill", "notify_business"] for s in all_status):
            return "needs_attention"
        else:
            return "in_progress"
