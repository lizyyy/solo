import json
import os
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple


@dataclass
class ThresholdConfig:
    ps_high: float = 0.95
    ps_medium: float = 0.85
    drift_high: float = 0.3
    drift_medium: float = 0.15
    missing_rate_high: float = 0.2
    missing_rate_medium: float = 0.1


@dataclass
class FeatureSnapshot:
    snapshot_id: str
    import_time: str
    feature_name: str
    ps_value: float
    drift_value: float
    missing_rate: float
    tier: str = ""
    status: str = "pending"
    note: str = ""
    threshold_version: str = "v1"
    source: str = "import"


@dataclass
class TrainingLog:
    log_id: str
    snapshot_id: str
    curve_data: Dict[str, List[float]]
    log_time: str
    model_version: str
    old_caliber_ps: Optional[float] = None
    old_caliber_drift: Optional[float] = None


@dataclass
class ReviewRecord:
    record_id: str
    snapshot_id: str
    reviewer: str
    review_time: str
    action: str
    old_tier: str
    new_tier: str
    old_status: str
    new_status: str
    comment: str


@dataclass
class RerunRecord:
    rerun_id: str
    snapshot_id: str
    rerun_time: str
    trigger: str
    before_tier: str
    after_tier: str
    command: str


@dataclass
class WorkflowState:
    current_step: int = 0
    message: str = ""


