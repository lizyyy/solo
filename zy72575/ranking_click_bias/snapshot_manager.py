"""
特征快照管理模块 - 负责快照的导入、去重、查询和更新
"""
import json
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any, TYPE_CHECKING
from datetime import datetime
import hashlib

from .models import (
    SnapshotRecord,
    ProcessingStatus,
    WorkflowStep,
    WorkflowState,
)

if TYPE_CHECKING:
    from .history_tracker import HistoryTracker


class SnapshotManager:
    def __init__(self, data_dir: str = "data/snapshots", history_tracker: Optional["HistoryTracker"] = None):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.records_file = self.data_dir / "records.json"
        self._records: Dict[str, SnapshotRecord] = {}
        self._history_tracker = history_tracker
        self._load_records()

    def set_history_tracker(self, history_tracker: "HistoryTracker"):
        self._history_tracker = history_tracker

    def _load_records(self):
        if self.records_file.exists():
            with open(self.records_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for snapshot_id, record_data in data.items():
                    self._records[snapshot_id] = SnapshotRecord.from_dict(record_data)

    def _save_records(self):
        data = {
            snapshot_id: record.to_dict()
            for snapshot_id, record in self._records.items()
        }
        with open(self.records_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _compute_snapshot_hash(self, raw_data: Dict[str, Any]) -> str:
        sorted_items = sorted(raw_data.items())
        hash_input = json.dumps(sorted_items, sort_keys=True)
        return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

    def import_snapshots(
        self,
        snapshots_data: List[Dict[str, Any]],
        source: str = "manual",
        imported_by: str = "system",
    ) -> Tuple[List[SnapshotRecord], List[SnapshotRecord]]:
        imported = []
        skipped = []

        for idx, raw_data in enumerate(snapshots_data):
            original_line_number = idx + 1
            snapshot_id = raw_data.get("snapshot_id") or self._compute_snapshot_hash(raw_data)
            snapshot_id = str(snapshot_id)

            if snapshot_id in self._records:
                existing = self._records[snapshot_id]
                skipped.append(existing)
                continue

            record = SnapshotRecord(
                snapshot_id=snapshot_id,
                original_line_number=original_line_number,
                raw_data=raw_data,
                status=ProcessingStatus.IMPORTED,
                workflow_step=WorkflowStep.STEP_1_IMPORT,
                workflow_state=WorkflowState.IN_PROGRESS,
            )
            record.custom_fields["import_source"] = source
            record.custom_fields["imported_by"] = imported_by

            self._records[snapshot_id] = record
            imported.append(record)

        self._save_records()
        return imported, skipped

    def get_snapshot(self, snapshot_id: str) -> Optional[SnapshotRecord]:
        return self._records.get(snapshot_id)

    def list_snapshots(
        self,
        status: Optional[ProcessingStatus] = None,
        workflow_step: Optional[WorkflowStep] = None,
    ) -> List[SnapshotRecord]:
        records = list(self._records.values())
        if status:
            records = [r for r in records if r.status == status]
        if workflow_step:
            records = [r for r in records if r.workflow_step == workflow_step]
        return sorted(records, key=lambda r: r.imported_at)

    def update_snapshot(
        self,
        snapshot_id: str,
        updates: Dict[str, Any],
        updated_by: str,
        change_reason: str = "",
    ) -> Optional[SnapshotRecord]:
        if snapshot_id not in self._records:
            return None

        record = self._records[snapshot_id]
        old_record_copy = SnapshotRecord.from_dict(record.to_dict())
        old_values = {}

        for key, value in updates.items():
            if hasattr(record, key):
                old_values[key] = getattr(record, key)
                setattr(record, key, value)

        record.custom_fields["last_updated_by"] = updated_by
        record.custom_fields["last_updated_at"] = datetime.now().isoformat()
        record.custom_fields["last_change_reason"] = change_reason

        self._save_records()

        if self._history_tracker is not None and old_values:
            self._history_tracker.record_changes_from_update(
                old_record_copy, record, updated_by, change_reason
            )
            self._history_tracker.record_audit(
                snapshot_id,
                action="snapshot_updated",
                actor=updated_by,
                details={"changes": old_values, "reason": change_reason},
                before_state=old_record_copy.to_dict(),
                after_state=record.to_dict(),
            )

        return record

    def mark_for_review(
        self,
        snapshot_id: str,
        reason: str,
        assigned_to: str,
    ) -> Optional[SnapshotRecord]:
        return self.update_snapshot(
            snapshot_id,
            {
                "status": ProcessingStatus.NEEDS_REVIEW,
                "assigned_to": assigned_to,
                "notes": reason,
            },
            updated_by="system",
            change_reason=reason,
        )

    def approve_review(
        self,
        snapshot_id: str,
        reviewed_by: str,
        review_notes: str = "",
    ) -> Optional[SnapshotRecord]:
        return self.update_snapshot(
            snapshot_id,
            {
                "status": ProcessingStatus.REVIEW_APPROVED,
                "reviewed_by": reviewed_by,
                "reviewed_at": datetime.now(),
                "notes": review_notes,
            },
            updated_by=reviewed_by,
            change_reason="review_approved",
        )

    def reject_review(
        self,
        snapshot_id: str,
        reviewed_by: str,
        review_notes: str = "",
    ) -> Optional[SnapshotRecord]:
        return self.update_snapshot(
            snapshot_id,
            {
                "status": ProcessingStatus.REVIEW_REJECTED,
                "reviewed_by": reviewed_by,
                "reviewed_at": datetime.now(),
                "notes": review_notes,
            },
            updated_by=reviewed_by,
            change_reason="review_rejected",
        )

    def rollback(
        self,
        snapshot_id: str,
        rolled_back_by: str,
        rollback_reason: str,
    ) -> Optional[SnapshotRecord]:
        return self.update_snapshot(
            snapshot_id,
            {
                "status": ProcessingStatus.ROLLED_BACK,
                "notes": f"已回滚: {rollback_reason}",
            },
            updated_by=rolled_back_by,
            change_reason=f"rollback: {rollback_reason}",
        )

    def get_import_batch(self, batch_id: str) -> List[SnapshotRecord]:
        return [
            r for r in self._records.values()
            if r.import_batch_id == batch_id
        ]

    def get_snapshots_with_missing_features(self) -> List[SnapshotRecord]:
        return [
            r for r in self._records.values()
            if r.missing_features or r.default_score_applied
        ]

    def get_statistics(self) -> Dict[str, Any]:
        total = len(self._records)
        by_status = {}
        for status in ProcessingStatus:
            count = len([r for r in self._records.values() if r.status == status])
            if count > 0:
                by_status[status.value] = count

        with_default_score = len(
            [r for r in self._records.values() if r.default_score_applied]
        )
        with_missing_features = len(
            [r for r in self._records.values() if r.missing_features]
        )
        needs_review = len(
            [r for r in self._records.values() if r.status == ProcessingStatus.NEEDS_REVIEW]
        )

        return {
            "total": total,
            "by_status": by_status,
            "with_default_score": with_default_score,
            "with_missing_features": with_missing_features,
            "needs_review": needs_review,
        }
