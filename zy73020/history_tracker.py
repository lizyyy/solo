from __future__ import annotations

import copy
import uuid
from datetime import datetime, timedelta
from dataclasses import asdict
from typing import Optional

from sample_data import (
    PetRecord,
    VaccinePhoto,
    MedicationReminder,
    WeightCheckItem,
    ReviewHistory,
    SAMPLE_INITIAL_HISTORY,
)
from review_engine import (
    RecordConclusion,
    EvidenceGap,
    AliasDuplicateBlock,
)


def _ts() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _new_id(prefix: str = "H") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


class HistoryTracker:
    def __init__(self, initial_history: Optional[list[ReviewHistory]] = None):
        self._history: list[ReviewHistory] = list(initial_history or SAMPLE_INITIAL_HISTORY)
        self._counters: dict[str, int] = {}
        for h in self._history:
            if h.record_id not in self._counters or self._counters[h.record_id] < h.version:
                self._counters[h.record_id] = h.version

    def current_version(self, record_id: str) -> int:
        return self._counters.get(record_id, 0)

    def all_history(self) -> list[ReviewHistory]:
        return sorted(self._history, key=lambda h: (h.record_id, h.version))

    def history_for(self, record_id: str) -> list[ReviewHistory]:
        return sorted(
            [h for h in self._history if h.record_id == record_id],
            key=lambda h: h.version,
        )

    def add_version(
        self,
        record_id: str,
        action: str,
        operator: str,
        old_snapshot: dict,
        new_snapshot: dict,
        change_reason: str,
        attached_evidence: list[str],
    ) -> ReviewHistory:
        new_version = self.current_version(record_id) + 1
        entry = ReviewHistory(
            history_id=_new_id("H"),
            record_id=record_id,
            version=new_version,
            action=action,
            operator=operator,
            timestamp=_ts(),
            old_snapshot=copy.deepcopy(old_snapshot),
            new_snapshot=copy.deepcopy(new_snapshot),
            change_reason=change_reason,
            attached_evidence=list(attached_evidence),
        )
        self._history.append(entry)
        self._counters[record_id] = new_version
        return entry

    def apply_manual_remark(
        self,
        photos: list[VaccinePhoto],
        record_id: str,
        photo_id: str,
        remark_text: str,
        operator: str,
        old_conclusion: RecordConclusion,
        new_conclusion: RecordConclusion,
        extra_evidence: list[str],
        change_reason: str,
    ) -> tuple[Optional[VaccinePhoto], Optional[ReviewHistory]]:
        target = next((p for p in photos if p.record_id == record_id and p.photo_id == photo_id), None)
        if target is None:
            return None, None

        old_remark = target.manual_remark
        target.manual_remark = remark_text

        old_snapshot = {
            "conclusion": old_conclusion.conclusion,
            "status": old_conclusion.overall_status,
            "confidence": old_conclusion.confidence_level,
            "flags": list(old_conclusion.flags),
            "recommendation": old_conclusion.recommendation,
            "photo_remark_before": old_remark,
        }
        new_snapshot = {
            "conclusion": new_conclusion.conclusion,
            "status": new_conclusion.overall_status,
            "confidence": new_conclusion.confidence_level,
            "flags": list(new_conclusion.flags),
            "recommendation": new_conclusion.recommendation,
            "photo_remark_after": remark_text,
            "photo_id": photo_id,
        }
        evidence = [photo_id] + list(extra_evidence)
        history = self.add_version(
            record_id=record_id,
            action="补疫苗本照片备注并重新判结论",
            operator=operator,
            old_snapshot=old_snapshot,
            new_snapshot=new_snapshot,
            change_reason=change_reason,
            attached_evidence=evidence,
        )
        return target, history

    def version_map(self) -> dict[str, int]:
        return dict(self._counters)


def format_history_diff(h: ReviewHistory) -> str:
    lines = [
        f"  版本 v{h.version}  [{h.action}] @ {h.timestamp} by {h.operator}",
        f"    改判原因: {h.change_reason or '（未填）'}",
        f"    关联证据: {', '.join(h.attached_evidence) if h.attached_evidence else '无'}",
    ]

    old = h.old_snapshot
    new = h.new_snapshot

    if old:
        lines.append("    ┌── 旧材料快照 ──┐")
        for k, v in old.items():
            if isinstance(v, list):
                lines.append(f"    │ {k:<20s}: {', '.join(str(x) for x in v) or '—'}")
            else:
                lines.append(f"    │ {k:<20s}: {v or '—'}")
        lines.append("    └──────────────────┘")

    changed_keys = set(new.keys()) & set(old.keys()) if old else set(new.keys())
    only_new = set(new.keys()) - set(old.keys()) if old else set(new.keys())

    if new:
        lines.append("    ┌── 新材料/备注 ──┐")
        for k in sorted(set(list(changed_keys) + list(only_new))):
            v = new.get(k)
            old_v = old.get(k) if old else None
            marker = "  "
            if k in changed_keys and old_v != v:
                marker = "🔄"
            elif k in only_new:
                marker = "🆕"
            if isinstance(v, list):
                lines.append(f"    │ {marker} {k:<18s}: {', '.join(str(x) for x in v) or '—'}")
            else:
                lines.append(f"    │ {marker} {k:<18s}: {v or '—'}")
        lines.append("    └──────────────────┘")

    return "\n".join(lines)
