from __future__ import annotations

from .models import AuditEntry


class AuditLog:
    def __init__(self) -> None:
        self.entries: list[AuditEntry] = []

    def add(self, entry: AuditEntry) -> None:
        self.entries.append(entry)

    def get_by_record(self, record_id: str) -> list[AuditEntry]:
        return [e for e in self.entries if e.record_id == record_id]

    def get_by_operator(self, operator: str) -> list[AuditEntry]:
        return [e for e in self.entries if e.changed_by == operator]

    def get_by_change_type(self, change_type: str) -> list[AuditEntry]:
        return [e for e in self.entries if e.change_type == change_type]

    def format_changelog(self) -> list[dict]:
        result = []
        for e in self.entries:
            result.append(
                {
                    "who": e.changed_by,
                    "what": f"{e.change_type}: {e.old_value} -> {e.new_value}",
                    "why": e.reason,
                    "impact": e.affected_results,
                    "when": e.changed_at.isoformat(),
                }
            )
        return result
