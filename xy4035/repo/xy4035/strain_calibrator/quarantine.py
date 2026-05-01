import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from .models import QuarantineEntry
from .storage import DateTimeEncoder


class QuarantineManager:
    def __init__(self, quarantine_path: Path):
        self.quarantine_path = quarantine_path
        self.quarantine_file = quarantine_path / "quarantine.json"
        self._entries: List[QuarantineEntry] = []
        self._load_entries()

    def _load_entries(self) -> None:
        if not self.quarantine_file.exists():
            self._entries = []
            return
        with open(self.quarantine_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self._entries = [QuarantineEntry.model_validate(e) for e in data]

    def _save_entries(self) -> None:
        with open(self.quarantine_file, "w", encoding="utf-8") as f:
            json.dump(
                [e.model_dump() for e in self._entries],
                f,
                indent=2,
                ensure_ascii=False,
                cls=DateTimeEncoder,
            )

    def add_entry(
        self,
        raw_data: Dict[str, Any],
        reason: str,
        severity: str,
        source_file: str,
        original_row: Optional[int] = None,
        timestamp: Optional[datetime] = None,
    ) -> None:
        entry = QuarantineEntry(
            original_row=original_row,
            raw_data=raw_data,
            reason=reason,
            severity=severity,
            source_file=source_file,
            timestamp=timestamp,
        )
        self._entries.append(entry)
        self._save_entries()

    def add_entries(
        self,
        entries: List[Dict[str, Any]],
        source_file: str,
        reason: str,
        severity: str = "error",
    ) -> None:
        for i, data in enumerate(entries):
            self.add_entry(
                raw_data=data,
                reason=reason,
                severity=severity,
                source_file=source_file,
                original_row=i + 1,
            )

    def get_all_entries(self) -> List[QuarantineEntry]:
        return list(self._entries)

    def get_entries_by_source(self, source_file: str) -> List[QuarantineEntry]:
        return [e for e in self._entries if e.source_file == source_file]

    def get_entries_by_reason(self, reason: str) -> List[QuarantineEntry]:
        return [e for e in self._entries if reason in e.reason]

    def get_entries_by_severity(self, severity: str) -> List[QuarantineEntry]:
        return [e for e in self._entries if e.severity == severity]

    def count_entries(self) -> int:
        return len(self._entries)

    def count_by_severity(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for entry in self._entries:
            counts[entry.severity] = counts.get(entry.severity, 0) + 1
        return counts

    def clear_entries(self) -> None:
        self._entries = []
        self._save_entries()

    def get_summary(self) -> Dict[str, Any]:
        return {
            "total_count": self.count_entries(),
            "by_severity": self.count_by_severity(),
            "latest_entry": (
                self._entries[-1].model_dump() if self._entries else None
            ),
        }
