import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import Project, PortConfig, PortStatus, ScanResult


class DataStore:
    def __init__(self, workspace_path: str):
        self.workspace_path = Path(workspace_path).resolve()
        self.cache_file = self.workspace_path / ".port-checker" / "cache.json"
        self._result: Optional[ScanResult] = None

    def _load(self) -> ScanResult:
        if self._result is not None:
            return self._result

        if not self.cache_file.exists():
            self._result = ScanResult()
            return self._result

        try:
            with open(self.cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._result = self._deserialize(data)
        except (json.JSONDecodeError, KeyError, ValueError):
            self._result = ScanResult()

        return self._result

    def _save(self) -> None:
        if self._result is None:
            return

        self.cache_file.parent.mkdir(parents=True, exist_ok=True)
        data = self._serialize(self._result)
        with open(self.cache_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def _serialize(self, result: ScanResult) -> dict:
        return {
            "scanned_at": result.scanned_at.isoformat() if result.scanned_at else None,
            "checked_at": result.checked_at.isoformat() if result.checked_at else None,
            "projects": {
                name: {
                    "name": project.name,
                    "path": str(project.path),
                    "config_files": project.config_files,
                    "last_scanned": project.last_scanned.isoformat() if project.last_scanned else None,
                    "last_checked": project.last_checked.isoformat() if project.last_checked else None,
                    "ports": [
                        {
                            "port": p.port,
                            "source": p.source,
                            "service": p.service,
                            "raw_value": p.raw_value,
                            "status": p.status.value,
                            "process_name": p.process_name,
                            "process_id": p.process_id,
                            "error": p.error,
                        }
                        for p in project.ports
                    ],
                }
                for name, project in result.projects.items()
            },
        }

    def _deserialize(self, data: dict) -> ScanResult:
        result = ScanResult()
        result.scanned_at = datetime.fromisoformat(data["scanned_at"]) if data.get("scanned_at") else None
        result.checked_at = datetime.fromisoformat(data["checked_at"]) if data.get("checked_at") else None

        for name, project_data in data.get("projects", {}).items():
            project = Project(
                name=project_data["name"],
                path=project_data["path"],
                config_files=project_data.get("config_files", []),
            )
            project.last_scanned = (
                datetime.fromisoformat(project_data["last_scanned"])
                if project_data.get("last_scanned")
                else None
            )
            project.last_checked = (
                datetime.fromisoformat(project_data["last_checked"])
                if project_data.get("last_checked")
                else None
            )

            for port_data in project_data.get("ports", []):
                port_config = PortConfig(
                    port=port_data["port"],
                    source=port_data["source"],
                    service=port_data["service"],
                    raw_value=port_data["raw_value"],
                    status=PortStatus(port_data["status"]),
                    process_name=port_data.get("process_name"),
                    process_id=port_data.get("process_id"),
                    error=port_data.get("error"),
                )
                project.ports.append(port_config)

            result.projects[name] = project

        return result

    def get_result(self) -> ScanResult:
        return self._load()

    def update_project(self, project: Project) -> None:
        result = self._load()
        project.last_scanned = datetime.now()
        result.projects[project.name] = project
        result.scanned_at = datetime.now()
        self._save()

    def mark_checked(self) -> None:
        result = self._load()
        now = datetime.now()
        result.checked_at = now
        for project in result.projects.values():
            project.last_checked = now
        self._save()

    def clear(self) -> None:
        self._result = ScanResult()
        if self.cache_file.exists():
            self.cache_file.unlink()

    def refresh(self) -> ScanResult:
        self._result = None
        return self._load()
