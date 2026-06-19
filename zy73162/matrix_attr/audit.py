from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import uuid

from .models import (
    AttrStatus,
    AuditEntry,
    AttributionRecord,
    SourceType,
)


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@dataclass
class AuditTrail:
    entries: List[AuditEntry] = field(default_factory=list)
    _by_record: Dict[str, List[AuditEntry]] = field(default_factory=dict)

    def log(
        self,
        record: AttributionRecord,
        operator: str,
        source_ref: str,
        new_status: Optional[AttrStatus] = None,
        new_cause: Optional[str] = None,
        note: str = "",
    ) -> AuditEntry:
        old_status: Optional[AttrStatus] = record.status
        old_cause: Optional[str] = record.primary_cause

        status = new_status if new_status is not None else record.status
        cause = new_cause if new_cause is not None else record.primary_cause

        changed = status != old_status or cause != old_cause

        entry = AuditEntry(
            audit_id=_new_id("aud"),
            record_id=record.record_id,
            operator=operator,
            old_status=old_status,
            new_status=status,
            old_primary_cause=old_cause,
            new_primary_cause=cause,
            source_ref=source_ref,
            note=note,
        )
        self.entries.append(entry)
        self._by_record.setdefault(record.record_id, []).append(entry)

        if new_status is not None and new_status != record.status:
            record.status = new_status
        if new_cause is not None and new_cause != record.primary_cause:
            record.primary_cause = new_cause
            record.revision_count += 1
        if changed:
            record.touch()

        return entry

    def history(self, record_id: str) -> List[AuditEntry]:
        return list(self._by_record.get(record_id, []))

    def current_state(self, record_id: str) -> Optional[AuditEntry]:
        hist = self._by_record.get(record_id, [])
        return hist[-1] if hist else None

    def who_changed_cause(self, record_id: str) -> List[AuditEntry]:
        return [
            e
            for e in self._by_record.get(record_id, [])
            if e.old_primary_cause != e.new_primary_cause
        ]

    def sources_of_change(self, record_id: str) -> List[Dict]:
        result = []
        for e in self._by_record.get(record_id, []):
            result.append(
                {
                    "audit_id": e.audit_id,
                    "operator": e.operator,
                    "source_ref": e.source_ref,
                    "old_status": e.old_status.value if e.old_status else None,
                    "new_status": e.new_status.value,
                    "old_cause": e.old_primary_cause,
                    "new_cause": e.new_primary_cause,
                    "note": e.note,
                    "at": e.created_at.isoformat(timespec="seconds"),
                }
            )
        return result

    def mark_released(
        self, record: AttributionRecord, operator: str, note: str = ""
    ) -> AuditEntry:
        return self.log(
            record,
            operator=operator,
            source_ref="manual:release",
            new_status=AttrStatus.RELEASED,
            note=note,
        )

    def mark_need_material(
        self, record: AttributionRecord, operator: str, missing: str
    ) -> AuditEntry:
        return self.log(
            record,
            operator=operator,
            source_ref="manual:need_material",
            new_status=AttrStatus.NEED_MATERIAL,
            note=f"需补充材料: {missing}",
        )