class SamplePollutionChecker:
    def __init__(self, data_dir: str = "demo_data"):
        self.data_dir = data_dir
        self.thresholds = ThresholdConfig()
        self.snapshots: Dict[str, FeatureSnapshot] = {}
        self.training_logs: Dict[str, TrainingLog] = {}
        self.review_records: List[ReviewRecord] = []
        self.rerun_records: List[RerunRecord] = []
        self.workflow_history: List[WorkflowState] = []
        self.audit_log: List[str] = []
        self._ensure_dirs()
        self._log("工具初始化完成")

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "snapshots"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "logs"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "reviews"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "reruns"), exist_ok=True)

    def _log(self, msg: str):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        entry = f"[{ts}] {msg}"
        self.audit_log.append(entry)
        print(entry)

    def _calc_tier(self, ps: float, drift: float, missing: float) -> Tuple[str, str]:
        issues = []
        if ps >= self.thresholds.ps_high:
            issues.append("PS过高")
        elif ps >= self.thresholds.ps_medium:
            issues.append("PS偏高")
        if drift >= self.thresholds.drift_high:
            issues.append("漂移过高")
        elif drift >= self.thresholds.drift_medium:
            issues.append("漂移偏高")
        if missing >= self.thresholds.missing_rate_high:
            issues.append("缺失率过高")
        elif missing >= self.thresholds.missing_rate_medium:
            issues.append("缺失率偏高")

        if any(["过高" in x for x in issues]):
            return "red", "、".join(issues) if issues else "正常"
        elif any(["偏高" in x for x in issues]):
            return "yellow", "、".join(issues) if issues else "正常"
        else:
            return "green", "正常"

    def update_thresholds(self, new_thresholds: ThresholdConfig, version: str = "v2"):
        old = asdict(self.thresholds)
        self.thresholds = new_thresholds
        self._log(f"阈值已更新: {old} -> {asdict(new_thresholds)}，版本: {version}")
        return version

    def import_snapshot(self, snapshot: FeatureSnapshot) -> WorkflowState:
        self._log(f"步骤1: 导入特征快照 {snapshot.snapshot_id}")
        tier, calc_note = self._calc_tier(snapshot.ps_value, snapshot.drift_value, snapshot.missing_rate)
        snapshot.tier = tier
        if snapshot.note:
            snapshot.note = snapshot.note + f"；分层判定: {calc_note}"
        else:
            snapshot.note = calc_note
        snapshot.status = "imported"
        snapshot.source = "import"
        self.snapshots[snapshot.snapshot_id] = snapshot
        self._save_snapshot(snapshot)
        state = WorkflowState(
            current_step=1,
            message=f"快照 {snapshot.snapshot_id} 导入完成，分层: {tier}, 备注: {snapshot.note}"
        )
        self.workflow_history.append(state)
        return state

    def review_training_log(self, log: TrainingLog, reviewer: str = "小乔") -> WorkflowState:
        self._log(f"步骤2: 算法工程师{reviewer}补看训练日志 {log.log_id}")
        self.training_logs[log.log_id] = log
        self._save_training_log(log)

        snapshot = self.snapshots.get(log.snapshot_id)
        if not snapshot:
            state = WorkflowState(current_step=2, message=f"错误: 找不到快照 {log.snapshot_id}")
            self.workflow_history.append(state)
            return state

        old_tier = snapshot.tier
        old_status = snapshot.status

        if log.old_caliber_ps is not None:
            snapshot.note = snapshot.note + "；已从训练日志曲线补来旧口径"
            snapshot.source = "log_supplement"
            snapshot.status = "log_reviewed"
            new_tier, _ = self._calc_tier(log.old_caliber_ps, log.old_caliber_drift or snapshot.drift_value, snapshot.missing_rate)
            snapshot.tier = new_tier
            self._save_snapshot(snapshot)

            review = ReviewRecord(
                record_id=f"REV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                snapshot_id=snapshot.snapshot_id,
                reviewer=reviewer,
                review_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                action="训练日志补录旧口径",
                old_tier=old_tier,
                new_tier=new_tier,
                old_status=old_status,
                new_status="log_reviewed",
                comment=f"从训练日志曲线{log.model_version}补录旧口径PS值: {log.old_caliber_ps}"
            )
            self.review_records.append(review)
            self._save_review_record(review)
            state = WorkflowState(
                current_step=2,
                message=f"训练日志查看完成，{snapshot.snapshot_id} 从 {old_tier} 更新为 {new_tier}，来源: 训练日志补录"
            )
        else:
            snapshot.status = "log_reviewed"
            self._save_snapshot(snapshot)
            state = WorkflowState(
                current_step=2,
                message=f"训练日志查看完成，{snapshot.snapshot_id} 状态更新为 log_reviewed"
            )

        self.workflow_history.append(state)
        return state

    def update_tier_metrics(self, snapshot_id: str, reviewer: str = "数据科学家") -> WorkflowState:
        self._log(f"步骤3: 更新分层指标 - 快照 {snapshot_id}")
        snapshot = self.snapshots.get(snapshot_id)
        if not snapshot:
            state = WorkflowState(current_step=3, message=f"错误: 找不到快照 {snapshot_id}")
            self.workflow_history.append(state)
            return state

        old_tier = snapshot.tier
        old_status = snapshot.status

        has_threshold_issue = "阈值改过但报告仍写旧值" in snapshot.note
        has_log_supplement = "已从训练日志曲线补来旧口径" in snapshot.note

        if has_threshold_issue and not has_log_supplement:
            snapshot.status = "pending_review"
            new_tier = old_tier
            self._save_snapshot(snapshot)
            state = WorkflowState(
                current_step=3,
                message=f"快照 {snapshot_id} 存在阈值口径问题，已标记为 pending_review，留给{reviewer}复核，暂不归为正常"
            )
        elif has_log_supplement:
            new_tier = snapshot.tier
            snapshot.status = "finalized_with_supplement"
            self._save_snapshot(snapshot)
            state = WorkflowState(
                current_step=3,
                message=f"快照 {snapshot_id} 已从训练日志补录旧口径，分层指标更新完成，状态: finalized_with_supplement"
            )
        else:
            new_tier, note = self._calc_tier(snapshot.ps_value, snapshot.drift_value, snapshot.missing_rate)
            snapshot.tier = new_tier
            if note != "正常":
                snapshot.note = note
            snapshot.status = "finalized"
            self._save_snapshot(snapshot)
            state = WorkflowState(
                current_step=3,
                message=f"快照 {snapshot_id} 分层指标更新完成: {old_tier} -> {new_tier}，状态: finalized"
            )

        review = ReviewRecord(
            record_id=f"REV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            snapshot_id=snapshot_id,
            reviewer=reviewer,
            review_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            action="分层指标更新",
            old_tier=old_tier,
            new_tier=new_tier,
            old_status=old_status,
            new_status=snapshot.status,
            comment=state.message
        )
        self.review_records.append(review)
        self._save_review_record(review)
        self.workflow_history.append(state)
        return state

    def manual_correction(self, snapshot_id: str, new_tier: str, comment: str, reviewer: str = "小乔") -> WorkflowState:
        self._log(f"人工修正: 快照 {snapshot_id} -> {new_tier}")
        snapshot = self.snapshots.get(snapshot_id)
        if not snapshot:
            state = WorkflowState(current_step=-1, message=f"错误: 找不到快照 {snapshot_id}")
            return state

        old_tier = snapshot.tier
        old_status = snapshot.status
        snapshot.tier = new_tier
        snapshot.status = "manual_corrected"
        snapshot.note = snapshot.note + f"；人工修正: {comment}"
        self._save_snapshot(snapshot)

        review = ReviewRecord(
            record_id=f"REV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            snapshot_id=snapshot_id,
            reviewer=reviewer,
            review_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            action="人工修正",
            old_tier=old_tier,
            new_tier=new_tier,
            old_status=old_status,
            new_status="manual_corrected",
            comment=comment
        )
        self.review_records.append(review)
        self._save_review_record(review)

        state = WorkflowState(
            current_step=-1,
            message=f"人工修正完成: {snapshot_id} {old_tier} -> {new_tier}"
        )
        self.workflow_history.append(state)
        return state

    def rerun(self, snapshot_id: str, trigger: str = "手动触发") -> WorkflowState:
        self._log(f"重跑: 快照 {snapshot_id}，触发原因: {trigger}")
        snapshot = self.snapshots.get(snapshot_id)
        if not snapshot:
            state = WorkflowState(current_step=-1, message=f"错误: 找不到快照 {snapshot_id}")
            return state

        before_tier = snapshot.tier
        new_tier, note = self._calc_tier(snapshot.ps_value, snapshot.drift_value, snapshot.missing_rate)
        snapshot.tier = new_tier
        snapshot.status = "rerun"
        if note != "正常":
            snapshot.note = note
        self._save_snapshot(snapshot)

        rerun_id = f"RERUN-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        command = f"python run_pollution_check.py --snapshot {snapshot_id} --rerun --threshold-version {snapshot.threshold_version}"
        rerun = RerunRecord(
            rerun_id=rerun_id,
            snapshot_id=snapshot_id,
            rerun_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            trigger=trigger,
            before_tier=before_tier,
            after_tier=new_tier,
            command=command
        )
        self.rerun_records.append(rerun)
        self._save_rerun_record(rerun)

        state = WorkflowState(
            current_step=-1,
            message=f"重跑完成: {snapshot_id} {before_tier} -> {new_tier}，重跑ID: {rerun_id}"
        )
        self.workflow_history.append(state)
        return state

    def _save_snapshot(self, snapshot: FeatureSnapshot):
        path = os.path.join(self.data_dir, "snapshots", f"{snapshot.snapshot_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(asdict(snapshot), f, ensure_ascii=False, indent=2)

    def _save_training_log(self, log: TrainingLog):
        path = os.path.join(self.data_dir, "logs", f"{log.log_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(asdict(log), f, ensure_ascii=False, indent=2)

    def _save_review_record(self, review: ReviewRecord):
        path = os.path.join(self.data_dir, "reviews", f"{review.record_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(asdict(review), f, ensure_ascii=False, indent=2)

    def _save_rerun_record(self, rerun: RerunRecord):
        path = os.path.join(self.data_dir, "reruns", f"{rerun.rerun_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(asdict(rerun), f, ensure_ascii=False, indent=2)

    def generate_review_report(self) -> Dict:
        report = {
            "生成时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "特征快照统计": {
                "总数": len(self.snapshots),
                "green": sum(1 for s in self.snapshots.values() if s.tier == "green"),
                "yellow": sum(1 for s in self.snapshots.values() if s.tier == "yellow"),
                "red": sum(1 for s in self.snapshots.values() if s.tier == "red"),
                "pending_review": sum(1 for s in self.snapshots.values() if s.status == "pending_review")
            },
            "快照详情": [asdict(s) for s in self.snapshots.values()],
            "复核记录": [asdict(r) for r in self.review_records],
            "重跑记录": [asdict(r) for r in self.rerun_records],
            "工作流历史": [asdict(w) for w in self.workflow_history],
            "阈值配置": asdict(self.thresholds),
            "审计日志": self.audit_log
        }
        report_path = os.path.join(self.data_dir, "review_report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        self._log(f"复盘报告已生成: {report_path}")
        return report

    def export_rerun_commands(self) -> List[str]:
        commands = [r.command for r in self.rerun_records]
        cmd_path = os.path.join(self.data_dir, "rerun_commands.sh")
        with open(cmd_path, "w", encoding="utf-8") as f:
            f.write("#!/bin/bash\n")
            f.write("# 可重新跑的命令列表\n")
            for cmd in commands:
                f.write(f"{cmd}\n")
        self._log(f"可重跑命令已导出: {cmd_path}")
        return commands

    def get_snapshot_summary(self) -> str:
        lines = ["=" * 60, "样本污染排查工具 - 快照汇总", "=" * 60]
        for sid, s in self.snapshots.items():
            lines.append(f"快照ID: {s.snapshot_id}")
            lines.append(f"  特征: {s.feature_name}")
            lines.append(f"  PS值: {s.ps_value}, 漂移: {s.drift_value}, 缺失率: {s.missing_rate}")
            lines.append(f"  分层: {s.tier}, 状态: {s.status}")
            lines.append(f"  来源: {s.source}, 阈值版本: {s.threshold_version}")
            lines.append(f"  备注: {s.note}")
            lines.append("-" * 60)
        return "\n".join(lines)
