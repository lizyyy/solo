from __future__ import annotations

import copy
from datetime import datetime
from typing import Any, Dict, List, Optional

from .models import AuditEntry
from .state import AppState


class AuditTrail:
    def __init__(self, state: AppState):
        self.state = state

    def record(
        self,
        action: str,
        description: str,
        before: Optional[Dict[str, Any]] = None,
        after: Optional[Dict[str, Any]] = None,
    ) -> AuditEntry:
        entry = AuditEntry(
            timestamp=datetime.now().isoformat(),
            action=action,
            description=description,
            before_snapshot=before,
            after_snapshot=after,
        )
        self.state.audit_log.append(entry)
        return entry

    def record_recalculate(
        self,
        old_schedule: Optional[Dict[str, Any]],
        new_schedule: Dict[str, Any],
    ) -> AuditEntry:
        return self.record(
            action="recalculate",
            description="重新计算排练方案",
            before=old_schedule,
            after=new_schedule,
        )

    def record_undo(
        self,
        action_being_undone: str,
        before: Dict[str, Any],
        after: Dict[str, Any],
    ) -> AuditEntry:
        return self.record(
            action="undo",
            description=f"撤回操作：{action_being_undone}",
            before=before,
            after=after,
        )

    def record_supplement(
        self,
        data_type: str,
        before: Optional[Dict[str, Any]],
        after: Dict[str, Any],
    ) -> AuditEntry:
        return self.record(
            action="supplement",
            description=f"补录数据：{data_type}",
            before=before,
            after=after,
        )

    def record_load(
        self,
        source: str,
        counts: Dict[str, int],
    ) -> AuditEntry:
        return self.record(
            action="load",
            description=f"加载数据：{source}",
            after=counts,
        )

    def record_filter_change(
        self,
        before: Optional[Dict[str, Any]],
        after: Dict[str, Any],
    ) -> AuditEntry:
        return self.record(
            action="filter_change",
            description="更改筛选条件",
            before=before,
            after=after,
        )

    def get_log(self) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self.state.audit_log]

    def get_by_action(self, action: str) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self.state.audit_log if e.action == action]

    def replay(self, up_to_index: Optional[int] = None) -> List[Dict[str, Any]]:
        log = self.state.audit_log
        if up_to_index is not None:
            log = log[:up_to_index + 1]
        return [e.to_dict() for e in log]

    def diff_entries(self, index_a: int, index_b: int) -> Dict[str, Any]:
        log = self.state.audit_log
        if index_a >= len(log) or index_b >= len(log):
            return {"error": "索引超出审计日志范围"}
        entry_a = log[index_a]
        entry_b = log[index_b]
        return {
            "entry_a": entry_a.to_dict(),
            "entry_b": entry_b.to_dict(),
            "summary": f"对比：{entry_a.description}（{entry_a.timestamp}）vs {entry_b.description}（{entry_b.timestamp}）",
        }

    def undo_last(self) -> Optional[AuditEntry]:
        if not self.state.schedules:
            return None
        removed = self.state.schedules.pop()
        before = removed.to_dict()
        current = self.state.current_schedule()
        after = current.to_dict() if current else None
        return self.record_undo("schedule", before, after)

    def snapshot_state(self) -> Dict[str, Any]:
        return {
            "pieces": self.state.snapshot_pieces(),
            "absences": self.state.snapshot_absences(),
            "schedule": self.state.snapshot_schedule(),
        }
