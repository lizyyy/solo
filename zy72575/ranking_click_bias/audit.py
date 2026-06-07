"""
复盘报告生成模块 - 生成可复盘的记录和可重新跑的命令
"""
import json
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime

from .models import (
    SnapshotRecord,
    ProcessingStatus,
    WorkflowStep,
)
from .snapshot_manager import SnapshotManager
from .history_tracker import HistoryTracker
from .workflow import WorkflowEngine


class AuditReporter:
    def __init__(
        self,
        snapshot_manager: SnapshotManager,
        history_tracker: HistoryTracker,
        workflow_engine: WorkflowEngine,
        output_dir: str = "data/reports",
    ):
        self.snapshot_manager = snapshot_manager
        self.history_tracker = history_tracker
        self.workflow_engine = workflow_engine
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_snapshot_audit(
        self,
        snapshot_id: str,
        include_raw_data: bool = False,
    ) -> Dict[str, Any]:
        record = self.snapshot_manager.get_snapshot(snapshot_id)
        if not record:
            return {"error": f"快照 {snapshot_id} 不存在"}

        history = self.history_tracker.get_full_history(snapshot_id)
        workflow_status = self.workflow_engine.get_workflow_status(snapshot_id)

        audit = {
            "snapshot_id": snapshot_id,
            "original_line_number": record.original_line_number,
            "imported_at": record.imported_at.isoformat() if record.imported_at else None,
            "import_batch_id": record.import_batch_id,
            "current_status": record.status.value,
            "current_workflow_step": record.workflow_step.value,
            "current_workflow_state": record.workflow_state.value,
            "click_bias_score": record.click_bias_score,
            "default_score_applied": record.default_score_applied,
            "missing_features": record.missing_features,
            "assigned_to": record.assigned_to,
            "reviewed_by": record.reviewed_by,
            "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
            "notes": record.notes,
            "workflow_details": workflow_status,
            "change_history": history["changes"],
            "audit_trail": history["audit_trail"],
            "generated_at": datetime.now().isoformat(),
        }

        if include_raw_data:
            audit["raw_data"] = record.raw_data

        return audit

    def generate_replay_commands(
        self,
        snapshot_id: str,
    ) -> List[str]:
        audit = self.generate_snapshot_audit(snapshot_id, include_raw_data=True)
        if "error" in audit:
            return [audit["error"]]

        commands = [
            f"# ===== 快照 {snapshot_id} 重放命令 =====",
            f"# 生成时间: {datetime.now().isoformat()}",
            "",
            "# 1. 初始化系统",
            "from ranking_click_bias import SnapshotManager, HistoryTracker, BoundaryRuleEngine, WorkflowEngine",
            "snapshot_mgr = SnapshotManager()",
            "history_tracker = HistoryTracker()",
            "rule_engine = BoundaryRuleEngine()",
            "workflow = WorkflowEngine(snapshot_mgr, history_tracker, rule_engine)",
            "",
        ]

        raw_data_str = json.dumps(audit.get("raw_data", {}), ensure_ascii=False, indent=2)
        commands.extend([
            f"# 2. 导入原始数据 (原始行号: {audit['original_line_number']})",
            f"snapshots_data = [",
            f"    {raw_data_str}",
            f"]",
            f"imported, skipped = snapshot_mgr.import_snapshots(snapshots_data, source='replay', imported_by='audit_replay')",
            "",
        ])

        for change in audit["change_history"]:
            field = change["field"]
            old_val = change["old_value"]
            new_val = change["new_value"]
            changed_by = change["changed_by"]
            reason = change["reason"]

            commands.append(
                f"# 变更: {field} 从 {repr(old_val)} 改为 {repr(new_val)}"
            )
            commands.append(
                f"# 操作人: {changed_by}, 原因: {reason}"
            )

            if field == "notes":
                commands.append(
                    f"snapshot_mgr.update_snapshot('{snapshot_id}', {{'{field}': {repr(new_val)}}}, updated_by='{changed_by}', change_reason={repr(reason)})"
                )
            elif field == "status":
                if new_val == ProcessingStatus.LOGS_REVIEWED.value:
                    training_log = audit.get("audit_trail", [{}])[0].get("details", {}).get("training_log_analysis", "")
                    commands.append(
                        f"workflow.step_2_review_logs('{snapshot_id}', reviewed_by='{changed_by}', training_log_analysis={repr(training_log)})"
                    )
                elif new_val == ProcessingStatus.SUMMARY_UPDATED.value:
                    summary = audit.get("audit_trail", [{}])[-1].get("details", {}).get("explainable_summary", "")
                    commands.append(
                        f"workflow.step_3_update_summary('{snapshot_id}', updated_by='{changed_by}', explainable_summary={repr(summary)})"
                    )
            commands.append("")

        if audit.get("needs_leader_review"):
            commands.extend([
                f"# 3. 需要推荐负责人复核",
                f"workflow.assign_for_review('{snapshot_id}', assigned_to='推荐负责人', assigned_by='system', review_reason='线上特征缺失却给了默认分')",
                "",
                f"# 4. 复核通过后执行",
                f"# workflow.approve_review('{snapshot_id}', reviewed_by='推荐负责人', approval_notes='已复核确认')",
                "",
                f"# 5. 或复核驳回",
                f"# workflow.reject_review('{snapshot_id}', reviewed_by='推荐负责人', rejection_notes='需要重新检查')",
            ])

        commands.append("")
        commands.append(f"# 查看当前状态")
        commands.append(f"print(workflow.get_workflow_status('{snapshot_id}'))")
        commands.append(f"print(history_tracker.get_full_history('{snapshot_id}'))")

        return commands

    def generate_batch_report(
        self,
        batch_id: str,
    ) -> Dict[str, Any]:
        batch_records = self.snapshot_manager.get_import_batch(batch_id)
        if not batch_records:
            return {"error": f"批次 {batch_id} 不存在"}

        snapshot_audits = []
        all_replay_commands = []

        for record in batch_records:
            audit_data = self.generate_snapshot_audit(record.snapshot_id)
            snapshot_audits.append(audit_data)
            replay_cmds = self.generate_replay_commands(record.snapshot_id)
            all_replay_commands.extend(replay_cmds)
            all_replay_commands.append("")
            all_replay_commands.append("# " + "=" * 60)
            all_replay_commands.append("")

        by_status = {}
        for record in batch_records:
            status = record.status.value
            by_status[status] = by_status.get(status, 0) + 1

        with_missing = len([r for r in batch_records if r.missing_features])
        with_default = len([r for r in batch_records if r.default_score_applied])
        needs_review = len([r for r in batch_records if r.status == ProcessingStatus.NEEDS_REVIEW])

        return {
            "batch_id": batch_id,
            "total_snapshots": len(batch_records),
            "by_status": by_status,
            "with_missing_features": with_missing,
            "with_default_score": with_default,
            "needs_leader_review": needs_review,
            "snapshots": snapshot_audits,
            "generated_at": datetime.now().isoformat(),
        }

    def save_audit_report(
        self,
        snapshot_id: str,
        filename: Optional[str] = None,
    ) -> str:
        audit_data = self.generate_snapshot_audit(snapshot_id, include_raw_data=True)
        replay_commands = self.generate_replay_commands(snapshot_id)

        if not filename:
            filename = f"audit_{snapshot_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        json_path = self.output_dir / f"{filename}.json"
        sh_path = self.output_dir / f"{filename}_replay.py"

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)

        with open(sh_path, "w", encoding="utf-8") as f:
            f.write("\n".join(replay_commands))

        return f"报告已保存到: {json_path}\n重放脚本已保存到: {sh_path}"

    def save_batch_report(
        self,
        batch_id: str,
        filename: Optional[str] = None,
    ) -> str:
        report_data = self.generate_batch_report(batch_id)

        if not filename:
            filename = f"batch_report_{batch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        json_path = self.output_dir / f"{filename}.json"

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        return f"批次报告已保存到: {json_path}"

    def generate_leader_review_report(self) -> Dict[str, Any]:
        needs_review = self.snapshot_manager.list_snapshots(
            status=ProcessingStatus.NEEDS_REVIEW
        )

        snapshot_details = []
        for record in needs_review:
            detail = {
                "snapshot_id": record.snapshot_id,
                "original_line_number": record.original_line_number,
                "imported_at": record.imported_at.isoformat() if record.imported_at else None,
                "missing_features": record.missing_features,
                "default_score_applied": record.default_score_applied,
                "click_bias_score": record.click_bias_score,
                "notes": record.notes,
                "assigned_to": record.assigned_to,
                "change_history": self.history_tracker.get_notes_history(record.snapshot_id),
            }
            snapshot_details.append(detail)

        return {
            "report_type": "leader_review",
            "generated_at": datetime.now().isoformat(),
            "total_pending_review": len(needs_review),
            "snapshots_needing_review": snapshot_details,
            "summary": {
                "total": len(needs_review),
                "with_missing_features": len(
                    [r for r in needs_review if r.missing_features]
                ),
                "with_default_score": len(
                    [r for r in needs_review if r.default_score_applied]
                ),
            },
        }

    def print_summary(self) -> str:
        snapshot_stats = self.snapshot_manager.get_statistics()
        history_stats = self.history_tracker.get_statistics()
        workflow_stats = self.workflow_engine.get_workflow_statistics()

        lines = [
            "=" * 60,
            "排名学习点击偏差 - 系统概览",
            "=" * 60,
            "",
            "【快照统计】",
            f"  总快照数: {snapshot_stats['total']}",
            f"  需推荐负责人复核: {snapshot_stats['needs_review']}",
            f"  使用默认分: {snapshot_stats['with_default_score']}",
            f"  特征缺失: {snapshot_stats['with_missing_features']}",
            "",
            "【状态分布】",
        ]

        for status, count in snapshot_stats["by_status"].items():
            lines.append(f"  {status}: {count}")

        lines.extend([
            "",
            "【历史记录】",
            f"  总变更数: {history_stats['total_changes']}",
            f"  总审计记录: {history_stats['total_audits']}",
            f"  有变更的快照: {history_stats['snapshots_with_changes']}",
            "",
            "【工作流统计】",
            f"  需负责人复核: {workflow_stats['needs_leader_review']}",
            "",
            "=" * 60,
        ])

        return "\n".join(lines)
