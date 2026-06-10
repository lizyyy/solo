from __future__ import annotations

from datetime import datetime

from .models import AuditLogEntry, BladeReport, JudgmentChange


class AuditTrail:
    def __init__(self) -> None:
        self._entries: list[AuditLogEntry] = []

    def log_action(
        self,
        report_id: str,
        action: str,
        operator: str = "",
        detail: str = "",
        changes: list[JudgmentChange] | None = None,
    ) -> AuditLogEntry:
        entry = AuditLogEntry(
            report_id=report_id,
            action=action,
            operator=operator,
            timestamp=datetime.now(),
            changes=changes or [],
            detail=detail,
        )
        self._entries.append(entry)
        return entry

    def log_change(
        self,
        report_id: str,
        material_id: str,
        change: JudgmentChange,
    ) -> AuditLogEntry:
        change.changed_at = datetime.now()
        entry = AuditLogEntry(
            report_id=report_id,
            action=f"material_{change.field_name}_changed",
            operator=change.changed_by,
            changes=[change],
            detail=f"material={material_id} | {change.field_name}: '{change.old_value}' -> '{change.new_value}'",
        )
        self._entries.append(entry)
        return entry

    def log_judgment_change(
        self,
        report_id: str,
        field_name: str,
        old_value: str,
        new_value: str,
        operator: str = "",
        reason: str = "",
    ) -> AuditLogEntry:
        change = JudgmentChange(
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=operator,
            reason=reason,
        )
        entry = AuditLogEntry(
            report_id=report_id,
            action="judgment_changed",
            operator=operator,
            changes=[change],
            detail=f"{field_name}: '{old_value}' -> '{new_value}' | reason: {reason}",
        )
        self._entries.append(entry)
        return entry

    def get_report_history(self, report_id: str) -> list[AuditLogEntry]:
        return [e for e in self._entries if e.report_id == report_id]

    def get_judgment_diff(self, report_id: str) -> list[JudgmentChange]:
        changes: list[JudgmentChange] = []
        for entry in self._entries:
            if entry.report_id == report_id:
                changes.extend(entry.changes)
        return changes

    def get_all_entries(self) -> list[AuditLogEntry]:
        return list(self._entries)
