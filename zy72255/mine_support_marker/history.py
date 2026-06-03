from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from mine_support_marker.models import ChangeEntry, MarkerRecord
from mine_support_marker.repository import MarkerRepository


@dataclass
class HistoryDiff:
    field_name: str
    old_value: Any
    new_value: Any
    changed_by: str
    changed_at: str
    reason: str


@dataclass
class FieldHistory:
    photo_number: str
    field_name: str
    entries: list[HistoryDiff]

    @property
    def has_changes(self) -> bool:
        return len(self.entries) > 0

    def latest(self) -> Optional[HistoryDiff]:
        if not self.entries:
            return None
        return self.entries[-1]


class HistoryService:
    def __init__(self, repo: MarkerRepository) -> None:
        self._repo = repo

    def edit_field(
        self,
        marker_id: str,
        field_name: str,
        new_value: Any,
        operator: str,
        reason: str = "",
    ) -> Optional[ChangeEntry]:
        record = self._repo.get(marker_id)
        if record is None:
            return None
        if record.is_field_confirmed(field_name):
            return None
        entry = record.apply_change(field_name, new_value, operator, reason)
        return entry

    def get_field_history(
        self, marker_id: str, field_name: str
    ) -> Optional[FieldHistory]:
        record = self._repo.get(marker_id)
        if record is None:
            return None
        entries = record.get_history_for_field(field_name)
        return FieldHistory(
            photo_number=record.photo_number,
            field_name=field_name,
            entries=[
                HistoryDiff(
                    field_name=e.field_name,
                    old_value=e.old_value,
                    new_value=e.new_value,
                    changed_by=e.changed_by,
                    changed_at=e.changed_at.isoformat(),
                    reason=e.reason,
                )
                for e in entries
            ],
        )

    def get_full_history(self, marker_id: str) -> Optional[list[HistoryDiff]]:
        record = self._repo.get(marker_id)
        if record is None:
            return None
        return [
            HistoryDiff(
                field_name=e.field_name,
                old_value=e.old_value,
                new_value=e.new_value,
                changed_by=e.changed_by,
                changed_at=e.changed_at.isoformat(),
                reason=e.reason,
            )
            for e in record.change_history
        ]

    def rollback_field(
        self, marker_id: str, field_name: str, operator: str, reason: str = ""
    ) -> Optional[ChangeEntry]:
        record = self._repo.get(marker_id)
        if record is None:
            return None
        history = record.get_history_for_field(field_name)
        if not history:
            return None
        original_value = history[0].old_value
        entry = record.apply_change(
            field_name, original_value, operator, reason or "rollback to original"
        )
        return entry

    def rollback_to_entry(
        self,
        marker_id: str,
        field_name: str,
        target_index: int,
        operator: str,
        reason: str = "",
    ) -> Optional[ChangeEntry]:
        record = self._repo.get(marker_id)
        if record is None:
            return None
        history = record.get_history_for_field(field_name)
        if target_index < 0 or target_index >= len(history):
            return None
        target_value = history[target_index].old_value
        entry = record.apply_change(
            field_name, target_value, operator, reason or f"rollback to entry {target_index}"
        )
        return entry
