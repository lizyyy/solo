from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Any, Optional
from config import TIME_WINDOW_HOURS, MAX_DROPOUT_THRESHOLD
from models import FeatureSnapshot, TrainingLog, DropoutRecord, DropoutStatus
from storage import StorageManager


class DropoutDetector:
    def __init__(self, storage: StorageManager):
        self.storage = storage

    def detect_time_window_crossing(
        self,
        snapshots: List[FeatureSnapshot],
        training_logs: List[TrainingLog]
    ) -> Tuple[bool, Dict[str, Any]]:
        if not snapshots or not training_logs:
            return False, {}

        snapshot_times = [s.timestamp for s in snapshots]
        log_times = [l.timestamp for l in training_logs]

        all_times = snapshot_times + log_times
        if not all_times:
            return False, {}

        min_time = min(all_times)
        max_time = max(all_times)
        time_span = max_time - min_time

        window = timedelta(hours=TIME_WINDOW_HOURS)
        crossed = time_span > window

        details = {
            "min_time": min_time.isoformat(),
            "max_time": max_time.isoformat(),
            "time_span_hours": time_span.total_seconds() / 3600,
            "allowed_window_hours": TIME_WINDOW_HOURS,
            "snapshot_count": len(snapshots),
            "log_count": len(training_logs),
            "crossed": crossed
        }

        return crossed, details

    def calculate_anomaly_score(
        self,
        client_snapshots: List[FeatureSnapshot],
        all_snapshots: List[FeatureSnapshot],
        training_logs: List[TrainingLog]
    ) -> float:
        score = 0.0

        if len(all_snapshots) > 0:
            client_ratio = len(client_snapshots) / len(all_snapshots)
            if client_ratio < (1 - MAX_DROPOUT_THRESHOLD):
                score += 0.5

        if training_logs:
            losses = [l.loss for l in training_logs]
            if losses:
                avg_loss = sum(losses) / len(losses)
                if avg_loss > 2.0:
                    score += 0.3

            accuracies = [l.accuracy for l in training_logs]
            if accuracies and len(accuracies) >= 2:
                acc_drop = accuracies[0] - accuracies[-1]
                if acc_drop > 0.2:
                    score += 0.2

        return min(score, 1.0)

    def check_boundary_rules(
        self,
        client_id: str,
        round_num: int
    ) -> Dict[str, Any]:
        client_snapshots = self.storage.list_snapshots(client_id=client_id)
        all_snapshots = self.storage.list_snapshots()
        training_logs = self.storage.list_training_logs(client_id=client_id, round_num=round_num)

        client_snapshots_round = [s for s in client_snapshots if s.round_num == round_num]
        all_snapshots_round = [s for s in all_snapshots if s.round_num == round_num]

        time_crossed, time_details = self.detect_time_window_crossing(
            client_snapshots_round, training_logs
        )

        anomaly_score = self.calculate_anomaly_score(
            client_snapshots_round, all_snapshots_round, training_logs
        )

        rules_triggered = []
        final_status = DropoutStatus.NORMAL

        if time_crossed:
            rules_triggered.append("TIME_WINDOW_CROSSED")
            final_status = DropoutStatus.TIME_WINDOW_CROSSED

        if anomaly_score > 0.6:
            rules_triggered.append("HIGH_ANOMALY_SCORE")
            if final_status == DropoutStatus.NORMAL:
                final_status = DropoutStatus.SUSPICIOUS_PATTERN

        if final_status in [DropoutStatus.TIME_WINDOW_CROSSED, DropoutStatus.SUSPICIOUS_PATTERN]:
            final_status = DropoutStatus.PENDING_REVIEW

        return {
            "status": final_status,
            "time_window_crossed": time_crossed,
            "time_window_details": time_details,
            "anomaly_score": anomaly_score,
            "rules_triggered": rules_triggered,
            "snapshot_ids": [s.snapshot_id for s in client_snapshots_round],
            "log_ids": [l.log_id for l in training_logs]
        }

    def create_dropout_record(
        self,
        client_id: str,
        round_num: int,
        detected_by: str,
        remarks: str = ""
    ) -> DropoutRecord:
        boundary_result = self.check_boundary_rules(client_id, round_num)

        record_id = self.storage._gen_id()
        record = DropoutRecord(
            record_id=record_id,
            client_id=client_id,
            round_num=round_num,
            status=boundary_result["status"],
            snapshot_ids=boundary_result["snapshot_ids"],
            log_ids=boundary_result["log_ids"],
            remarks=remarks,
            detected_by=detected_by,
            anomaly_score=boundary_result["anomaly_score"],
            time_window_crossed=boundary_result["time_window_crossed"],
            time_window_details=boundary_result["time_window_details"]
        )

        return self.storage.save_dropout_record(record)

    def get_visualization_data(self, record_id: str) -> Dict[str, Any]:
        record = self.storage.get_dropout_record(record_id)
        if not record:
            return {}

        snapshots = [self.storage.get_snapshot(sid) for sid in record.snapshot_ids]
        snapshots = [s for s in snapshots if s]

        logs = [self.storage.get_training_log(lid) for lid in record.log_ids]
        logs = [l for l in logs if l]

        return {
            "record": record.model_dump(mode='json'),
            "snapshots": [s.model_dump(mode='json') for s in snapshots],
            "training_logs": [l.model_dump(mode='json') for l in logs],
            "navigable_refs": {
                "snapshot_ids": record.snapshot_ids,
                "log_ids": record.log_ids
            }
        }
