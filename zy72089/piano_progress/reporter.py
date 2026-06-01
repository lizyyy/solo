"""报告模块 - 异常清单、可读提醒、差异对比"""

from typing import Dict, List, Optional
from dataclasses import dataclass

from .calculator import ProgressScore
from .tracer import DataTracer


@dataclass
class ReportSection:
    """报告章节"""
    title: str
    content: str
    level: str = "info"  # info, warning, error, success


class ReportGenerator:
    """报告生成器"""

    def __init__(self, tracer: Optional[DataTracer] = None):
        self.tracer = tracer or DataTracer()
        self.colors = {
            "reset": "\033[0m",
            "red": "\033[31m",
            "green": "\033[32m",
            "yellow": "\033[33m",
            "blue": "\033[34m",
            "cyan": "\033[36m",
            "bold": "\033[1m",
        }

    def _color_text(self, text: str, color: str) -> str:
        """添加终端颜色"""
        return f"{self.colors.get(color, '')}{text}{self.colors['reset']}"

    def generate_header(self, title: str) -> ReportSection:
        """生成报告标题"""
        line = "=" * 60
        return ReportSection(
            title=title,
            content=f"\n{line}\n{self._color_text(title, 'bold')}\n{line}\n",
            level="info",
        )

    def generate_summary(self, summary: Dict) -> ReportSection:
        """生成汇总信息"""
        lines = ["📊 运行汇总"]
        lines.append("-" * 40)

        if "date_range" in summary:
            lines.append(
                f"  统计周期: {summary['date_range']['start']} ~ {summary['date_range']['end']}"
            )

        lines.append(f"  总记录数: {summary['total_records']}")
        avg_score_str = f"{summary['avg_score']:.2f}"
        lines.append(
            f"  平均进步分: {self._color_text(avg_score_str, 'cyan')}"
        )
        lines.append(f"  整体趋势: {self._color_text(summary['trend'], 'bold')}")

        # 待人工确认
        confirm_color = "yellow" if summary["manual_confirm_count"] > 0 else "green"
        confirm_count_str = str(summary["manual_confirm_count"])
        lines.append(
            f"  待人工确认: {self._color_text(confirm_count_str, confirm_color)} 条"
        )

        # 越界样本
        outlier_color = "red" if summary["outlier_count"] > 0 else "green"
        outlier_count_str = str(summary["outlier_count"])
        lines.append(
            f"  硬越界样本: {self._color_text(outlier_count_str, outlier_color)} 条"
        )

        # 权重提醒
        if summary.get("weight_alerts"):
            lines.append("")
            lines.append(self._color_text("  ⚠️  权重配置提醒:", "yellow"))
            for alert in summary["weight_alerts"]:
                lines.append(f"    - {alert}")

        # 预测
        if "next_predicted_score" in summary:
            lines.append("")
            lines.append("🔮 下期预测")
            pred_score_str = f"{summary['next_predicted_score']:.2f}"
            lines.append(
                f"  预测分数: {self._color_text(pred_score_str, 'blue')}"
            )
            lines.append(f"  {summary['prediction_reason']}")

        return ReportSection(
            title="汇总信息",
            content="\n".join(lines),
            level="info",
        )

    def generate_progress_table(
        self,
        scores: List[ProgressScore],
        show_components: bool = True,
    ) -> ReportSection:
        """生成进步曲线表格"""
        lines = ["📈 进步曲线明细"]
        lines.append("-" * 80)

        # 表头
        header = f"{'记录ID':<12} {'日期':<12} {'总分':<8} {'状态':<10}"
        if show_components and scores and scores[0].component_scores:
            fields = list(scores[0].component_scores.keys())
            header += " ".join(f"{f:<10}" for f in fields)
        lines.append(self._color_text(header, "bold"))
        lines.append("-" * 80)

        for score in scores:
            # 状态标识
            if not score.validation.is_valid:
                status = self._color_text("❌ 越界", "red")
            elif score.need_manual_confirm:
                status = self._color_text("⚠️ 待确认", "yellow")
            else:
                status = self._color_text("✓ 正常", "green")

            # 来源标识
            source_marker = {
                "manual": "👤",
                "imported": "📥",
                "legacy": "📜",
                "calculated": "🧮",
            }.get(score.source_type, "")

            row = f"{score.record_id:<12} {score.date:<12} {score.total_score:<8.2f} {source_marker}{status:<8}"

            if show_components and score.component_scores:
                for field in list(scores[0].component_scores.keys()):
                    val = score.component_scores.get(field, 0)
                    row += f" {val:<9.2f}"

            lines.append(row)

        return ReportSection(
            title="进步曲线明细",
            content="\n".join(lines),
            level="info",
        )

    def generate_exception_list(
        self,
        scores: List[ProgressScore],
        include_trace: bool = True,
    ) -> ReportSection:
        """生成异常清单"""
        lines = ["🚨 异常清单"]
        lines.append("=" * 60)

        exceptions = [s for s in scores if not s.validation.is_valid or s.need_manual_confirm]

        if not exceptions:
            lines.append(self._color_text("  ✓ 无异常记录，所有数据均在正常范围内", "green"))
            return ReportSection(
                title="异常清单",
                content="\n".join(lines),
                level="success",
            )

        for i, score in enumerate(exceptions, 1):
            lines.append("")
            lines.append(f"  异常 #{i}: 记录{score.record_id} ({score.date})")

            if not score.validation.is_valid:
                lines.append(self._color_text("  ❌ 硬越界错误:", "red"))
                for err in score.validation.errors:
                    lines.append(f"     - {err}")

            if score.need_manual_confirm:
                lines.append(self._color_text("  ⚠️  待人工确认:", "yellow"))
                for warn in score.validation.warnings:
                    lines.append(f"     - {warn}")

            # 追溯信息
            if include_trace and score.trace_id:
                traces = self.tracer.get_record_history(score.record_id)
                if traces:
                    lines.append(self._color_text("  🔍 数据来源追溯:", "cyan"))
                    lines.append(f"     追溯ID: {score.trace_id}")
                    for t in traces:
                        lines.append(
                            f"     来源: {t.source_file} (类型: {t.source_type}, 时间: {t.timestamp[-8:]})"
                        )
                        if t.notes:
                            lines.append(f"     转换规则: {t.conversion_rule}")

        # 异常分类统计
        lines.append("")
        lines.append("  📋 异常分类统计")
        lines.append("-" * 40)
        error_count = sum(1 for s in exceptions if not s.validation.is_valid)
        warning_count = sum(1 for s in exceptions if s.need_manual_confirm)
        legacy_count = sum(1 for s in exceptions if s.source_type == "legacy")

        lines.append(f"    硬越界错误: {error_count} 条")
        lines.append(f"    待人工确认: {warning_count} 条")
        lines.append(f"    旧口径记录: {legacy_count} 条")

        return ReportSection(
            title="异常清单",
            content="\n".join(lines),
            level="warning" if exceptions else "success",
        )

    def generate_alert_summary(self, scores: List[ProgressScore]) -> ReportSection:
        """生成提醒信息汇总（单位换算、边界等）"""
        lines = ["💡 处理过程提醒"]
        lines.append("=" * 60)

        # 收集所有提醒
        all_alerts = []
        for score in scores:
            for alert in score.alerts:
                all_alerts.append((score.record_id, alert))

        if not all_alerts:
            lines.append("  无处理过程提醒")
            return ReportSection(
                title="处理提醒",
                content="\n".join(lines),
                level="success",
            )

        # 按类型分组
        categories = {
            "单位换算": [],
            "边界检查": [],
            "归一化": [],
            "权重": [],
            "波动检查": [],
            "其他": [],
        }

        for record_id, alert in all_alerts:
            if "[单位换算" in alert:
                categories["单位换算"].append((record_id, alert))
            elif "[边界" in alert:
                categories["边界检查"].append((record_id, alert))
            elif "[归一化" in alert:
                categories["归一化"].append((record_id, alert))
            elif "[权重" in alert:
                categories["权重"].append((record_id, alert))
            elif "[波动" in alert:
                categories["波动检查"].append((record_id, alert))
            else:
                categories["其他"].append((record_id, alert))

        for cat, alerts in categories.items():
            if alerts:
                lines.append("")
                lines.append(self._color_text(f"  [{cat}] ({len(alerts)}条)", "cyan"))
                for record_id, alert in alerts:
                    lines.append(f"    - {alert}")

        return ReportSection(
            title="处理提醒",
            content="\n".join(lines),
            level="info",
        )

    def generate_diff_report(
        self,
        before: List[ProgressScore],
        after: List[ProgressScore],
        note_added: str,
    ) -> ReportSection:
        """生成补录备注后的差异报告"""
        lines = ["📝 补录备注差异对比"]
        lines.append("=" * 60)
        lines.append(f"  新增备注: {note_added}")
        lines.append("-" * 60)

        # 创建ID映射
        before_map = {s.record_id: s for s in before}
        after_map = {s.record_id: s for s in after}

        # 找出变化
        changed = []
        for rid in after_map:
            if rid in before_map:
                b = before_map[rid]
                a = after_map[rid]
                if b.total_score != a.total_score or b.need_manual_confirm != a.need_manual_confirm:
                    changed.append((rid, b, a))

        if not changed:
            lines.append(self._color_text("  备注补充不影响计算结果，仅作记录", "green"))
        else:
            lines.append(f"  影响记录数: {len(changed)}")
            lines.append("")
            header = f"{'记录ID':<12} {'变更项':<15} {'变更前':<12} {'变更后':<12}"
            lines.append(self._color_text(header, "bold"))
            lines.append("-" * 60)

            for rid, b, a in changed:
                if b.total_score != a.total_score:
                    diff = a.total_score - b.total_score
                    lines.append(
                        f"{rid:<12} 总分{'+' if diff > 0 else ''}{diff:+.2f}      "
                        f"{b.total_score:<12.2f} {a.total_score:<12.2f}"
                    )
                if b.need_manual_confirm != a.need_manual_confirm:
                    old_status = "待确认" if b.need_manual_confirm else "正常"
                    new_status = "待确认" if a.need_manual_confirm else "正常"
                    lines.append(
                        f"{rid:<12} 确认状态       {old_status:<12} {new_status:<12}"
                    )

        # 追溯链验证
        lines.append("")
        lines.append("🔗 追溯链完整性验证")
        lines.append("-" * 40)

        for rid in after_map:
            verification = self.tracer.verify_trace_chain(rid)
            status = self._color_text("✓ 完整", "green") if verification["is_complete"] else self._color_text("✗ 异常", "red")
            lines.append(f"  {rid}: {status} ({verification['trace_count']}条追溯记录)")
            if not verification["is_complete"]:
                for issue in verification["issues"]:
                    lines.append(f"    - {issue}")

        return ReportSection(
            title="差异对比",
            content="\n".join(lines),
            level="info",
        )

    def generate_trace_report(self, record_id: str) -> ReportSection:
        """生成单条记录的完整追溯报告"""
        lines = [f"🔍 记录 {record_id} 完整追溯链"]
        lines.append("=" * 60)

        traces = self.tracer.get_record_history(record_id)

        if not traces:
            lines.append(self._color_text("  无追溯记录", "red"))
            return ReportSection(
                title=f"追溯报告 - {record_id}",
                content="\n".join(lines),
                level="error",
            )

        for i, trace in enumerate(reversed(traces), 1):
            lines.append("")
            lines.append(f"  步骤 {i}: {self._color_text(trace.trace_id, 'cyan')}")
            lines.append(f"    时间: {trace.timestamp}")
            lines.append(f"    来源类型: {trace.source_type}")
            lines.append(f"    来源文件: {trace.source_file}")
            if trace.source_line:
                lines.append(f"    来源行号: {trace.source_line}")
            if trace.conversion_rule:
                lines.append(f"    处理规则: {trace.conversion_rule}")
            if trace.original_value:
                lines.append(f"    原始值: {str(trace.original_value)[:80]}")
            if trace.converted_value:
                lines.append(f"    处理后: {str(trace.converted_value)[:80]}")
            if trace.notes:
                lines.append(f"    备注:")
                for note in trace.notes:
                    lines.append(f"      - {note}")
            lines.append(f"    数据哈希: {trace.data_hash}")

        return ReportSection(
            title=f"追溯报告 - {record_id}",
            content="\n".join(lines),
            level="info",
        )

    def print_report(
        self,
        sections: List[ReportSection],
        output_format: str = "console",
    ) -> str:
        """
        打印/输出报告

        Args:
            sections: 报告章节列表
            output_format: console/markdown

        Returns:
            报告内容字符串
        """
        output = []

        for section in sections:
            if output_format == "console":
                output.append(section.content)
            else:
                # Markdown格式
                level_markers = {
                    "info": "ℹ️",
                    "warning": "⚠️",
                    "error": "❌",
                    "success": "✅",
                }
                marker = level_markers.get(section.level, "")
                output.append(f"\n## {marker} {section.title}\n")
                output.append("```")
                output.append(section.content)
                output.append("```")

        result = "\n\n".join(output)

        if output_format == "console":
            print(result)

        return result
