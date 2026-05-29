import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import Commission


class StorageManager:
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.data_dir = self.base_dir / "data"
        self.screenshots_dir = self.base_dir / "screenshots"
        self.exports_dir = self.base_dir / "exports"
        self.backups_dir = self.base_dir / "backups"

    def init_directories(self) -> None:
        for d in [self.data_dir, self.screenshots_dir, self.exports_dir, self.backups_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def is_initialized(self) -> bool:
        return self.data_dir.exists() and self.data_dir.is_dir()

    def _backup_before_write(self) -> None:
        if self.data_dir.exists() and any(self.data_dir.iterdir()):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_dir = self.backups_dir / f"backup_{timestamp}"
            shutil.copytree(self.data_dir, backup_dir)

    def _get_commission_path(self, commission_id: str) -> Path:
        return self.data_dir / f"{commission_id}.json"

    def save_commission(self, commission: Commission, backup: bool = True) -> None:
        if backup:
            self._backup_before_write()
        path = self._get_commission_path(commission.id)
        data = commission.model_dump(mode="json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_commission(self, commission_id: str) -> Optional[Commission]:
        path = self._get_commission_path(commission_id)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return Commission(**data)

    def load_all_commissions(self) -> List[Commission]:
        commissions = []
        for path in self.data_dir.glob("*.json"):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            commissions.append(Commission(**data))
        return sorted(commissions, key=lambda c: c.created_at, reverse=True)

    def delete_commission(self, commission_id: str) -> bool:
        path = self._get_commission_path(commission_id)
        if path.exists():
            self._backup_before_write()
            path.unlink()
            return True
        return False

    def get_screenshot_path(self, commission_id: str, stage: str, ext: str = ".png") -> Path:
        safe_stage = stage.replace(" ", "_").replace("/", "_")
        filename = f"{commission_id}_{safe_stage}_{datetime.now().strftime('%Y%m%d')}{ext}"
        return self.screenshots_dir / filename

    def get_export_path(self, filename: str) -> Path:
        self.exports_dir.mkdir(parents=True, exist_ok=True)
        return self.exports_dir / filename

    def commission_exists(self, commission_id: str) -> bool:
        return self._get_commission_path(commission_id).exists()
