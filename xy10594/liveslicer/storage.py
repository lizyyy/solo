import json
import os
from pathlib import Path
from typing import Optional
from .models import ProjectState


PROJECT_FILE = "project_state.json"


class Storage:
    @staticmethod
    def get_project_path(cwd: Optional[str] = None) -> Path:
        base = Path(cwd) if cwd else Path.cwd()
        return base / PROJECT_FILE

    @staticmethod
    def project_exists(cwd: Optional[str] = None) -> bool:
        return Storage.get_project_path(cwd).exists()

    @staticmethod
    def save_project(state: ProjectState, cwd: Optional[str] = None) -> None:
        path = Storage.get_project_path(cwd)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(state.to_dict(), f, ensure_ascii=False, indent=2)

    @staticmethod
    def load_project(cwd: Optional[str] = None) -> Optional[ProjectState]:
        path = Storage.get_project_path(cwd)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ProjectState.from_dict(data)
