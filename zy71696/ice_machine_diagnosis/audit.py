from __future__ import annotations

import json
import os
from datetime import datetime
from typing import List, Optional

from .models import AuditEntry


class AuditTrail:
    """
    审计日志模块

    设计原则:
    - 所有数据处理操作必须留痕
    - 审计记录不可自动覆盖(append-only)
    - 每条记录包含: 原始值、调整值、原因、方法、操作者、是否可被人工覆盖
    - 导出时审计日志与诊断结果一同输出, 不需要反查数据库
    """

    def __init__(self, entries: Optional[List[AuditEntry]] = None):
        self.entries: List[AuditEntry] = entries or []

    def add(self, entry: AuditEntry) -> None:
        self.entries.append(entry)

    def to_dict_list(self) -> List[dict]:
        return [e.to_dict() for e in self.entries]

    def save(self, filepath: str) -> None:
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else ".", exist_ok=True)
        with open(filepath, "a", encoding="utf-8") as f:
            for entry in self.entries:
                f.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")

    def load(self, filepath: str) -> None:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                d = json.loads(line)
                self.entries.append(
                    AuditEntry(
                        timestamp=datetime.fromisoformat(d["timestamp"]),
                        field=d["field"],
                        original_value=d.get("original_value"),
                        adjusted_value=d.get("adjusted_value"),
                        reason=d["reason"],
                        method=d["method"],
                        operator=d.get("operator", "system"),
                        can_override=d.get("can_override", False),
                    )
                )

    def get_by_field(self, field_name: str) -> List[AuditEntry]:
        return [e for e in self.entries if e.field == field_name]

    def get_by_method(self, method_name: str) -> List[AuditEntry]:
        return [e for e in self.entries if e.method == method_name]

    def summary(self) -> dict:
        method_counts = {}
        field_counts = {}
        for e in self.entries:
            method_counts[e.method] = method_counts.get(e.method, 0) + 1
            field_counts[e.field] = field_counts.get(e.field, 0) + 1
        return {
            "total_entries": len(self.entries),
            "by_method": method_counts,
            "by_field": field_counts,
        }
