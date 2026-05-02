import json
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .package_validator import ValidationResult, ValidationIssue
from .utils import get_current_timestamp, ensure_dir


@dataclass
class QuarantineEntry:
    package_id: str
    package_name: str
    package_version: str
    quarantine_time: str
    reasons: List[Dict]
    original_path: str
    quarantine_path: str
    manifest: Optional[Dict] = None
    
    def to_dict(self) -> Dict:
        return {
            "package_id": self.package_id,
            "package_name": self.package_name,
            "package_version": self.package_version,
            "quarantine_time": self.quarantine_time,
            "reasons": self.reasons,
            "original_path": self.original_path,
            "quarantine_path": self.quarantine_path,
            "manifest": self.manifest
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "QuarantineEntry":
        return cls(
            package_id=data["package_id"],
            package_name=data["package_name"],
            package_version=data["package_version"],
            quarantine_time=data["quarantine_time"],
            reasons=data["reasons"],
            original_path=data["original_path"],
            quarantine_path=data["quarantine_path"],
            manifest=data.get("manifest")
        )


class QuarantineManager:
    def __init__(self, quarantine_dir: Path):
        self.quarantine_dir = quarantine_dir
        self.quarantine_json = quarantine_dir / "quarantine.json"
        ensure_dir(quarantine_dir)
    
    def _load_quarantine(self) -> List[QuarantineEntry]:
        if not self.quarantine_json.exists():
            return []
        
        with open(self.quarantine_json, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return [QuarantineEntry.from_dict(entry) for entry in data]
    
    def _save_quarantine(self, entries: List[QuarantineEntry]) -> None:
        with open(self.quarantine_json, "w", encoding="utf-8") as f:
            json.dump([e.to_dict() for e in entries], f, indent=2, ensure_ascii=False)
    
    def quarantine_package(
        self,
        package_dir: Path,
        validation_result: ValidationResult
    ) -> QuarantineEntry:
        manifest = validation_result.manifest
        
        package_name = manifest.package_name if manifest else package_dir.name
        package_version = manifest.package_version if manifest else "unknown"
        package_id = f"{package_name}-{package_version}-{get_current_timestamp()}"
        
        dest_dir = self.quarantine_dir / package_id
        
        shutil.copytree(package_dir, dest_dir)
        
        entry = QuarantineEntry(
            package_id=package_id,
            package_name=package_name,
            package_version=package_version,
            quarantine_time=get_current_timestamp(),
            reasons=[i.to_dict() for i in validation_result.issues],
            original_path=str(package_dir),
            quarantine_path=str(dest_dir),
            manifest=manifest.to_dict() if manifest else None
        )
        
        entries = self._load_quarantine()
        entries.append(entry)
        self._save_quarantine(entries)
        
        return entry
    
    def get_quarantined_packages(self) -> List[QuarantineEntry]:
        return self._load_quarantine()
    
    def get_quarantine_entry(self, package_id: str) -> Optional[QuarantineEntry]:
        entries = self._load_quarantine()
        for entry in entries:
            if entry.package_id == package_id:
                return entry
        return None
    
    def remove_quarantine_entry(self, package_id: str, delete_files: bool = True) -> bool:
        entries = self._load_quarantine()
        entry_to_remove = None
        
        for entry in entries:
            if entry.package_id == package_id:
                entry_to_remove = entry
                break
        
        if not entry_to_remove:
            return False
        
        entries = [e for e in entries if e.package_id != package_id]
        self._save_quarantine(entries)
        
        if delete_files:
            quarantine_path = Path(entry_to_remove.quarantine_path)
            if quarantine_path.exists():
                shutil.rmtree(quarantine_path)
        
        return True
    
    def clear_quarantine(self, delete_files: bool = True) -> int:
        entries = self._load_quarantine()
        count = len(entries)
        
        if delete_files:
            for entry in entries:
                quarantine_path = Path(entry.quarantine_path)
                if quarantine_path.exists():
                    shutil.rmtree(quarantine_path)
        
        self._save_quarantine([])
        return count
