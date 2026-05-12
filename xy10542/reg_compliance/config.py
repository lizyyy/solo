import os
from pathlib import Path
from dataclasses import dataclass


@dataclass
class AppConfig:
    project_dir: Path
    data_dir: Path
    logs_dir: Path
    db_path: Path

    @classmethod
    def from_env(cls) -> "AppConfig":
        project_dir = Path(os.environ.get("REG_COMPLIANCE_PROJECT", "."))
        return cls(
            project_dir=project_dir,
            data_dir=project_dir / "data",
            logs_dir=project_dir / "logs",
            db_path=project_dir / "data" / "compliance.db",
        )

    def ensure_dirs(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
