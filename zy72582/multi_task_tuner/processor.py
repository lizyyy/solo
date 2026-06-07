from datetime import datetime
from typing import List, Dict, Optional, Tuple
import uuid

from .models import (
    FeatureSnapshot, TrainingLogCurve, TrainingLogPoint,
    AnomalySample, ExperimentRun, ReviewRecord, RecordStatus
)
from .storage import DataStore
from .detector import classify_record


class MultiTaskTuner:
    def __init__(self, data_dir: str = "./data"):
        self.store = DataStore(data_dir)
        self.action_log: List[Dict] = []

    def _log_action(self, action: str, details: Dict):
        self.action_log.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details
        })

    def import_feature_snapshot(
        self,
        snapshot_id: str,
        features: Dict,
        data_range_start: datetime,
        data_range_end: datetime,
        created_at: Optional[datetime] = None,
        source: str = "main_flow"
    ) -> FeatureSnapshot:
        if created_at is None:
            created_at = datetime.now()
        
        snapshot = FeatureSnapshot(
            snapshot_id=snapshot_id,
            created_at=created_at,
            features=features,
            data_range_start=data_range_start,
            data_range_end=data_range_end,
            source=source
        )
        self.store.save_snapshot(snapshot)
        self._log_action("import_snapshot", {"snapshot_id": snapshot_id, "source": source})
        return snapshot

    def import_training_log(
        self,
        log_id: str,
        experiment_name: str,
        points: List[Dict],
        data_source: str = "on_site"
    ) -> TrainingLogCurve:
        log_points = [
            TrainingLogPoint(
                timestamp=datetime.fromisoformat(p["timestamp"]) if isinstance(p["timestamp"], str) else p["timestamp"],
                epoch=p["epoch"],
                loss=p["loss"],
                metrics=p.get("metrics", {}),
                task_weights=p.get("task_weights", {})
            )
            for p in points
        ]
        log = TrainingLogCurve(
            log_id=log_id,
            experiment_name=experiment_name,
            points=log_points,
            data_source=data_source
        )
        self.store.save_log(log)
        self._log_action("import_log", {"log_id": log_id, "data_source": data_source, "points_count": len(points)})
        return log

    def _generate_sample_id(self) -> str:
        return f"samp_{uuid.uuid4().hex[:8]}"

    def create_anomaly_from_snapshot(
        self,
        snapshot_id: str,
        log_id: Optional[str] = None,
        reference_time: Optional[datetime] = None
    ) -> AnomalySample:
        snapshot = self.store.load_snapshot(snapshot_id)
        if snapshot is None:
            raise ValueError(f"特征快照 {snapshot_id} 不存在")
        
        log = self.store.load_log(log_id) if log_id else None
        
        status, details = classify_record(snapshot, log, reference_time)
        
        base_metrics = snapshot.features.get("expected_metrics", {"auc": 0.75, "f1": 0.68})
        original_metrics = dict(base_metrics)
        
        flags = []
        if status == RecordStatus.TIME_WINDOW_LEAK:
            flags.append("time_window_leak")
            flags.append("inflated_performance")
        elif status == RecordStatus.OLD_METRIC:
            flags.append("old_metric")
        elif status == RecordStatus.PENDING:
            flags.append("awaiting_log")
        
        sample = AnomalySample(
            sample_id=self._generate_sample_id(),
            snapshot_id=snapshot_id,
            log_id=log_id,
            detected_at=datetime.now(),
            status=status,
            metrics=base_metrics,
            original_metrics=original_metrics,
            flags=flags,
            review_note=details if details else None
        )
        self.store.save_anomaly(sample)
        self._log_action("create_anomaly", {
            "sample_id": sample.sample_id,
            "snapshot_id": snapshot_id,
            "log_id": log_id,
            "status": status.value
        })
        return sample

    def supplement_training_log(
        self,
        sample_id: str,
        log_id: str,
        reference_time: Optional[datetime] = None
    ) -> AnomalySample:
        sample = self.store.load_anomaly(sample_id)
        if sample is None:
            raise ValueError(f"异常样本 {sample_id} 不存在")
        
        snapshot = self.store.load_snapshot(sample.snapshot_id)
        log = self.store.load_log(log_id)
        if log is None:
            raise ValueError(f"训练日志 {log_id} 不存在")
        
        old_status = sample.status
        new_status, details = classify_record(snapshot, log, reference_time)
        
        sample.log_id = log_id
        sample.status = new_status
        sample.review_note = details
        
        sample.flags = [f for f in sample.flags if f not in ["awaiting_log"]]
        if new_status == RecordStatus.TIME_WINDOW_LEAK:
            if "time_window_leak" not in sample.flags:
                sample.flags.append("time_window_leak")
                sample.flags.append("inflated_performance")
        elif new_status == RecordStatus.OLD_METRIC:
            if "old_metric" not in sample.flags:
                sample.flags.append("old_metric")
        
        self.store.save_anomaly(sample)
        self._log_action("supplement_log", {
            "sample_id": sample_id,
            "log_id": log_id,
            "old_status": old_status.value,
            "new_status": new_status.value
        })
        return sample

    def review_anomaly(
        self,
        sample_id: str,
        reviewer: str,
        action: str,
        note: str
    ) -> tuple[AnomalySample, ReviewRecord]:
        sample = self.store.load_anomaly(sample_id)
        if sample is None:
            raise ValueError(f"异常样本 {sample_id} 不存在")
        
        review = ReviewRecord(
            record_id=f"rev_{uuid.uuid4().hex[:8]}",
            anomaly_sample_id=sample_id,
            reviewer=reviewer,
            action=action,
            note=note,
            timestamp=datetime.now()
        )
        self.store.save_review(review)
        
        if action == "confirm_normal":
            sample.status = RecordStatus.NORMAL
            sample.flags = [f for f in sample.flags if f not in ["time_window_leak", "inflated_performance"]]
        elif action == "mark_leak":
            sample.status = RecordStatus.TIME_WINDOW_LEAK
        elif action == "confirm_leak":
            sample.status = RecordStatus.NEED_REVIEW
            sample.flags.append("reviewer_flagged")
        elif action == "correct":
            sample.status = RecordStatus.CORRECTED
            sample.flags = [f for f in sample.flags if f not in ["time_window_leak", "inflated_performance"]]
            sample.corrected_by = reviewer
            sample.corrected_at = datetime.now()
        
        sample.review_note = note
        self.store.save_anomaly(sample)
        
        self._log_action("review_anomaly", {
            "sample_id": sample_id,
            "reviewer": reviewer,
            "action": action
        })
        return sample, review

    def rerun_experiment(
        self,
        run_type: str,
        task_weights: Dict[str, float],
        snapshot_ids: List[str],
        log_ids: List[str],
        notes: str = ""
    ) -> ExperimentRun:
        run = ExperimentRun(
            run_id=f"run_{uuid.uuid4().hex[:8]}",
            run_type=run_type,
            start_time=datetime.now(),
            end_time=None,
            task_weights=task_weights,
            feature_snapshots=snapshot_ids,
            training_logs=log_ids,
            anomaly_samples=[],
            notes=notes
        )
        
        for sid in snapshot_ids:
            sample = self.create_anomaly_from_snapshot(sid, log_ids[0] if log_ids else None)
            run.anomaly_samples.append(sample.sample_id)
        
        run.end_time = datetime.now()
        self.store.save_run(run)
        
        self._log_action("rerun_experiment", {
            "run_id": run.run_id,
            "run_type": run_type,
            "task_weights": task_weights
        })
        return run

    def get_anomaly_page(self) -> List[Dict]:
        anomaly_ids = self.store.list_anomalies()
        result = []
        for aid in anomaly_ids:
            sample = self.store.load_anomaly(aid)
            if sample is None:
                continue
            snapshot = self.store.load_snapshot(sample.snapshot_id)
            log = self.store.load_log(sample.log_id) if sample.log_id else None
            
            result.append({
                "sample_id": sample.sample_id,
                "snapshot_id": sample.snapshot_id,
                "log_id": sample.log_id,
                "status": sample.status.value,
                "status_label": self._status_label(sample.status),
                "metrics": sample.metrics,
                "original_metrics": sample.original_metrics,
                "flags": sample.flags,
                "review_note": sample.review_note,
                "snapshot_created": snapshot.created_at.isoformat() if snapshot else None,
                "log_points_count": len(log.points) if log else 0,
                "detected_at": sample.detected_at.isoformat(),
                "corrected_by": sample.corrected_by,
                "corrected_at": sample.corrected_at.isoformat() if sample.corrected_at else None
            })
        return sorted(result, key=lambda x: x["detected_at"], reverse=True)

    def _status_label(self, status: RecordStatus) -> str:
        labels = {
            RecordStatus.PENDING: "等待补录",
            RecordStatus.NORMAL: "正常",
            RecordStatus.TIME_WINDOW_LEAK: "时间窗穿越(虚高)",
            RecordStatus.NEED_REVIEW: "待复核",
            RecordStatus.OLD_METRIC: "旧口径数据",
            RecordStatus.CORRECTED: "已修正",
            RecordStatus.RERUN: "已重跑"
        }
        return labels.get(status, status.value)

    def get_action_log(self) -> List[Dict]:
        return list(self.action_log)

    def generate_retrospective(self, run_id: Optional[str] = None) -> Dict:
        retrospective = {
            "generated_at": datetime.now().isoformat(),
            "summary": {},
            "feature_snapshots": [],
            "training_logs": [],
            "anomaly_samples": self.get_anomaly_page(),
            "action_log": self.get_action_log(),
            "replay_commands": []
        }
        
        snapshot_ids = self.store.list_snapshots()
        for sid in snapshot_ids:
            s = self.store.load_snapshot(sid)
            retrospective["feature_snapshots"].append({
                "snapshot_id": s.snapshot_id,
                "created_at": s.created_at.isoformat(),
                "data_range": f"{s.data_range_start.isoformat()} ~ {s.data_range_end.isoformat()}",
                "source": s.source
            })
        
        log_ids = self.store.list_logs()
        for lid in log_ids:
            l = self.store.load_log(lid)
            retrospective["training_logs"].append({
                "log_id": l.log_id,
                "experiment_name": l.experiment_name,
                "points_count": len(l.points),
                "data_source": l.data_source
            })
        
        status_counts = {}
        for a in retrospective["anomaly_samples"]:
            status_counts[a["status"]] = status_counts.get(a["status"], 0) + 1
        retrospective["summary"]["status_distribution"] = status_counts
        retrospective["summary"]["total_samples"] = len(retrospective["anomaly_samples"])
        retrospective["summary"]["total_snapshots"] = len(snapshot_ids)
        retrospective["summary"]["total_logs"] = len(log_ids)
        
        retrospective["replay_commands"] = self._generate_replay_commands()
        
        return retrospective

    def _generate_replay_commands(self) -> List[str]:
        cmds = []
        
        snapshot_ids = self.store.list_snapshots()
        for sid in sorted(snapshot_ids):
            s = self.store.load_snapshot(sid)
            if s:
                cmds.append(
                    f"python -m multi_task_tuner import-snapshot "
                    f"--id {sid} "
                    f"--start '{s.data_range_start.isoformat()}' "
                    f"--end '{s.data_range_end.isoformat()}'"
                )
        
        log_ids = self.store.list_logs()
        for lid in sorted(log_ids):
            l = self.store.load_log(lid)
            if l:
                cmds.append(
                    f"python -m multi_task_tuner import-log "
                    f"--id {lid} "
                    f"--experiment '{l.experiment_name}'"
                )
        
        anomaly_ids = self.store.list_anomalies()
        for aid in sorted(anomaly_ids):
            a = self.store.load_anomaly(aid)
            if a and a.log_id:
                cmds.append(
                    f"python -m multi_task_tuner supplement-log "
                    f"--sample {aid} "
                    f"--log {a.log_id}"
                )
        
        cmds.append("python -m multi_task_tuner anomaly-page")
        cmds.append("python -m multi_task_tuner retrospective")
        
        return cmds
