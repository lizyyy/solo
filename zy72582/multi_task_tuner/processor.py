from datetime import datetime
from typing import List, Dict, Optional, Tuple
import uuid
import json

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

    def _add_status_history(
        self,
        sample: AnomalySample,
        from_status: Optional[RecordStatus],
        to_status: RecordStatus,
        action: str,
        note: Optional[str] = None,
        actor: Optional[str] = None
    ):
        from .models import StatusHistoryItem
        from_status_val = from_status.value if from_status else "none"
        history_item = StatusHistoryItem(
            from_status=from_status_val,
            to_status=to_status.value,
            action=action,
            timestamp=datetime.now(),
            note=note,
            actor=actor
        )
        sample.status_history.append(history_item)

    def create_anomaly_from_snapshot(
        self,
        snapshot_id: str,
        log_id: Optional[str] = None,
        reference_time: Optional[datetime] = None,
        sample_id: Optional[str] = None
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
        
        generated_sample_id = sample_id if sample_id else self._generate_sample_id()
        
        sample = AnomalySample(
            sample_id=generated_sample_id,
            snapshot_id=snapshot_id,
            log_id=log_id,
            detected_at=datetime.now(),
            status=status,
            metrics=base_metrics,
            original_metrics=original_metrics,
            flags=flags,
            review_note=details if details else None
        )
        self._add_status_history(
            sample,
            from_status=None,
            to_status=status,
            action="create_from_snapshot",
            note=f"从特征快照 {snapshot_id} 创建异常样本",
            actor=None
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
        
        if old_status != new_status:
            self._add_status_history(
                sample,
                from_status=old_status,
                to_status=new_status,
                action="supplement_log",
                note=f"补录训练日志 {log_id}，{details}",
                actor=None
            )
        
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
        
        old_status = sample.status
        
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
        
        if old_status != sample.status:
            self._add_status_history(
                sample,
                from_status=old_status,
                to_status=sample.status,
                action=f"review:{action}",
                note=note,
                actor=reviewer
            )
        
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
        sample_ids: Optional[List[str]] = None,
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
            anomaly_samples=sample_ids if sample_ids else [],
            notes=notes
        )
        
        if sample_ids:
            for sid in sample_ids:
                sample = self.store.load_anomaly(sid)
                if sample:
                    old_status = sample.status
                    sample.status = RecordStatus.RERUN
                    self._add_status_history(
                        sample,
                        from_status=old_status,
                        to_status=RecordStatus.RERUN,
                        action="rerun",
                        note=f"重跑实验，使用新权重 {task_weights}",
                        actor=None
                    )
                    self.store.save_anomaly(sample)
        else:
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
                "corrected_at": sample.corrected_at.isoformat() if sample.corrected_at else None,
                "status_history": [
                    {
                        "from_status": h.from_status,
                        "to_status": h.to_status,
                        "action": h.action,
                        "timestamp": h.timestamp.isoformat(),
                        "note": h.note,
                        "actor": h.actor
                    }
                    for h in sample.status_history
                ]
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
        ref_time = "2026-06-07T15:00:00"
        
        demo_snapshots = {"SNAP-2026-001", "SNAP-2026-002", "SNAP-2026-003"}
        demo_logs = {"LOG-2026-001", "LOG-2026-002", "LOG-2026-003"}
        
        cmds.append("# ===== 第一步：导入基础数据 =====")
        cmds.append("# 特征快照 - 主流程数据")
        
        snapshot_ids = self.store.list_snapshots()
        for sid in sorted(snapshot_ids):
            s = self.store.load_snapshot(sid)
            if s:
                demo_flag = " --demo-pattern" if sid in demo_snapshots else ""
                cmds.append(
                    f"python3 -m multi_task_tuner import-snapshot "
                    f"--id {sid} "
                    f"--start '{s.data_range_start.isoformat()}' "
                    f"--end '{s.data_range_end.isoformat()}'"
                    f"{demo_flag}"
                )
        
        cmds.append("")
        cmds.append("# 训练日志曲线 - 现场说法")
        
        log_ids = self.store.list_logs()
        for lid in sorted(log_ids):
            l = self.store.load_log(lid)
            if l:
                demo_flag = " --demo-pattern" if lid in demo_logs else ""
                cmds.append(
                    f"python3 -m multi_task_tuner import-log "
                    f"--id {lid} "
                    f"--experiment '{l.experiment_name}'"
                    f"{demo_flag}"
                )
        
        cmds.append("")
        cmds.append("# ===== 第二步：特征快照第一次导入，生成初始异常样本 =====")
        cmds.append("# 从特征快照创建异常样本")
        
        anomaly_ids = self.store.list_anomalies()
        anomaly_data = []
        for aid in sorted(anomaly_ids):
            a = self.store.load_anomaly(aid)
            if a:
                anomaly_data.append(a)
        
        anomaly_data.sort(key=lambda x: x.detected_at)
        
        sample_needs_supplement = []
        sample_needs_review = []
        
        for a in anomaly_data:
            snapshot = self.store.load_snapshot(a.snapshot_id)
            if snapshot is None:
                continue
            
            had_supplement = any(h.action == "supplement_log" for h in a.status_history)
            has_log_at_creation = a.log_id is not None and not had_supplement
            
            create_cmd = (
                f"python3 -m multi_task_tuner create-anomaly "
                f"--snapshot {a.snapshot_id} "
                f"--ref-time {ref_time} "
                f"--sample-id {a.sample_id}"
            )
            if has_log_at_creation:
                create_cmd += f" --log {a.log_id}"
            
            cmds.append(create_cmd)
            
            needs_supplement = had_supplement and a.log_id is not None
            if needs_supplement:
                sample_needs_supplement.append(a)
            
            for h in a.status_history:
                if h.action.startswith("review:"):
                    sample_needs_review.append((a, h))
                    break
        
        cmds.append("")
        cmds.append("# ===== 第三步：实验平台负责人阿越补看训练日志曲线 =====")
        cmds.append("# 补录训练日志曲线，异常样本页自动更新")
        
        for a in sample_needs_supplement:
            cmds.append(
                f"python3 -m multi_task_tuner supplement-log "
                f"--sample {a.sample_id} "
                f"--log {a.log_id} "
                f"--ref-time {ref_time}"
            )
        
        cmds.append("")
        cmds.append("# ===== 第四步：时间窗穿越不急着归正常，留给阿越复核 =====")
        
        for a, h in sample_needs_review:
            action = h.action.replace("review:", "")
            cmds.append(
                f"python3 -m multi_task_tuner review "
                f"--sample {a.sample_id} "
                f"--reviewer '{h.actor}' "
                f"--action {action} "
                f"--note \"{h.note}\""
            )
        
        cmds.append("")
        cmds.append("# ===== 第五步：一次重跑（使用调整后的权重） =====")
        
        run_ids = self.store.list_runs()
        for rid in sorted(run_ids):
            r = self.store.load_run(rid)
            if r:
                weights_str = json.dumps(r.task_weights, ensure_ascii=False)
                snaps_str = ",".join(r.feature_snapshots) if r.feature_snapshots else ""
                logs_str = ",".join(r.training_logs) if r.training_logs else ""
                samples_str = ",".join(r.anomaly_samples) if r.anomaly_samples else ""
                cmd = (
                    f"python3 -m multi_task_tuner rerun "
                    f"--type {r.run_type} "
                    f"--weights '{weights_str}' "
                )
                if snaps_str:
                    cmd += f"--snapshots {snaps_str} "
                if logs_str:
                    cmd += f"--logs {logs_str} "
                if samples_str:
                    cmd += f"--samples {samples_str} "
                if r.notes:
                    cmd += f"--notes \"{r.notes}\""
                cmds.append(cmd)
        
        cmds.append("")
        cmds.append("# ===== 查看结果 =====")
        cmds.append("python3 -m multi_task_tuner anomaly-page")
        cmds.append("python3 -m multi_task_tuner retrospective --output retrospective.json")
        
        return cmds
