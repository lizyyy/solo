import json
from pathlib import Path
from datetime import datetime
from typing import Optional

from .models import ProjectState


class Storage:
    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.state_file = project_dir / "state.json"
        self.data_dir = project_dir / "data"
        self.imports_dir = self.data_dir / "imports"
        self.exports_dir = self.data_dir / "exports"

    def initialize(self, project_name: str) -> ProjectState:
        self.project_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.imports_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)

        state = ProjectState(
            project_name=project_name,
            created_at=datetime.now(),
        )
        self.save_state(state)
        return state

    def exists(self) -> bool:
        return self.state_file.exists()

    def load_state(self) -> ProjectState:
        if not self.state_file.exists():
            raise FileNotFoundError(f"Project not initialized at {self.project_dir}")

        with open(self.state_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        return ProjectState.model_validate(data)

    def save_state(self, state: ProjectState) -> None:
        self.project_dir.mkdir(parents=True, exist_ok=True)
        state.version += 1
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(state.model_dump(mode="json"), f, ensure_ascii=False, indent=2)

    def save_imported_file(self, source_path: Path, category: str) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest = self.imports_dir / f"{category}_{timestamp}_{source_path.name}"
        dest.write_bytes(source_path.read_bytes())
        return dest
