import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from pydantic import BaseModel, Field

from .checker import Violation, ViolationType


class QuarantineEntry(BaseModel):
    id: str
    font_name: str
    violation_type: str
    message: str
    file_path: str
    page: Optional[str] = None
    severity: str
    details: Dict[str, Any] = Field(default_factory=dict)
    detected_at: str
    status: str = "active"
    notes: Optional[str] = None
    resolved_at: Optional[str] = None


class Quarantine(BaseModel):
    version: str = "1.0"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    entries: List[QuarantineEntry] = Field(default_factory=list)
    statistics: Dict[str, int] = Field(default_factory=dict)


class QuarantineManager:
    DEFAULT_FILE_NAME = "quarantine.json"
    
    def __init__(self, quarantine_path: Path):
        self.quarantine_path = quarantine_path
        self._quarantine: Optional[Quarantine] = None
    
    def load(self) -> Quarantine:
        if self._quarantine is not None:
            return self._quarantine
        
        if self.quarantine_path.exists():
            with open(self.quarantine_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._quarantine = Quarantine.model_validate(data)
        else:
            self._quarantine = Quarantine()
        
        return self._quarantine
    
    def save(self) -> None:
        if self._quarantine is None:
            self._quarantine = Quarantine()
        
        self._quarantine.updated_at = datetime.now().isoformat()
        self._quarantine.statistics = self._calculate_statistics()
        
        self.quarantine_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.quarantine_path, "w", encoding="utf-8") as f:
            json.dump(self._quarantine.model_dump(), f, indent=2, ensure_ascii=False)
    
    def _calculate_statistics(self) -> Dict[str, int]:
        if self._quarantine is None:
            return {}
        
        stats = {
            "total": len(self._quarantine.entries),
            "active": 0,
            "resolved": 0,
            "by_type": {},
            "by_severity": {},
        }
        
        for entry in self._quarantine.entries:
            if entry.status == "active":
                stats["active"] += 1
            elif entry.status == "resolved":
                stats["resolved"] += 1
            
            if entry.violation_type not in stats["by_type"]:
                stats["by_type"][entry.violation_type] = 0
            stats["by_type"][entry.violation_type] += 1
            
            if entry.severity not in stats["by_severity"]:
                stats["by_severity"][entry.severity] = 0
            stats["by_severity"][entry.severity] += 1
        
        return stats
    
    def add_violation(self, violation: Violation) -> QuarantineEntry:
        quarantine = self.load()
        
        import hashlib
        entry_id = hashlib.sha256(
            f"{violation.font_name}:{violation.file_path}:{violation.violation_type}:{violation.detected_at}".encode()
        ).hexdigest()[:12]
        
        entry = QuarantineEntry(
            id=entry_id,
            font_name=violation.font_name,
            violation_type=violation.violation_type.value,
            message=violation.message,
            file_path=violation.file_path,
            page=violation.page,
            severity=violation.severity,
            details=violation.details,
            detected_at=violation.detected_at,
        )
        
        quarantine.entries.append(entry)
        self.save()
        
        return entry
    
    def add_violations(self, violations: List[Violation]) -> List[QuarantineEntry]:
        entries = []
        for violation in violations:
            entry = self.add_violation(violation)
            entries.append(entry)
        return entries
    
    def resolve(self, entry_id: str, notes: Optional[str] = None) -> bool:
        quarantine = self.load()
        
        for entry in quarantine.entries:
            if entry.id == entry_id:
                entry.status = "resolved"
                entry.resolved_at = datetime.now().isoformat()
                if notes:
                    entry.notes = notes
                self.save()
                return True
        
        return False
    
    def get_active_entries(self) -> List[QuarantineEntry]:
        quarantine = self.load()
        return [e for e in quarantine.entries if e.status == "active"]
    
    def get_entries_by_font(self, font_name: str) -> List[QuarantineEntry]:
        quarantine = self.load()
        return [e for e in quarantine.entries if e.font_name == font_name]
    
    def get_entries_by_file(self, file_path: str) -> List[QuarantineEntry]:
        quarantine = self.load()
        return [e for e in quarantine.entries if e.file_path == file_path]
    
    def clear(self) -> int:
        count = 0
        if self._quarantine:
            count = len(self._quarantine.entries)
        self._quarantine = Quarantine()
        self.save()
        return count
    
    @property
    def quarantine(self) -> Quarantine:
        return self.load()
