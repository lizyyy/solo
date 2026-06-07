"""
历史变更追踪模块 - 记录所有字段变更，支持改前改后对比
"""
import json
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime
import copy

from .models import (
    ChangeRecord,
    AuditTrail,
    SnapshotRecord,
)


class HistoryTracker:
    def __init__(self, history_dir: str = "data/history"):
        self.history_dir = Path(history_dir)
        self.history_dir.mkdir(parents=True, exist_ok=True)
        self.changes_file = self.history_dir / "changes.json"
        self.audit_file = self.history_dir / "audit.json"
        self._changes: Dict[str, List[ChangeRecord]] = {}
        self._audit_trails: Dict[str, List[AuditTrail]] = {}
        self._load_history()

    def _load_history(self):
        if self.changes_file.exists():
            with open(self.changes_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for snapshot_id, changes_data in data.items():
                    self._changes[snapshot_id] = [
                        ChangeRecord.from_dict(cd) for cd in changes_data
                    ]

        if self.audit_file.exists():
            with open(self.audit_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for snapshot_id, audit_data in data.items():
                    self._audit_trails[snapshot_id] = [
                        AuditTrail.from_dict(ad) for ad in audit_data
                    ]

    def _save_history(self):
        changes_data = {
            snapshot_id: [c.to_dict() for c in changes]
            for snapshot_id, changes in self._changes.items()
        }
        with open(self.changes_file, "w", encoding="utf-8") as f:
            json.dump(changes_data, f, ensure_ascii=False, indent=2)

        audit_data = {
            snapshot_id: [a.to_dict() for a in audits]
            for snapshot_id, audits in self._audit_trails.items()
        }
        with open(self.audit_file, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)

    def record_change(
        self,
        snapshot_id: str,
        field_name: str,
        old_value: Any,
        new_value: Any,
        changed_by: str,
        change_reason: str = "",
    ) -> ChangeRecord:
        change = ChangeRecord(
            snapshot_id=snapshot_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            change_reason=change_reason,
        )

        if snapshot_id not in self._changes:
            self._changes[snapshot_id] = []
        self._changes[snapshot_id].append(change)
        self._save_history()
        return change

    def record_changes_from_update(
        self,
        old_record: SnapshotRecord,
        new_record: SnapshotRecord,
        updated_by: str,
        change_reason: str = "",
    ) -> List[ChangeRecord]:
        changes = []
        old_dict = old_record.to_dict()
        new_dict = new_record.to_dict()

        for key in old_dict.keys():
            if key in ["imported_at", "reviewed_at"]:
                continue
            old_val = old_dict.get(key)
            new_val = new_dict.get(key)
            if old_val != new_val:
                change = self.record_change(
                    snapshot_id=new_record.snapshot_id,
                    field_name=key,
                    old_value=old_val,
                    new_value=new_val,
                    changed_by=updated_by,
                    change_reason=change_reason,
                )
                changes.append(change)

        return changes

    def record_audit(
        self,
        snapshot_id: str,
        action: str,
        actor: str,
        details: Optional[Dict[str, Any]] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
    ) -> AuditTrail:
        audit = AuditTrail(
            snapshot_id=snapshot_id,
            action=action,
            actor=actor,
            details=details or {},
            before_state=before_state,
            after_state=after_state,
        )

        if snapshot_id not in self._audit_trails:
            self._audit_trails[snapshot_id] = []
        self._audit_trails[snapshot_id].append(audit)
        self._save_history()
        return audit

    def get_changes(self, snapshot_id: str) -> List[ChangeRecord]:
        return self._changes.get(snapshot_id, [])

    def get_field_history(
        self,
        snapshot_id: str,
        field_name: str,
    ) -> List[ChangeRecord]:
        changes = self.get_changes(snapshot_id)
        return [c for c in changes if c.field_name == field_name]

    def get_audit_trail(self, snapshot_id: str) -> List[AuditTrail]:
        return self._audit_trails.get(snapshot_id, [])

    def compare_versions(
        self,
        snapshot_id: str,
        change_index_1: int = -2,
        change_index_2: int = -1,
    ) -> Dict[str, Any]:
        changes = self.get_changes(snapshot_id)
        if len(changes) < 2:
            return {"error": "历史记录不足，无法对比"}

        change1 = changes[change_index_1]
        change2 = changes[change_index_2]

        return {
            "snapshot_id": snapshot_id,
            "version_1": {
                "change_id": change1.change_id,
                "changed_at": change1.changed_at.isoformat(),
                "changed_by": change1.changed_by,
                "field": change1.field_name,
                "value": change1.new_value,
                "reason": change1.change_reason,
            },
            "version_2": {
                "change_id": change2.change_id,
                "changed_at": change2.changed_at.isoformat(),
                "changed_by": change2.changed_by,
                "field": change2.field_name,
                "value": change2.new_value,
                "reason": change2.change_reason,
            },
            "diff": {
                "field": change2.field_name,
                "old_value": change1.new_value,
                "new_value": change2.new_value,
                "changed_by": change2.changed_by,
                "time_diff_seconds": (change2.changed_at - change1.changed_at).total_seconds(),
            },
        }

    def get_full_history(self, snapshot_id: str) -> Dict[str, Any]:
        changes = self.get_changes(snapshot_id)
        audits = self.get_audit_trail(snapshot_id)

        return {
            "snapshot_id": snapshot_id,
            "change_count": len(changes),
            "audit_count": len(audits),
            "changes": [
                {
                    "change_id": c.change_id,
                    "field": c.field_name,
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "changed_by": c.changed_by,
                    "changed_at": c.changed_at.isoformat(),
                    "reason": c.change_reason,
                }
                for c in sorted(changes, key=lambda x: x.changed_at)
            ],
            "audit_trail": [
                {
                    "audit_id": a.audit_id,
                    "action": a.action,
                    "actor": a.actor,
                    "timestamp": a.timestamp.isoformat(),
                    "details": a.details,
                }
                for a in sorted(audits, key=lambda x: x.timestamp)
            ],
        }

    def get_notes_history(self, snapshot_id: str) -> List[Dict[str, Any]]:
        note_changes = self.get_field_history(snapshot_id, "notes")
        return [
            {
                "change_id": c.change_id,
                "old_notes": c.old_value,
                "new_notes": c.new_value,
                "changed_by": c.changed_by,
                "changed_at": c.changed_at.isoformat(),
                "reason": c.change_reason,
            }
            for c in note_changes
        ]

    def get_all_snapshots_with_changes(self) -> List[str]:
        return list(self._changes.keys())

    def get_statistics(self) -> Dict[str, Any]:
        total_changes = sum(len(changes) for changes in self._changes.values())
        total_audits = sum(len(audits) for audits in self._audit_trails.values())
        snapshots_with_changes = len(self._changes)

        change_by_field = {}
        for changes in self._changes.values():
            for change in changes:
                field = change.field_name
                change_by_field[field] = change_by_field.get(field, 0) + 1

        return {
            "total_changes": total_changes,
            "total_audits": total_audits,
            "snapshots_with_changes": snapshots_with_changes,
            "changes_by_field": change_by_field,
        }
