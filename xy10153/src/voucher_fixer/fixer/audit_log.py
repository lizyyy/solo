from __future__ import annotations

import csv
import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class AuditEntry:
    timestamp: str
    operation: str
    success: bool
    message: str
    source_ref: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    file_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "operation": self.operation,
            "success": self.success,
            "message": self.message,
            "source_ref": self.source_ref,
            "details": self.details,
            "file_hash": self.file_hash,
        }


class AuditLog:
    def __init__(self, output_dir: Optional[str] = None):
        self.entries: List[AuditEntry] = []
        self.output_dir = output_dir or "audit_logs"

    def record(
        self,
        operation: str,
        success: bool,
        message: str,
        source_ref: str = "",
        details: Optional[Dict] = None,
        file_path: Optional[str] = None,
    ):
        entry = AuditEntry(
            timestamp=datetime.now().isoformat(timespec="microseconds"),
            operation=operation,
            success=success,
            message=message,
            source_ref=source_ref,
            details=details or {},
            file_hash=self._hash_file(file_path) if file_path else "",
        )
        self.entries.append(entry)

    def info(self, operation: str, message: str, **kwargs):
        self.record(operation, True, message, **kwargs)

    def warning(self, operation: str, message: str, **kwargs):
        self.record(operation, True, f"[WARN] {message}", **kwargs)

    def error(self, operation: str, message: str, **kwargs):
        self.record(operation, False, message, **kwargs)

    def export_json(self, path: str) -> str:
        final_path = self._ensure_path(path)
        data = {
            "version": "1.0",
            "exported_at": datetime.now().isoformat(),
            "total_entries": len(self.entries),
            "entries": [e.to_dict() for e in self.entries],
        }
        Path(final_path).parent.mkdir(parents=True, exist_ok=True)
        with open(final_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        self.info(
            "export_audit",
            f"审计日志已导出: {final_path}",
            source_ref=final_path,
        )
        return final_path

    def export_csv(self, path: str) -> str:
        final_path = self._ensure_path(path)
        Path(final_path).parent.mkdir(parents=True, exist_ok=True)
        fieldnames = [
            "timestamp",
            "operation",
            "success",
            "message",
            "source_ref",
            "file_hash",
            "details",
        ]
        with open(final_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for e in self.entries:
                d = e.to_dict()
                d["details"] = json.dumps(d["details"], ensure_ascii=False)
                writer.writerow(d)
        self.info(
            "export_audit",
            f"审计日志已导出: {final_path}",
            source_ref=final_path,
        )
        return final_path

    def _ensure_path(self, path: str) -> str:
        p = Path(path)
        if not p.is_absolute():
            p = Path(self.output_dir) / p
        return str(p)

    def _hash_file(self, file_path: str) -> str:
        try:
            with open(file_path, "rb") as f:
                return hashlib.sha256(f.read()).hexdigest()[:16]
        except Exception:
            return ""

    def get_summary(self) -> Dict[str, int]:
        result: Dict[str, int] = {"total": len(self.entries), "success": 0, "error": 0}
        for e in self.entries:
            key = "success" if e.success else "error"
            result[key] += 1
        return result
