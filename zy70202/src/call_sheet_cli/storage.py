import json
import os
from typing import Optional
from pathlib import Path

from .models import ProjectState


class StorageManager:
    def __init__(self, project_dir: str = ".call-sheet"):
        self.project_dir = Path(project_dir)
        self.state_file = self.project_dir / "state.json"

    def init_project(self, project_name: str) -> ProjectState:
        self.project_dir.mkdir(parents=True, exist_ok=True)
        state = ProjectState(project_name=project_name)
        self.save_state(state)
        return state

    def load_state(self) -> Optional[ProjectState]:
        if not self.state_file.exists():
            return None
        with open(self.state_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ProjectState.from_dict(data)

    def save_state(self, state: ProjectState) -> None:
        self.project_dir.mkdir(parents=True, exist_ok=True)
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(state.to_dict(), f, ensure_ascii=False, indent=2)

    def project_exists(self) -> bool:
        return self.state_file.exists()

    def export_data(self, export_dir: str, filename: str) -> str:
        export_path = Path(export_dir) / filename
        export_path.parent.mkdir(parents=True, exist_ok=True)
        state = self.load_state()
        if state:
            with open(export_path, "w", encoding="utf-8") as f:
                json.dump(state.to_dict(), f, ensure_ascii=False, indent=2)
        return str(export_path)
