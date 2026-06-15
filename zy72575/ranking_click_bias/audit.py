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

    def _format_python_literal(self, data: Any, indent: int = 0) -> str:
        indent_str = "    " * indent
        next_indent = "    " * (indent + 1)

        if data is None:
            return "None"
        elif isinstance(data, bool):
            return "True" if data else "False"
        elif isinstance(data, (int, float)):
            return repr(data)
        elif isinstance(data, str):
            return repr(data)
        elif isinstance(data, list):
            if not data:
                return "[]"
            items = []
            for item in data:
                items.append(next_indent + self._format_python_literal(item, indent + 1))
            return "[\n" + ",\n".join(items) + "\n" + indent_str + "]"
        elif isinstance(data, dict):
            if not data:
                return "{}"
            items = []
            for key, value in data.items():
                key_str = repr(key)
                val_str = self._format_python_literal(value, indent + 1)
                items.append("{}{}: {}".format(next_indent, key_str, val_str))
            return "{\n" + ",\n".join(items) + "\n" + indent_str + "}"
        else:
            return repr(data)

    def generate_replay_commands(
        self,
        snapshot_id: str,
    ) -> List[str]:
        record = self.snapshot_manager.get_snapshot(snapshot_id)
        if not record:
            return ["# 错误: 快照 {} 不存在".format(snapshot_id)]

        raw_data_python = self._format_python_literal(record.raw_data)
        training_log_analysis = record.custom_fields.get("training_log_analysis", "")
        curve_findings = record.custom_fields.get("curve_findings", "")
        explainable_summary = record.custom_fields.get("explainable_summary", "")
        logs_reviewed_by = record.custom_fields.get("logs_reviewed_by", "林姐")
        summary_updated_by = record.custom_fields.get("summary_updated_by", "林姐")
        import_source = record.custom_fields.get("import_source", "replay")
        imported_by = record.custom_fields.get("imported_by", "replay")

        step1_notes = ""
        for audit in self.history_tracker.get_audit_trail(snapshot_id):
            if audit.action == "step_1_import_complete":
                step1_notes = audit.details.get("notes", "")
                break

        log_preview = training_log_analysis[:50] + "..." if len(training_log_analysis) > 50 else training_log_analysis

        workflow_reasons = {
            "完成第一步：特征快照导入",
            "完成第二步：训练日志曲线审阅",
            "完成第三步：可解释摘要更新",
            "复核通过",
            "复核驳回",
        }
        all_notes_changes = self.history_tracker.get_notes_history(snapshot_id)
        manual_notes_changes = []
        for change in all_notes_changes:
            reason = change.get("reason", "")
            is_workflow = False
            for wf_reason in workflow_reasons:
                if wf_reason in reason:
                    is_workflow = True
                    break
            if not is_workflow and reason:
                manual_notes_changes.append(change)

        lines = []
        lines.append("#!/usr/bin/env python3")
        lines.append('"""')
        lines.append("快照 {} 重放脚本".format(snapshot_id))
        lines.append("生成时间: {}".format(datetime.now().isoformat()))
        lines.append("原始行号: {}".format(record.original_line_number))
        lines.append("")
        lines.append("此脚本可完整重放：")
        lines.append("  1. 特征快照第一次导入")
        lines.append("  2. 数据科学家补看训练日志曲线")
        lines.append("  3. 可解释摘要更新")
        lines.append("  4. （如触发）线上特征缺失却给了默认分 → 推荐负责人复核")
        lines.append('"""')
        lines.append("")
        lines.append("import sys")
        lines.append("import os")
        lines.append("")
        lines.append("# 确保能找到 ranking_click_bias 模块")
        lines.append("_script_dir = os.path.dirname(os.path.abspath(__file__))")
        lines.append("_project_root = os.path.dirname(os.path.dirname(_script_dir))")
        lines.append("if _project_root not in sys.path:")
        lines.append("    sys.path.insert(0, _project_root)")
        lines.append("")
        lines.append("from ranking_click_bias import SnapshotManager, HistoryTracker, BoundaryRuleEngine, WorkflowEngine, AuditReporter")
        lines.append("")
        lines.append("# ===== 第 0 步：初始化系统 =====")
        lines.append("history_tracker = HistoryTracker(history_dir='data/replay_history')")
        lines.append("snapshot_mgr = SnapshotManager(data_dir='data/replay_snapshots', history_tracker=history_tracker)")
        lines.append("rule_engine = BoundaryRuleEngine(rules_dir='data/replay_rules')")
        lines.append("workflow = WorkflowEngine(snapshot_mgr, history_tracker, rule_engine)")
        lines.append("reporter = AuditReporter(snapshot_mgr, history_tracker, workflow, output_dir='data/replay_reports')")
        lines.append("")
        lines.append("")
        lines.append("# ===== 第 1 步：特征快照编号第一次导入 =====")
        lines.append("# 原始行号: {}".format(record.original_line_number))
        lines.append("raw_data = " + raw_data_python)
        lines.append("snapshots_data = [raw_data]")
        lines.append("imported, skipped = snapshot_mgr.import_snapshots(")
        lines.append("    snapshots_data,")
        lines.append("    source='{}',".format(import_source))
        lines.append("    imported_by='{}'".format(imported_by))
        lines.append(")")
        lines.append("print('[Step 1] 导入完成: 新增 {} 条, 跳过 {} 条'.format(len(imported), len(skipped)))")
        lines.append("if imported:")
        lines.append("    print('  快照ID: {}'.format(imported[0].snapshot_id))")
        lines.append("    print('  原始行号: {}'.format(imported[0].original_line_number))")
        lines.append("")
        lines.append("# 确认导入完成（工作流 Step 1）")
        lines.append("snapshot_id = '{}'".format(snapshot_id))
        lines.append("step1_result = workflow.step_1_import(")
        lines.append("    snapshot_id,")
        lines.append("    imported_by='{}',".format(imported_by))
        lines.append("    import_notes={}".format(repr(step1_notes)))
        lines.append(")")
        lines.append("print('[Step 1] 工作流状态: {}'.format(step1_result.status.value))")
        lines.append("")

        if manual_notes_changes:
            lines.append("# ===== 补充：手动备注修改 =====")
            lines.append("# 数据科学家林姐等手动修改的备注")
            for nc in manual_notes_changes:
                new_notes = nc.get("new_notes", "")
                changed_by = nc.get("changed_by", "unknown")
                reason = nc.get("reason", "")
                lines.append("snapshot_mgr.update_snapshot(")
                lines.append("    snapshot_id,")
                lines.append("    updates={{'notes': {}}},".format(repr(new_notes)))
                lines.append("    updated_by={},".format(repr(changed_by)))
                lines.append("    change_reason={}".format(repr(reason)))
                lines.append(")")
                preview = new_notes[:30] + "..." if len(new_notes) > 30 else new_notes
                print_msg = "[备注更新] {} 修改了备注: {}".format(changed_by, preview)
                lines.append("print({})".format(repr(print_msg)))
            lines.append("")
            lines.append("")

        lines.append("# ===== 第 2 步：数据科学家林姐补看训练日志曲线 =====")
        lines.append("step2_result = workflow.step_2_review_logs(")
        lines.append("    snapshot_id,")
        lines.append("    reviewed_by='{}',".format(logs_reviewed_by))
        lines.append("    training_log_analysis={},".format(repr(training_log_analysis)))
        lines.append("    curve_findings={}".format(repr(curve_findings)))
        lines.append(")")
        lines.append("print('[Step 2] 日志审阅完成: {}'.format(step2_result.status.value))")
        lines.append("print('  训练日志分析: {}')".format(log_preview))
        lines.append("")
        lines.append("")
        lines.append("# ===== 第 3 步：可解释摘要更新 =====")
        lines.append("step3_result = workflow.step_3_update_summary(")
        lines.append("    snapshot_id,")
        lines.append("    updated_by='{}',".format(summary_updated_by))
        lines.append("    explainable_summary={},".format(repr(explainable_summary)))
        lines.append("    click_bias_score={},".format(repr(record.click_bias_score)))
        lines.append("    missing_features={},".format(repr(record.missing_features)))
        lines.append("    default_score_applied={}".format(record.default_score_applied))
        lines.append(")")
        lines.append("print('[Step 3] 摘要更新完成: {}'.format(step3_result.status.value))")
        lines.append("print('  点击偏差分数: {}'.format(step3_result.click_bias_score))")
        lines.append("print('  缺失特征: {}'.format(step3_result.missing_features))")
        lines.append("print('  使用默认分: {}'.format(step3_result.default_score_applied))")
        lines.append("")

        if record.status == ProcessingStatus.NEEDS_REVIEW or record.reviewed_by:
            lines.append("# ===== 边界规则触发：线上特征缺失却给了默认分 =====")
            lines.append("needs_review = step3_result.status.value == 'needs_review'")
            lines.append("if needs_review:")
            lines.append("    print('⚠️  触发边界规则：线上特征缺失却给了默认分')")
            lines.append("    print('   自动标记为 needs_review，分配给推荐负责人复核')")
            lines.append("    print('   不急着归正常，留给推荐负责人人工判断')")
            lines.append("else:")
            lines.append("    print('✅ 未触发边界规则')")
            lines.append("")
            lines.append("")

        if record.reviewed_by:
            review_action = "approve" if record.status in [
                ProcessingStatus.NORMAL, ProcessingStatus.REVIEW_APPROVED
            ] else "reject"
            reviewed_at_str = record.reviewed_at.isoformat() if record.reviewed_at else "N/A"
            lines.append("# ===== 第 4 步：推荐负责人复核 =====")
            lines.append("# 复核人: {}".format(record.reviewed_by))
            lines.append("# 复核时间: {}".format(reviewed_at_str))
            lines.append("# 复核结果: {}".format("通过" if review_action == "approve" else "驳回"))
            lines.append("")
            if review_action == "approve":
                lines.append("review_result = workflow.approve_review(")
                lines.append("    snapshot_id,")
                lines.append("    reviewed_by={},".format(repr(record.reviewed_by)))
                lines.append("    approval_notes={},".format(repr(record.notes)))
                lines.append("    mark_as_normal=True")
                lines.append(")")
                lines.append("print('[Review] 复核通过: {}'.format(review_result.status.value))")
                lines.append("print('  复核人: {}'.format(review_result.reviewed_by))")
                lines.append("print('  复核意见: {}'.format(review_result.notes))")
                lines.append("")
            else:
                lines.append("review_result = workflow.reject_review(")
                lines.append("    snapshot_id,")
                lines.append("    reviewed_by={},".format(repr(record.reviewed_by)))
                lines.append("    rejection_notes={}".format(repr(record.notes)))
                lines.append(")")
                lines.append("print('[Review] 复核驳回: {}'.format(review_result.status.value))")
                lines.append("print('  复核人: {}'.format(review_result.reviewed_by))")
                lines.append("print('  驳回原因: {}'.format(review_result.notes))")
                lines.append("")

        lines.append("")
        lines.append("# ===== 查看完整历史记录 =====")
        lines.append("print()")
        lines.append("print('=' * 60)")
        lines.append("print('重放完成 - 最终状态')")
        lines.append("print('=' * 60)")
        lines.append("")
        lines.append("final_status = workflow.get_workflow_status(snapshot_id)")
        lines.append("print('快照ID: {}'.format(final_status['snapshot_id']))")
        lines.append("print('当前步骤: {}'.format(final_status['current_step']))")
        lines.append("print('工作流状态: {}'.format(final_status['current_state']))")
        lines.append("print('处理状态: {}'.format(final_status['status']))")
        lines.append("print('需要负责人复核: {}'.format(final_status['needs_leader_review']))")
        lines.append("print('缺失特征: {}'.format(final_status['missing_features']))")
        lines.append("print('使用默认分: {}'.format(final_status['default_score_applied']))")
        lines.append("")
        lines.append("full_history = history_tracker.get_full_history(snapshot_id)")
        lines.append("print()")
        lines.append("print('历史变更总数: {}'.format(full_history['change_count']))")
        lines.append("print('审计记录总数: {}'.format(full_history['audit_count']))")
        lines.append("print()")
        lines.append("print('变更明细:')")
        lines.append("for c in full_history['changes']:")
        lines.append("    print('  [{}] {}'.format(c['changed_at'], c['changed_by']))")
        lines.append("    print('    {}: {} → {}'.format(")
        lines.append("        c['field'], repr(c['old_value']), repr(c['new_value'])")
        lines.append("    ))")
        lines.append("    if c.get('reason'):")
        lines.append("        print('    原因: {}'.format(c['reason']))")
        lines.append("")
        lines.append("notes_history = history_tracker.get_notes_history(snapshot_id)")
        lines.append("if notes_history:")
        lines.append("    print()")
        lines.append("    print('备注变更历史 (改前改后对比):')")
        lines.append("    for i, n in enumerate(notes_history):")
        lines.append("        print('  版本 {}: {}'.format(i+1, n['changed_at']))")
        lines.append("        print('    操作人: {}'.format(n['changed_by']))")
        lines.append("        print('    改前: {}'.format(repr(n['old_notes'])))")
        lines.append("        print('    改后: {}'.format(repr(n['new_notes'])))")
        lines.append("        print('    原因: {}'.format(n['reason']))")
        lines.append("")
        lines.append("print()")
        lines.append("print('=' * 60)")
        lines.append("print('重放完成 - 可对比原始结果验证一致性')")
        lines.append("print('=' * 60)")

        return lines

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
