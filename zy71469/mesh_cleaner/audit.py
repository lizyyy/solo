from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class AuditEntry:
    timestamp: str
    operator: str
    file_path: str
    file_name: str
    action: str
    target_type: str
    target_identifier: str
    old_value: Any
    new_value: Any
    reason: str
    source_line: Optional[int] = None

    def to_dict(self) -> dict:
        d: dict = {
            "timestamp": self.timestamp,
            "operator": self.operator,
            "file_path": self.file_path,
            "file_name": self.file_name,
            "action": self.action,
            "target_type": self.target_type,
            "target_identifier": self.target_identifier,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "reason": self.reason,
        }
        if self.source_line is not None:
            d["source_line"] = self.source_line
        return d


class AuditLog:
    def __init__(self, log_dir: Optional[str] = None):
        self.entries: List[AuditEntry] = []
        self._log_dir = log_dir

    def record_correction(
        self,
        file_path: str,
        file_name: str,
        target_type: str,
        target_identifier: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        operator: str = "manual",
        source_line: Optional[int] = None,
    ) -> AuditEntry:
        entry = AuditEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            operator=operator,
            file_path=file_path,
            file_name=file_name,
            action="correction",
            target_type=target_type,
            target_identifier=target_identifier,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            source_line=source_line,
        )
        self.entries.append(entry)
        return entry

    def record_auto_fix(
        self,
        file_path: str,
        file_name: str,
        target_type: str,
        target_identifier: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        source_line: Optional[int] = None,
    ) -> AuditEntry:
        entry = AuditEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            operator="auto",
            file_path=file_path,
            file_name=file_name,
            action="auto_fix",
            target_type=target_type,
            target_identifier=target_identifier,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            source_line=source_line,
        )
        self.entries.append(entry)
        return entry

    def record_skip(
        self,
        file_path: str,
        file_name: str,
        target_type: str,
        target_identifier: str,
        current_value: Any,
        reason: str,
        source_line: Optional[int] = None,
    ) -> AuditEntry:
        entry = AuditEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            operator="manual",
            file_path=file_path,
            file_name=file_name,
            action="skip",
            target_type=target_type,
            target_identifier=target_identifier,
            old_value=current_value,
            new_value=current_value,
            reason=reason,
            source_line=source_line,
        )
        self.entries.append(entry)
        return entry

    def to_dict_list(self) -> List[dict]:
        return [e.to_dict() for e in self.entries]

    def save(self, output_path: Optional[str] = None) -> str:
        if output_path is None:
            if self._log_dir:
                os.makedirs(self._log_dir, exist_ok=True)
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_path = os.path.join(
                    self._log_dir, f"audit_trail_{ts}.json"
                )
            else:
                output_path = "audit_trail.json"

        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "audit_trail_version": "1.0",
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "entry_count": len(self.entries),
                    "entries": self.to_dict_list(),
                },
                f,
                ensure_ascii=False,
                indent=2,
            )
        return output_path

    @staticmethod
    def load(path: str) -> "AuditLog":
        log = AuditLog()
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for entry_data in data.get("entries", []):
            entry = AuditEntry(
                timestamp=entry_data["timestamp"],
                operator=entry_data["operator"],
                file_path=entry_data["file_path"],
                file_name=entry_data["file_name"],
                action=entry_data["action"],
                target_type=entry_data["target_type"],
                target_identifier=entry_data["target_identifier"],
                old_value=entry_data["old_value"],
                new_value=entry_data["new_value"],
                reason=entry_data["reason"],
                source_line=entry_data.get("source_line"),
            )
            log.entries.append(entry)
        return log
