from __future__ import annotations

from datetime import datetime

from .models import BarrierJudgment, HistoryEntry, JudgmentStatus


class HistoryManager:
    def __init__(self) -> None:
        self._entries: list[HistoryEntry] = []

    def record(
        self,
        contract_id: str,
        field_changed: str,
        old_value: object,
        new_value: object,
        changed_by: str,
        changed_at: datetime | None = None,
        reason: str | None = None,
    ) -> HistoryEntry:
        entry = HistoryEntry(
            contract_id=contract_id,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            changed_at=changed_at or datetime.now(),
            reason=reason,
        )
        self._entries.append(entry)
        return entry

    def record_override(
        self,
        old_judgment: BarrierJudgment,
        new_status: JudgmentStatus,
        new_breach_type: str | None,
        changed_by: str,
        reason: str,
        changed_at: datetime | None = None,
    ) -> HistoryEntry:
        _at = changed_at or datetime.now()
        return self.record(
            contract_id=old_judgment.contract_id,
            field_changed="barrier_judgment_override",
            old_value=old_judgment.status.value,
            new_value=new_status.value,
            changed_by=changed_by,
            changed_at=_at,
            reason=reason,
        )

    @property
    def entries(self) -> list[HistoryEntry]:
        return list(self._entries)

    def get_entries_for_contract(
        self, contract_id: str
    ) -> list[HistoryEntry]:
        return [
            e for e in self._entries if e.contract_id == contract_id
        ]

    def to_dicts(self) -> list[dict]:
        return [e.to_dict() for e in self._entries]

    @classmethod
    def from_dicts(cls, dicts: list[dict]) -> HistoryManager:
        mgr = cls()
        mgr._entries = [HistoryEntry.from_dict(d) for d in dicts]
        return mgr
