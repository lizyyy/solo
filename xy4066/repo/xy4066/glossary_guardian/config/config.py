import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class ProjectConfig:
    project_name: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    glossary_files: List[str] = field(default_factory=list)
    transcript_files: List[str] = field(default_factory=list)
    forbidden_terms_file: Optional[str] = None
    guest_list_file: Optional[str] = None
    settings: Dict[str, Any] = field(default_factory=lambda: {
        "similarity_threshold": 0.85,
        "case_sensitive": False,
        "ignore_punctuation": True,
        "min_term_length": 2,
    })

    def to_dict(self) -> Dict[str, Any]:
        return {
            "project_name": self.project_name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "glossary_files": self.glossary_files,
            "transcript_files": self.transcript_files,
            "forbidden_terms_file": self.forbidden_terms_file,
            "guest_list_file": self.guest_list_file,
            "settings": self.settings,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProjectConfig":
        return cls(
            project_name=data["project_name"],
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat()),
            glossary_files=data.get("glossary_files", []),
            transcript_files=data.get("transcript_files", []),
            forbidden_terms_file=data.get("forbidden_terms_file"),
            guest_list_file=data.get("guest_list_file"),
            settings=data.get("settings", {
                "similarity_threshold": 0.85,
                "case_sensitive": False,
                "ignore_punctuation": True,
                "min_term_length": 2,
            }),
        )

    def add_glossary_file(self, file_path: str):
        if file_path not in self.glossary_files:
            self.glossary_files.append(file_path)
            self._update_timestamp()

    def add_transcript_file(self, file_path: str):
        if file_path not in self.transcript_files:
            self.transcript_files.append(file_path)
            self._update_timestamp()

    def set_forbidden_terms_file(self, file_path: str):
        self.forbidden_terms_file = file_path
        self._update_timestamp()

    def set_guest_list_file(self, file_path: str):
        self.guest_list_file = file_path
        self._update_timestamp()

    def _update_timestamp(self):
        self.updated_at = datetime.now().isoformat()


def get_config_path(project_dir: Path) -> Path:
    return project_dir / ".glossary-guardian" / "config.json"


def get_data_dir(project_dir: Path) -> Path:
    return project_dir / ".glossary-guardian" / "data"


def get_reports_dir(project_dir: Path) -> Path:
    return project_dir / ".glossary-guardian" / "reports"


def init_project(project_dir: Path, project_name: str) -> ProjectConfig:
    config_path = get_config_path(project_dir)
    if config_path.exists():
        raise FileExistsError(f"Project already initialized at {project_dir}")

    config_dir = config_path.parent
    config_dir.mkdir(parents=True, exist_ok=True)

    get_data_dir(project_dir).mkdir(parents=True, exist_ok=True)
    get_reports_dir(project_dir).mkdir(parents=True, exist_ok=True)

    config = ProjectConfig(project_name=project_name)
    save_config(project_dir, config)

    return config


def load_config(project_dir: Path) -> ProjectConfig:
    config_path = get_config_path(project_dir)
    if not config_path.exists():
        raise FileNotFoundError(
            f"Config file not found at {config_path}. Run 'init' first."
        )

    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return ProjectConfig.from_dict(data)


def save_config(project_dir: Path, config: ProjectConfig):
    config_path = get_config_path(project_dir)
    config_dir = config_path.parent
    config_dir.mkdir(parents=True, exist_ok=True)

    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config.to_dict(), f, ensure_ascii=False, indent=2)


def is_project_initialized(project_dir: Path) -> bool:
    config_path = get_config_path(project_dir)
    return config_path.exists()
