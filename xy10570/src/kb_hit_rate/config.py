import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


@dataclass
class Config:
    db_path: str
    data_dir: str
    operator: str

    @classmethod
    def from_env(cls) -> "Config":
        home = Path.home()
        default_dir = home / ".kbhr"
        return cls(
            db_path=os.environ.get("KBHR_DB", str(default_dir / "kbhr.db")),
            data_dir=os.environ.get("KBHR_DATA_DIR", str(default_dir / "data")),
            operator=os.environ.get("KBHR_OPERATOR", "system"),
        )

    def ensure_dirs(self) -> None:
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        Path(self.data_dir).mkdir(parents=True, exist_ok=True)
