from datetime import datetime
from typing import Any, Dict, List, Optional

from models.layer import LayerResult, LayerItem, LayerStatus, ResponsibleRole, MismatchSource
from models.candidate import CandidateTable
from models.params import ParamsYAML
from core.history_tracer import HistoryTracer


class ReportGenerator:
    def __init__(self):
        self.tracer = HistoryTracer()

    def generate_human_readable_report(
        self,
        layer_result: LayerResult,
        candidate_table: Optional[CandidateTable] = None,
        params: Optional[ParamsYAML] = None,
        include_audit_trail: bool = True
    ) -> str:
        lines = []
        summary = layer_result.get_summary()

        lines.append("=" * 60)
        lines.append(f"【异常点可视化分层报告】{layer_result.name}")
        lines.append(f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"工作流阶段：{layer_result.workflow_step}")
        lines.append("=" * 60)

        lines.append("\n📊 总体概览")
        lines.append("-" * 40)
        lines.append(f"  总记录数：{summary['total_items']}")
        for status, count in summary["status_counts"].items():
            status_label = self._get_status_label(status)
            lines.append(f"  {status_label}：{count} 条")
        if summary["threshold_mismatch_count"] > 0:
            lines.append(f"  ⚠️  阈值不一致待复核：{summary['threshold_mismatch_count']} 条")

        if params:
            lines.append("\n⚙️  参数配置（来自参数YAML）")
            lines.append("-" * 40)
            for name, value in params.thresholds.items():
                lines.append(f"  {name}：{value}")

        lines.append("\n📝 分层明细（每条说明为什么留下）")
        lines.append("-" * 40)

        items_sorted = sorted(
            layer_result.items.values(),
            key=lambda x: x.score,
            reverse=True
        )

        for item in items_sorted:
            lines.append(self._format_item_detail(item, candidate_table, params))

        if include_audit_trail:
            audit = self.tracer.get_full_audit_trail(candidate_table, params, layer_result)
            if audit:
                lines.append("\n📜 操作审计（谁改了什么、为什么改）")
                lines.append("-" * 40)
                for entry in audit[-10:]:
                    lines.append(self._format_audit_entry(entry))

        lines.append("\n" + "=" * 60)
        lines.append("报告结束 — 以上内容可追溯至召回候选表和参数YAML")
        lines.append("=" * 60)

        return "\n".join(lines)

    def _format_item_detail(
        self,
        item: LayerItem,
        candidate_table: Optional[CandidateTable],
        params: Optional[ParamsYAML]
    ) -> str:
        lines = []
        status_icon = self._get_status_icon(item.status)
        lines.append(f"\n{status_icon} 记录 {item.record_id}  |  分数: {item.score:.4f}  |  状态: {item.status.value}")

        if item.reason and item.reason.why_kept:
            lines.append(f"   🔍 留下原因：{item.reason.why_kept}")

        if item.reason and item.reason.missing_materials:
            missing = "、".join(item.reason.missing_materials)
            lines.append(f"   📋 还缺材料：{missing}")

        if item.reason:
            owner_label = self._get_owner_label(item.reason.next_step_owner)
            lines.append(f"   👤 下一步找：{owner_label}")
            if item.reason.next_action:
                lines.append(f"   🎯 具体动作：{item.reason.next_action}")

        if item.threshold_mismatch:
            source_label = {
                "params_yaml_changed": "参数YAML被修改",
                "candidate_table_changed": "召回候选表被修改",
                "both_changed": "参数YAML和召回候选表都被修改",
                "unknown": "来源未知",
            }.get(item.mismatch_source.value, item.mismatch_source.value)
            lines.append(f"   ⚠️  【警告】阈值不一致！报告时={item.reported_threshold}，当前={item.actual_threshold}")
            lines.append(f"      → 不一致来源：{source_label}")
            lines.append(f"      → 已悬置，等待数据科学家复核")

        if candidate_table:
            record = candidate_table.get_record(item.record_id)
            if record and record.remark:
                lines.append(f"   💬 备注：{record.remark}")

        if item.lineage.candidate_table_id:
            lines.append(f"   🔗 追溯：候选表={item.lineage.candidate_table_id} | 参数YAML={item.lineage.params_yaml_id}")

        return "\n".join(lines)

    def _format_audit_entry(self, entry: Dict[str, Any]) -> str:
        op_map = {
            "update": "更新",
            "add_record": "添加记录",
        }
        op = op_map.get(entry["operation"], entry["operation"])
        reason = f"（{entry['reason']}）" if entry.get("reason") else ""
        return f"  [{entry['timestamp']}] {entry['operator']} {op} {entry['source']} {reason}"

    def _get_status_label(self, status: str) -> str:
        labels = {
            "pending_review": "⏳ 待复核",
            "confirmed_normal": "✅ 确认正常",
            "confirmed_anomaly": "🔴 确认为异常",
            "needs_data_scientist": "👨‍🔬 待数据科学家",
            "needs_algorithm_engineer": "👩‍💻 待算法工程师",
            "suspended": "⏸️  已悬置",
        }
        return labels.get(status, status)

    def _get_status_icon(self, status: LayerStatus) -> str:
        icons = {
            LayerStatus.PENDING_REVIEW: "⏳",
            LayerStatus.CONFIRMED_NORMAL: "✅",
            LayerStatus.CONFIRMED_ANOMALY: "🔴",
            LayerStatus.NEEDS_DATA_SCIENTIST: "👨‍🔬",
            LayerStatus.NEEDS_ALGORITHM_ENGINEER: "👩‍💻",
            LayerStatus.SUSPENDED: "⏸️",
        }
        return icons.get(status, "❓")

    def _get_owner_label(self, owner: ResponsibleRole) -> str:
        labels = {
            ResponsibleRole.DATA_SCIENTIST: "数据科学家",
            ResponsibleRole.ALGORITHM_ENGINEER: "算法工程师小乔",
            ResponsibleRole.BOTH: "数据科学家 + 算法工程师小乔",
        }
        return labels.get(owner, owner.value)
