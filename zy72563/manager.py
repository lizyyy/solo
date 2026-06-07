from datetime import datetime
from typing import List, Optional, Dict, Any
from models import (
    FeatureSnapshot, TrainingLog, DropoutRecord,
    DropoutStatus, ReviewDecision
)
from storage import StorageManager
from detector import DropoutDetector


class DropoutManager:
    def __init__(self):
        self.storage = StorageManager()
        self.detector = DropoutDetector(self.storage)

    def import_feature_snapshots(
        self,
        snapshots: List[Dict[str, Any]],
        imported_by: str
    ) -> Dict[str, Any]:
        imported = []
        skipped = []

        for snap_data in snapshots:
            snapshot_id = snap_data.get('snapshot_id')
            existing = self.storage.get_snapshot(snapshot_id)

            if existing:
                skipped.append({
                    "snapshot_id": snapshot_id,
                    "reason": "already_exists"
                })
                continue

            snapshot = FeatureSnapshot(
                **snap_data,
                imported_by=imported_by,
                import_time=datetime.now()
            )
            saved = self.storage.save_snapshot(snapshot)
            imported.append(saved.model_dump(mode='json'))

        return {
            "imported_count": len(imported),
            "skipped_count": len(skipped),
            "imported": imported,
            "skipped": skipped,
            "note": "重复导入同一批特征快照编号不会增加掉队记录数量"
        }

    def import_training_logs(
        self,
        logs: List[Dict[str, Any]]
    ) -> List[TrainingLog]:
        saved_logs = []
        for log_data in logs:
            log = TrainingLog(**log_data)
            saved_logs.append(self.storage.save_training_log(log))
        return saved_logs

    def detect_and_create_record(
        self,
        client_id: str,
        round_num: int,
        detected_by: str,
        remarks: str = ""
    ) -> DropoutRecord:
        return self.detector.create_dropout_record(client_id, round_num, detected_by, remarks)

    def update_record_field(
        self,
        record_id: str,
        field_name: str,
        new_value: Any,
        updated_by: str
    ) -> Optional[DropoutRecord]:
        record = self.storage.get_dropout_record(record_id)
        if not record:
            return None

        old_value = getattr(record, field_name, None)
        if old_value == new_value:
            return record

        self.storage.add_history_entry(
            record_id=record_id,
            field_name=field_name,
            old_value=old_value.value if isinstance(old_value, DropoutStatus) else old_value,
            new_value=new_value.value if isinstance(new_value, DropoutStatus) else new_value,
            changed_by=updated_by
        )

        setattr(record, field_name, new_value)
        return self.storage.save_dropout_record(record)

    def update_remarks(
        self,
        record_id: str,
        new_remarks: str,
        updated_by: str
    ) -> Optional[DropoutRecord]:
        return self.update_record_field(record_id, "remarks", new_remarks, updated_by)

    def review_record(
        self,
        record_id: str,
        decision: str,
        reviewer: str,
        notes: str = ""
    ) -> Optional[DropoutRecord]:
        record = self.storage.get_dropout_record(record_id)
        if not record:
            return None

        decision_map = {
            "confirm_dropout": DropoutStatus.CONFIRMED_DROPOUT,
            "mark_normal": DropoutStatus.REVIEWED_NORMAL,
            "rollback": DropoutStatus.ROLLED_BACK
        }

        if decision not in decision_map:
            raise ValueError(f"Invalid decision: {decision}. Use one of: {list(decision_map.keys())}")

        new_status = decision_map[decision]

        self.storage.add_history_entry(
            record_id=record_id,
            field_name="status",
            old_value=record.status.value,
            new_value=new_status.value,
            changed_by=reviewer
        )

        record.status = new_status
        record.reviewed_by = reviewer
        record.reviewed_at = datetime.now()
        record.review_notes = notes

        self.storage.save_review_decision(ReviewDecision(
            record_id=record_id,
            decision=decision,
            reviewer=reviewer,
            notes=notes
        ))

        return self.storage.save_dropout_record(record)

    def rollback_record(
        self,
        record_id: str,
        rolled_back_by: str,
        reason: str = ""
    ) -> Optional[DropoutRecord]:
        return self.review_record(record_id, "rollback", rolled_back_by, reason)

    def get_record_history(self, record_id: str) -> List[Dict[str, Any]]:
        entries = self.storage.get_record_history(record_id)
        return [e.model_dump(mode='json') for e in entries]

    def get_record_with_context(self, record_id: str) -> Dict[str, Any]:
        record = self.storage.get_dropout_record(record_id)
        if not record:
            return {}

        snapshots = [self.storage.get_snapshot(sid) for sid in record.snapshot_ids]
        snapshots = [s.model_dump(mode='json') for s in snapshots if s]

        logs = [self.storage.get_training_log(lid) for lid in record.log_ids]
        logs = [l.model_dump(mode='json') for l in logs if l]

        history = self.get_record_history(record_id)

        return {
            "record": record.model_dump(mode='json'),
            "snapshots": snapshots,
            "training_logs": logs,
            "history": history,
            "replay_commands": self._generate_replay_commands(record)
        }

    def _generate_replay_commands(self, record: DropoutRecord) -> List[str]:
        commands = []

        for sid in record.snapshot_ids:
            commands.append(f"python cli.py snapshot show --snapshot-id {sid}")

        for lid in record.log_ids:
            commands.append(f"python cli.py log show --log-id {lid}")

        commands.append(f"python cli.py record show --record-id {record.record_id}")
        commands.append(f"python cli.py record history --record-id {record.record_id}")

        return commands

    def list_pending_reviews(self) -> List[DropoutRecord]:
        return self.storage.list_dropout_records(status=DropoutStatus.PENDING_REVIEW)

    def get_visualization_with_backrefs(self, record_id: str) -> Dict[str, Any]:
        viz_data = self.detector.get_visualization_data(record_id)
        if viz_data:
            viz_data["note"] = "点击数据点可跳转至对应特征快照编号或训练日志曲线，而非仅展示画面"
        return viz_data
