import hashlib
import json
import os
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict, Any


class BackupStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class DrillStatus(Enum):
    SUCCESS = "success"
    FAILED = "failed"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"


@dataclass
class BackupSet:
    id: str
    name: str
    backup_date: str
    source_path: str
    checksum: str
    checksum_algorithm: str
    retention_days: int
    status: str
    created_at: str
    updated_at: str
    size_bytes: int
    description: Optional[str] = None

    def is_expired(self) -> bool:
        backup_dt = datetime.fromisoformat(self.backup_date)
        expiry_date = backup_dt + timedelta(days=self.retention_days)
        return datetime.now() > expiry_date

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BackupSet":
        return cls(**data)


@dataclass
class DrillRecord:
    id: str
    backup_set_id: str
    started_at: str
    completed_at: Optional[str] = None
    status: str = DrillStatus.PENDING.value
    duration_seconds: Optional[float] = None
    checksum_verified: Optional[bool] = None
    restored_path: Optional[str] = None
    error_message: Optional[str] = None
    manually_confirmed: bool = False
    re_backed_up: bool = False
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DrillRecord":
        return cls(**data)


class DataStore:
    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            home = Path.home()
            data_dir = home / ".backup_drill"
        self.data_dir = Path(data_dir)
        self.backups_file = self.data_dir / "backups.json"
        self.drills_file = self.data_dir / "drills.json"
        self._initialize()

    def _initialize(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.backups_file.exists():
            self.backups_file.touch()
            self.backups_file.write_text("[]")
        if not self.drills_file.exists():
            self.drills_file.touch()
            self.drills_file.write_text("[]")
        if self.backups_file.read_text().strip() == "":
            self.backups_file.write_text("[]")
        if self.drills_file.read_text().strip() == "":
            self.drills_file.write_text("[]")

    def _load_backups(self) -> List[Dict[str, Any]]:
        try:
            return json.loads(self.backups_file.read_text())
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_backups(self, backups: List[Dict[str, Any]]):
        self.backups_file.write_text(json.dumps(backups, indent=2, ensure_ascii=False))

    def _load_drills(self) -> List[Dict[str, Any]]:
        try:
            return json.loads(self.drills_file.read_text())
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_drills(self, drills: List[Dict[str, Any]]):
        self.drills_file.write_text(json.dumps(drills, indent=2, ensure_ascii=False))

    def get_active_backups(self) -> List[BackupSet]:
        backups = self._load_backups()
        return [BackupSet.from_dict(b) for b in backups if b["status"] == BackupStatus.ACTIVE.value]

    def get_backup_by_name(self, name: str) -> Optional[BackupSet]:
        backups = self._load_backups()
        for b in backups:
            if b["name"] == name and b["status"] == BackupStatus.ACTIVE.value:
                return BackupSet.from_dict(b)
        return None

    def get_backup_by_id(self, backup_id: str) -> Optional[BackupSet]:
        backups = self._load_backups()
        for b in backups:
            if b["id"] == backup_id:
                return BackupSet.from_dict(b)
        return None

    def save_backup(self, backup: BackupSet) -> BackupSet:
        backups = self._load_backups()
        
        for i, b in enumerate(backups):
            if b["name"] == backup.name:
                if b["status"] == BackupStatus.ACTIVE.value:
                    backups[i] = backup.to_dict()
                else:
                    backups.append(backup.to_dict())
                self._save_backups(backups)
                return backup
        
        backups.append(backup.to_dict())
        self._save_backups(backups)
        return backup

    def deactivate_backup(self, backup_id: str):
        backups = self._load_backups()
        for i, b in enumerate(backups):
            if b["id"] == backup_id:
                backups[i]["status"] = BackupStatus.INACTIVE.value
                backups[i]["updated_at"] = datetime.now().isoformat()
                break
        self._save_backups(backups)

    def get_drills_by_backup(self, backup_id: str) -> List[DrillRecord]:
        drills = self._load_drills()
        return [DrillRecord.from_dict(d) for d in drills if d["backup_set_id"] == backup_id]

    def get_recent_drills(self, limit: int = 10) -> List[DrillRecord]:
        drills = self._load_drills()
        drills.sort(key=lambda x: x["started_at"], reverse=True)
        return [DrillRecord.from_dict(d) for d in drills[:limit]]

    def get_all_drills(self) -> List[DrillRecord]:
        drills = self._load_drills()
        drills.sort(key=lambda x: x["started_at"], reverse=True)
        return [DrillRecord.from_dict(d) for d in drills]

    def save_drill(self, drill: DrillRecord) -> DrillRecord:
        drills = self._load_drills()
        
        for i, d in enumerate(drills):
            if d["id"] == drill.id:
                drills[i] = drill.to_dict()
                self._save_drills(drills)
                return drill
        
        drills.append(drill.to_dict())
        self._save_drills(drills)
        return drill

    def get_drill_by_id(self, drill_id: str) -> Optional[DrillRecord]:
        drills = self._load_drills()
        for d in drills:
            if d["id"] == drill_id:
                return DrillRecord.from_dict(d)
        return None


def generate_id() -> str:
    return hashlib.md5(
        f"{datetime.now().isoformat()}{os.urandom(16)}".encode()
    ).hexdigest()[:16]
