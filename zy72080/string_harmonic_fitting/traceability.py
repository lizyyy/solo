import json
from datetime import datetime
from typing import List, Optional


class TraceLog:
    def __init__(self):
        self.entries: List[dict] = []

    def add(
        self,
        action: str,
        source: str,
        detail: str,
        operator: str = "",
        extra: Optional[dict] = None,
    ):
        entry = {
            "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "action": action,
            "source": source,
            "detail": detail,
            "operator": operator,
        }
        if extra:
            entry["extra"] = extra
        self.entries.append(entry)

    def to_list(self):
        return self.entries

    def to_json(self, indent=2):
        return json.dumps(self.entries, ensure_ascii=False, indent=indent)

    def save(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.entries, f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, path: str):
        tl = cls()
        with open(path, "r", encoding="utf-8") as f:
            tl.entries = json.load(f)
        return tl

    def format_readable(self):
        lines = []
        for e in self.entries:
            ts = e["timestamp"]
            act = e["action"]
            src = e["source"]
            det = e["detail"]
            op = e.get("operator", "")
            op_str = f" [{op}]" if op else ""
            extra = e.get("extra")
            extra_str = ""
            if extra:
                parts = [f"{k}={v}" for k, v in extra.items()]
                extra_str = f" ({', '.join(parts)})"
            lines.append(f"[{ts}] {act}{op_str}: {det} | 来源={src}{extra_str}")
        return "\n".join(lines)
