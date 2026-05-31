import json
import os
from datetime import datetime
from typing import Optional


class AuditLog:
    def __init__(self, log_dir: str):
        self.log_dir = log_dir
        os.makedirs(log_dir, exist_ok=True)
        self.log_path = os.path.join(log_dir, "audit_log.jsonl")
        self._ensure_file()

    def _ensure_file(self):
        if not os.path.exists(self.log_path):
            with open(self.log_path, "w", encoding="utf-8") as f:
                pass

    def append(self, record_id: str, action: str, detail: str,
               before: str = None, after: str = None, extra: dict = None):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "record_id": record_id,
            "action": action,
            "detail": detail,
            "before_value": before,
            "after_value": after,
        }
        if extra:
            entry.update(extra)
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def read_all(self) -> list:
        entries = []
        if not os.path.exists(self.log_path):
            return entries
        with open(self.log_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        return entries

    def read_for_record(self, record_id: str) -> list:
        return [e for e in self.read_all() if e.get("record_id") == record_id]
