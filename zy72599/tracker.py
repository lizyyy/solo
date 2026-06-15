import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from models import (
    FeatureSnapshot,
    TrainingLogCurve,
    StratifiedMetric,
    WeightTrackRecord,
    WeightStatus,
    ReviewDecision,
    ConflictEvidence,
    ReviewPackage,
)


class WeightTracker:
    def __init__(self, storage_path: str = "track_records.json"):
        self.storage_path = storage_path
        self.records: Dict[str, WeightTrackRecord] = {}
        self._load_records()

    def _load_records(self):
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for track_id, record_data in data.items():
                    record = self._deserialize_record(record_data)
                    self.records[track_id] = record
        except (FileNotFoundError, json.JSONDecodeError):
            pass

    def _save_records(self):
        data = {}
        for track_id, record in self.records.items():
            data[track_id] = self._serialize_record(record)
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def _serialize_record(self, record: WeightTrackRecord) -> Dict:
        return {
            "track_id": record.track_id,
            "snapshot_id": record.snapshot_id,
            "feature_snapshot": self._serialize_snapshot(record.feature_snapshot) if record.feature_snapshot else None,
            "training_log": self._serialize_log(record.training_log) if record.training_log else None,
            "status": record.status.value,
            "stratified_metrics": [self._serialize_metric(m) for m in record.stratified_metrics],
            "history": record.history,
            "conflicts": [self._serialize_conflict(c) for c in record.conflicts],
            "review_decision": record.review_decision.value,
            "reviewer": record.reviewer,
            "review_time": record.review_time.isoformat() if record.review_time else None,
            "review_comment": record.review_comment,
            "create_time": record.create_time.isoformat(),
            "update_time": record.update_time.isoformat(),
        }

    def _serialize_snapshot(self, s: FeatureSnapshot) -> Dict:
        return {
            "snapshot_id": s.snapshot_id,
            "version": s.version,
            "create_time": s.create_time.isoformat(),
            "weight_threshold": s.weight_threshold,
            "weight_threshold_version": s.weight_threshold_version,
            "features": s.features,
            "source": s.source,
        }

    def _serialize_log(self, l: TrainingLogCurve) -> Dict:
        return {
            "log_id": l.log_id,
            "snapshot_id": l.snapshot_id,
            "train_time": l.train_time.isoformat(),
            "metric_name": l.metric_name,
            "metric_values": l.metric_values,
            "epochs": l.epochs,
            "final_weight": l.final_weight,
            "weight_caliber": l.weight_caliber,
            "remarks": l.remarks,
        }

    def _serialize_metric(self, m: StratifiedMetric) -> Dict:
        return {
            "metric_name": m.metric_name,
            "segment": m.segment,
            "value": m.value,
            "confidence": m.confidence,
            "caliber": m.caliber,
            "update_time": m.update_time.isoformat(),
            "source": m.source,
        }

    def _serialize_conflict(self, c: ConflictEvidence) -> Dict:
        return {
            "field": c.field,
            "snapshot_value": c.snapshot_value,
            "log_value": c.log_value,
            "description": c.description,
        }

    def _deserialize_record(self, data: Dict) -> WeightTrackRecord:
        record = WeightTrackRecord(
            track_id=data["track_id"],
            snapshot_id=data["snapshot_id"],
            feature_snapshot=self._deserialize_snapshot(data["feature_snapshot"]) if data["feature_snapshot"] else None,
            training_log=self._deserialize_log(data["training_log"]) if data["training_log"] else None,
            status=WeightStatus(data["status"]),
            stratified_metrics=[self._deserialize_metric(m) for m in data["stratified_metrics"]],
            history=data["history"],
            conflicts=[self._deserialize_conflict(c) for c in data["conflicts"]],
            review_decision=ReviewDecision(data["review_decision"]),
            reviewer=data["reviewer"],
            review_time=datetime.fromisoformat(data["review_time"]) if data["review_time"] else None,
            review_comment=data["review_comment"],
            create_time=datetime.fromisoformat(data["create_time"]),
            update_time=datetime.fromisoformat(data["update_time"]),
        )
        return record

    def _deserialize_snapshot(self, data: Dict) -> FeatureSnapshot:
        return FeatureSnapshot(
            snapshot_id=data["snapshot_id"],
            version=data["version"],
            create_time=datetime.fromisoformat(data["create_time"]),
            weight_threshold=data["weight_threshold"],
            weight_threshold_version=data["weight_threshold_version"],
            features=data["features"],
            source=data["source"],
        )

    def _deserialize_log(self, data: Dict) -> TrainingLogCurve:
        return TrainingLogCurve(
            log_id=data["log_id"],
            snapshot_id=data["snapshot_id"],
            train_time=datetime.fromisoformat(data["train_time"]),
            metric_name=data["metric_name"],
            metric_values=data["metric_values"],
            epochs=data["epochs"],
            final_weight=data["final_weight"],
            weight_caliber=data["weight_caliber"],
            remarks=data["remarks"],
        )

    def _deserialize_metric(self, data: Dict) -> StratifiedMetric:
        return StratifiedMetric(
            metric_name=data["metric_name"],
            segment=data["segment"],
            value=data["value"],
            confidence=data["confidence"],
            caliber=data["caliber"],
            update_time=datetime.fromisoformat(data["update_time"]),
            source=data["source"],
        )

    def _deserialize_conflict(self, data: Dict) -> ConflictEvidence:
        return ConflictEvidence(
            field=data["field"],
            snapshot_value=data["snapshot_value"],
            log_value=data["log_value"],
            description=data["description"],
        )

    def step1_import_snapshot(self, snapshot: FeatureSnapshot, operator: str) -> WeightTrackRecord:
        track_id = f"track_{uuid.uuid4().hex[:8]}"
        record = WeightTrackRecord(
            track_id=track_id,
            snapshot_id=snapshot.snapshot_id,
            feature_snapshot=snapshot,
            status=WeightStatus.PENDING_REVIEW,
        )
        record.add_history(
            step="step1_import_snapshot",
            action="导入特征快照",
            operator=operator,
            detail=f"导入特征快照 {snapshot.snapshot_id} (版本 {snapshot.version})，阈值版本 {snapshot.weight_threshold_version}"
        )
        self.records[track_id] = record
        self._save_records()
        return record

    def _detect_conflicts(self, record: WeightTrackRecord) -> List[ConflictEvidence]:
        conflicts = []
        if not record.feature_snapshot or not record.training_log:
            return conflicts

        snapshot = record.feature_snapshot
        log = record.training_log

        if snapshot.weight_threshold_version != log.weight_caliber:
            conflicts.append(ConflictEvidence(
                field="weight_caliber",
                snapshot_value=snapshot.weight_threshold_version,
                log_value=log.weight_caliber,
                description="特征快照的阈值版本与训练日志的权重口径不一致"
            ))

        if log.remarks and "阈值已更新但报告未同步" in log.remarks:
            conflicts.append(ConflictEvidence(
                field="threshold_remark",
                snapshot_value=snapshot.weight_threshold_version,
                log_value=log.remarks,
                description="训练日志备注表明阈值已更新但报告未同步"
            ))

        if log.remarks and "从历史训练曲线补录" in log.remarks:
            conflicts.append(ConflictEvidence(
                field="data_source",
                snapshot_value="特征快照导入",
                log_value="从历史训练曲线补录",
                description="该条记录为从训练日志曲线补录的旧口径数据"
            ))

        return conflicts

    def _classify_status(self, record: WeightTrackRecord) -> WeightStatus:
        if not record.feature_snapshot:
            return WeightStatus.PENDING_REVIEW
        if not record.training_log:
            return WeightStatus.PENDING_REVIEW

        conflicts = self._detect_conflicts(record)
        if not conflicts:
            return WeightStatus.NORMAL

        has_threshold_issue = any(c.field in ["weight_caliber", "threshold_remark"] for c in conflicts)
        has_log_supplement = any(c.field == "data_source" for c in conflicts)

        if has_log_supplement:
            return WeightStatus.FROM_TRAINING_LOG
        if has_threshold_issue:
            return WeightStatus.THRESHOLD_CHANGED_REPORT_OLD
        return WeightStatus.CONFLICT

    def step2_check_training_log(self, track_id: str, training_log: TrainingLogCurve, operator: str) -> Tuple[WeightTrackRecord, Optional[ReviewPackage]]:
        if track_id not in self.records:
            raise ValueError(f"追踪记录 {track_id} 不存在")

        record = self.records[track_id]
        record.training_log = training_log
        record.add_history(
            step="step2_check_training_log",
            action="补看训练日志曲线",
            operator=operator,
            detail=f"关联训练日志 {training_log.log_id}，权重口径 {training_log.weight_caliber}"
        )

        record.conflicts = self._detect_conflicts(record)
        record.status = self._classify_status(record)

        review_package = None
        if record.conflicts:
            review_package = ReviewPackage(
                track_id=record.track_id,
                snapshot_id=record.snapshot_id,
                conflicts=record.conflicts,
                snapshot_summary={
                    "snapshot_id": record.feature_snapshot.snapshot_id if record.feature_snapshot else "",
                    "weight_threshold_version": record.feature_snapshot.weight_threshold_version if record.feature_snapshot else "",
                    "weight_threshold": record.feature_snapshot.weight_threshold if record.feature_snapshot else 0,
                },
                log_summary={
                    "log_id": training_log.log_id,
                    "weight_caliber": training_log.weight_caliber,
                    "final_weight": training_log.final_weight,
                    "remarks": training_log.remarks,
                }
            )
            record.add_history(
                step="step2_check_training_log",
                action="检测到冲突，待人工确认",
                operator=operator,
                detail=f"发现 {len(record.conflicts)} 处冲突，请推荐策略老唐确认或驳回"
            )

        self._save_records()
        return record, review_package

    def resolve_conflict(self, track_id: str, decision: ReviewDecision, reviewer: str, comment: str = "") -> WeightTrackRecord:
        if track_id not in self.records:
            raise ValueError(f"追踪记录 {track_id} 不存在")

        record = self.records[track_id]
        record.review_decision = decision
        record.reviewer = reviewer
        record.review_time = datetime.now()
        record.review_comment = comment

        if decision == ReviewDecision.CONFIRM:
            if record.status == WeightStatus.THRESHOLD_CHANGED_REPORT_OLD:
                record.status = WeightStatus.THRESHOLD_CHANGED_REPORT_OLD
                record.add_history(
                    step="conflict_resolution",
                    action="确认阈值改报告旧值状态",
                    operator=reviewer,
                    detail=f"数据科学家确认：阈值改过但报告仍写旧值，留档待复核。备注：{comment}"
                )
            elif record.status == WeightStatus.FROM_TRAINING_LOG:
                record.status = WeightStatus.FROM_TRAINING_LOG
                record.add_history(
                    step="conflict_resolution",
                    action="确认从训练日志补录",
                    operator=reviewer,
                    detail=f"数据科学家确认：从训练日志曲线补录的旧口径数据。备注：{comment}"
                )
        elif decision == ReviewDecision.REJECT:
            record.status = WeightStatus.PENDING_REVIEW
            record.add_history(
                step="conflict_resolution",
                action="驳回",
                operator=reviewer,
                detail=f"驳回，需要重新核对。备注：{comment}"
            )

        self._save_records()
        return record

    def step3_update_stratified_metrics(self, track_id: str, metrics: List[StratifiedMetric], operator: str) -> WeightTrackRecord:
        if track_id not in self.records:
            raise ValueError(f"追踪记录 {track_id} 不存在")

        record = self.records[track_id]

        if record.status == WeightStatus.THRESHOLD_CHANGED_REPORT_OLD and record.review_decision != ReviewDecision.CONFIRM:
            record.add_history(
                step="step3_update_stratified_metrics",
                action="暂缓更新",
                operator=operator,
                detail="当前为阈值改过但报告仍写旧值状态，需先经数据科学家复核后再更新分层指标"
            )
            self._save_records()
            return record

        record.stratified_metrics = metrics
        record.add_history(
            step="step3_update_stratified_metrics",
            action="更新分层指标",
            operator=operator,
            detail=f"更新 {len(metrics)} 条分层指标，口径：{metrics[0].caliber if metrics else 'N/A'}"
        )

        if record.status == WeightStatus.PENDING_REVIEW and not record.conflicts:
            record.status = WeightStatus.NORMAL

        self._save_records()
        return record

    def get_record(self, track_id: str) -> Optional[WeightTrackRecord]:
        return self.records.get(track_id)

    def get_all_records(self) -> List[WeightTrackRecord]:
        return list(self.records.values())

    def export_replay_commands(self, track_id: str, storage_path: str = "track_records.json") -> List[str]:
        if track_id not in self.records:
            raise ValueError(f"追踪记录 {track_id} 不存在")

        record = self.records[track_id]
        commands = []

        commands.append("#!/bin/bash")
        commands.append(f"# 样本权重异常追踪 - 记录 {record.track_id} 重跑命令")
        commands.append(f"# 快照ID: {record.snapshot_id}")
        commands.append(f"# 原始状态: {record.status.value}")
        commands.append("set -e")
        commands.append("")
        commands.append(f'STORAGE_FILE="{storage_path}"')
        commands.append('')

        if record.feature_snapshot:
            s = record.feature_snapshot
            commands.append("# Step 1: 导入特征快照（生成新的追踪编号）")
            commands.append('echo "=== Step 1: 导入特征快照 ==="')
            commands.append("TRACK_ID=$(python3 cli.py import-snapshot \\")
            commands.append(f"  --snapshot-id {s.snapshot_id} \\")
            commands.append(f"  --version {s.version} \\")
            commands.append(f"  --threshold {s.weight_threshold} \\")
            commands.append(f"  --threshold-version {s.weight_threshold_version} \\")
            commands.append(f"  --source {s.source} \\")
            commands.append(f"  --operator system \\")
            commands.append(f'  --storage "$STORAGE_FILE" \\')
            commands.append("  | grep '^TRACK_ID=' | cut -d= -f2)")
            commands.append('echo "新生成追踪编号: $TRACK_ID"')
            commands.append("")

        if record.training_log:
            l = record.training_log
            commands.append("# Step 2: 补看训练日志曲线")
            commands.append('echo "=== Step 2: 补看训练日志曲线 ==="')
            commands.append("python3 cli.py check-log \\")
            commands.append('  --track-id "$TRACK_ID" \\')
            commands.append(f"  --log-id {l.log_id} \\")
            commands.append(f"  --caliber {l.weight_caliber} \\")
            commands.append(f"  --final-weight {l.final_weight} \\")
            commands.append(f'  --remarks "{l.remarks}" \\')
            commands.append(f"  --operator 推荐策略老唐 \\")
            commands.append(f'  --storage "$STORAGE_FILE"')
            commands.append("")

        if record.conflicts and record.review_decision != ReviewDecision.PENDING:
            commands.append("# Step 2.5: 冲突复核")
            commands.append('echo "=== Step 2.5: 冲突复核 ==="')
            commands.append("python3 cli.py resolve \\")
            commands.append('  --track-id "$TRACK_ID" \\')
            commands.append(f"  --decision {record.review_decision.value} \\")
            commands.append(f"  --reviewer {record.reviewer or 'unknown'} \\")
            commands.append(f'  --comment "{record.review_comment}" \\')
            commands.append(f'  --storage "$STORAGE_FILE"')
            commands.append("")

        if record.stratified_metrics:
            commands.append("# Step 3: 更新分层指标")
            commands.append('echo "=== Step 3: 更新分层指标 ==="')
            commands.append("python3 cli.py update-metrics \\")
            commands.append('  --track-id "$TRACK_ID" \\')
            commands.append(f"  --caliber {record.stratified_metrics[0].caliber} \\")
            commands.append(f"  --operator system \\")
            commands.append(f'  --storage "$STORAGE_FILE"')
            commands.append("")

        commands.append("# 查看最终追踪记录")
        commands.append('echo "=== 最终复盘记录 ==="')
        commands.append('python3 cli.py show --track-id "$TRACK_ID" --storage "$STORAGE_FILE"')
        commands.append("")
        commands.append('echo ""')
        commands.append('echo "重跑完成，追踪编号: $TRACK_ID"')

        return commands

    def export_review_record(self, track_id: str) -> str:
        if track_id not in self.records:
            raise ValueError(f"追踪记录 {track_id} 不存在")

        record = self.records[track_id]
        lines = []

        lines.append("=" * 60)
        lines.append("样本权重异常追踪 - 复盘记录")
        lines.append("=" * 60)
        lines.append(f"追踪ID: {record.track_id}")
        lines.append(f"快照ID: {record.snapshot_id}")
        lines.append(f"当前状态: {record.status.value}")
        lines.append(f"创建时间: {record.create_time.isoformat()}")
        lines.append(f"更新时间: {record.update_time.isoformat()}")
        lines.append("")

        lines.append("--- 特征快照信息 ---")
        if record.feature_snapshot:
            s = record.feature_snapshot
            lines.append(f"  版本: {s.version}")
            lines.append(f"  权重阈值: {s.weight_threshold}")
            lines.append(f"  阈值版本: {s.weight_threshold_version}")
            lines.append(f"  来源: {s.source}")
        else:
            lines.append("  (未导入)")
        lines.append("")

        lines.append("--- 训练日志信息 ---")
        if record.training_log:
            l = record.training_log
            lines.append(f"  日志ID: {l.log_id}")
            lines.append(f"  训练时间: {l.train_time.isoformat()}")
            lines.append(f"  指标名称: {l.metric_name}")
            lines.append(f"  最终权重: {l.final_weight}")
            lines.append(f"  权重口径: {l.weight_caliber}")
            lines.append(f"  备注: {l.remarks}")
        else:
            lines.append("  (未关联)")
        lines.append("")

        lines.append("--- 冲突证据 ---")
        if record.conflicts:
            for i, c in enumerate(record.conflicts, 1):
                lines.append(f"  [{i}] 字段: {c.field}")
                lines.append(f"      快照值: {c.snapshot_value}")
                lines.append(f"      日志值: {c.log_value}")
                lines.append(f"      说明: {c.description}")
        else:
            lines.append("  (无冲突)")
        lines.append("")

        lines.append("--- 复核状态 ---")
        lines.append(f"  决策: {record.review_decision.value}")
        lines.append(f"  复核人: {record.reviewer or '未复核'}")
        lines.append(f"  复核时间: {record.review_time.isoformat() if record.review_time else 'N/A'}")
        lines.append(f"  复核意见: {record.review_comment or '无'}")
        lines.append("")

        lines.append("--- 分层指标 ---")
        if record.stratified_metrics:
            for m in record.stratified_metrics:
                lines.append(f"  [{m.segment}] {m.metric_name} = {m.value} (置信度: {m.confidence}, 口径: {m.caliber})")
        else:
            lines.append("  (未更新)")
        lines.append("")

        lines.append("--- 操作历史 ---")
        for i, h in enumerate(record.history, 1):
            lines.append(f"  [{i}] {h['time']} | {h['step']} | {h['operator']}")
            lines.append(f"      动作: {h['action']}")
            lines.append(f"      详情: {h['detail']}")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
