"""Markdown 报告生成器"""

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base import ReportGenerator, ReportResult
from ..models.config import ProjectConfig
from ..models.quarantine import QuarantineStore
from ..models.violation import Violation, ViolationSeverity


class MarkdownReportGenerator(ReportGenerator):
    """Markdown 复盘报告生成器"""

    def __init__(
        self,
        project_config: ProjectConfig,
        quarantine_store: Optional[QuarantineStore] = None,
        schedule_analysis: Optional[Dict[str, Any]] = None,
    ):
        """
        初始化 Markdown 报告生成器

        Args:
            project_config: 项目配置
            quarantine_store: 隔离存储（可选）
            schedule_analysis: 排班分析结果（可选）
        """
        super().__init__(project_config, quarantine_store)
        self.schedule_analysis = schedule_analysis

    def generate(self, output_path: Optional[Path] = None) -> ReportResult:
        """
        生成 Markdown 复盘报告

        Args:
            output_path: 输出路径

        Returns:
            报告生成结果
        """
        result = ReportResult()

        try:
            if output_path is None:
                output_path = self.config.output_dir / "review_report.md"

            self._ensure_output_dir(output_path)

            content = self._generate_content()

            with open(output_path, "w", encoding="utf-8") as f:
                f.write(content)

            result.success = True
            result.output_path = output_path
            result.message = f"Markdown 复盘报告已生成: {output_path}"

            if self.quarantine_store:
                result.summary = self.quarantine_store.get_statistics()

        except Exception as e:
            result.add_error(f"生成 Markdown 报告失败: {str(e)}")

        return result

    def _generate_content(self) -> str:
        """
        生成报告内容

        Returns:
            Markdown 格式的报告内容
        """
        lines = []

        lines.append(self._generate_header())
        lines.append("")
        lines.append(self._generate_summary())
        lines.append("")
        lines.append(self._generate_statistics())
        lines.append("")

        if self.quarantine_store:
            lines.append(self._generate_violations_section())
            lines.append("")
            lines.append(self._generate_quarantine_section())
            lines.append("")

        if self.schedule_analysis:
            lines.append(self._generate_schedule_analysis_section())
            lines.append("")

        lines.append(self._generate_footer())

        return "\n".join(lines)

    def _generate_header(self) -> str:
        """生成报告头部"""
        lines = []
        lines.append("# 📻 频率排班守门员 - 应急演练复盘报告")
        lines.append("")
        lines.append(f"**演练项目**: {self.config.project_name}")
        lines.append(f"**演练名称**: {self.config.exercise_name or '未指定'}")
        lines.append(f"**报告生成时间**: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        return "\n".join(lines)

    def _generate_summary(self) -> str:
        """生成摘要部分"""
        lines = []
        lines.append("## 📋 执行摘要")
        lines.append("")

        if self.quarantine_store:
            stats = self.quarantine_store.get_statistics()

            total_violations = stats.get("total_entries", 0)
            critical = stats.get("by_severity", {}).get("critical", 0)
            high = stats.get("by_severity", {}).get("high", 0)
            reviewed = stats.get("review_status", {}).get("reviewed", 0)
            pending = stats.get("review_status", {}).get("quarantined", 0)

            risk_level = "✅ 低风险"
            if critical > 0:
                risk_level = "🚨 高风险"
            elif high > 0:
                risk_level = "⚠️ 中风险"

            lines.append(f"**风险等级**: {risk_level}")
            lines.append("")
            lines.append("| 指标 | 数量 |")
            lines.append("|------|------|")
            lines.append(f"| 违规条目总数 | {total_violations} |")
            lines.append(f"| 🔴 严重违规 | {critical} |")
            lines.append(f"| 🟠 高优先级 | {high} |")
            lines.append(f"| ✅ 已复核 | {reviewed} |")
            lines.append(f"| ⏳ 待处理 | {pending} |")
        else:
            lines.append("暂无隔离存储数据可分析。")

        return "\n".join(lines)

    def _generate_statistics(self) -> str:
        """生成统计部分"""
        lines = []
        lines.append("## 📊 详细统计")
        lines.append("")

        if self.quarantine_store:
            stats = self.quarantine_store.get_statistics()

            lines.append("### 按违规类别分布")
            lines.append("")

            by_category = stats.get("by_category", {})
            if by_category:
                lines.append("| 类别 | 数量 |")
                lines.append("|------|------|")
                for category, count in sorted(by_category.items(), key=lambda x: x[1], reverse=True):
                    category_name = self._get_violation_category_name(category)
                    lines.append(f"| {category_name} | {count} |")
            else:
                lines.append("暂无按类别统计数据。")

            lines.append("")
            lines.append("### 按来源类型分布")
            lines.append("")

            by_source = stats.get("by_source_type", {})
            if by_source:
                source_names = {
                    "radio": "电台清单",
                    "frequency": "频率分配",
                    "schedule": "值守排班",
                    "log": "通联日志",
                }
                lines.append("| 来源类型 | 数量 |")
                lines.append("|----------|------|")
                for source_type, count in sorted(by_source.items(), key=lambda x: x[1], reverse=True):
                    name = source_names.get(source_type, source_type)
                    lines.append(f"| {name} | {count} |")
            else:
                lines.append("暂无按来源统计数据。")
        else:
            lines.append("暂无统计数据。")

        return "\n".join(lines)

    def _generate_violations_section(self) -> str:
        """生成违规详情部分"""
        lines = []
        lines.append("## ⚠️ 违规详情")
        lines.append("")

        if not self.quarantine_store or not self.quarantine_store.entries:
            lines.append("暂无违规记录。")
            return "\n".join(lines)

        all_violations = []
        for entry in self.quarantine_store.entries:
            all_violations.extend(entry.violations)

        if not all_violations:
            lines.append("暂无违规记录。")
            return "\n".join(lines)

        grouped = self._group_violations_by_severity(all_violations)

        severity_order = ["critical", "high", "medium", "low", "info"]
        severity_titles = {
            "critical": "🔴 严重违规",
            "high": "🟠 高优先级违规",
            "medium": "🟡 中等违规",
            "low": "🟢 低优先级违规",
            "info": "ℹ️ 提示信息",
        }

        for severity in severity_order:
            violations = grouped.get(severity, [])
            if not violations:
                continue

            lines.append(f"### {severity_titles[severity]} ({len(violations)})")
            lines.append("")

            for i, v in enumerate(violations, 1):
                summary = self._get_violation_summary(v)
                lines.append(f"#### {i}. {summary['message']}")
                lines.append("")

                if v.evidence:
                    lines.append("**证据详情**:")
                    lines.append("")
                    if v.evidence.field_name:
                        lines.append(f"- 字段: `{v.evidence.field_name}`")
                    if v.evidence.expected_value:
                        lines.append(f"- 期望值: `{v.evidence.expected_value}`")
                    if v.evidence.actual_value:
                        lines.append(f"- 实际值: `{v.evidence.actual_value}`")
                    if v.evidence.context:
                        lines.append(f"- 上下文: {v.evidence.context}")
                    lines.append("")

                lines.append("**元数据**:")
                lines.append("")
                if v.source_file:
                    lines.append(f"- 来源文件: `{v.source_file}`")
                if v.line_number:
                    lines.append(f"- 行号: {v.line_number}")
                if v.call_sign:
                    lines.append(f"- 呼号: `{v.call_sign}`")
                if v.channel_id:
                    lines.append(f"- 频道: `{v.channel_id}`")
                if v.date:
                    lines.append(f"- 日期: {v.date}")
                if v.time_start and v.time_end:
                    lines.append(f"- 时段: {v.time_start} - {v.time_end}")
                lines.append(f"- 状态: {v.status}")
                lines.append("")

                if v.status == "open":
                    lines.append("> ⏳ 待复核处理")
                elif v.status == "reviewed":
                    if v.review_decision:
                        decision_text = "确认违规" if v.review_decision == "confirm" else "驳回误判"
                        lines.append(f"> ✅ 已复核 ({decision_text})")
                        if v.review_notes:
                            lines.append(f">")
                            lines.append(f"> 复核意见: {v.review_notes}")
                lines.append("")
                lines.append("---")
                lines.append("")

        return "\n".join(lines)

    def _generate_quarantine_section(self) -> str:
        """生成隔离区详情部分"""
        lines = []
        lines.append("## 📦 隔离区详情")
        lines.append("")

        if not self.quarantine_store or not self.quarantine_store.entries:
            lines.append("隔离区为空。")
            return "\n".join(lines)

        lines.append(f"**隔离区条目总数**: {len(self.quarantine_store.entries)}")
        lines.append("")

        pending_entries = [e for e in self.quarantine_store.entries if e.status == "quarantined"]
        reviewed_entries = [e for e in self.quarantine_store.entries if e.status == "reviewed"]

        lines.append(f"**待处理条目**: {len(pending_entries)}")
        lines.append(f"**已复核条目**: {len(reviewed_entries)}")
        lines.append("")

        if pending_entries:
            lines.append("### 待处理条目清单")
            lines.append("")
            lines.append("| ID | 来源类型 | 原因 | 违规数 |")
            lines.append("|----|----------|------|--------|")
            for entry in pending_entries[:20]:
                source_name = {
                    "radio": "电台清单",
                    "frequency": "频率分配",
                    "schedule": "值守排班",
                    "log": "通联日志",
                }.get(entry.source_type, entry.source_type)
                reason = entry.quarantine_reason[:40] + "..." if len(entry.quarantine_reason) > 40 else entry.quarantine_reason
                lines.append(f"| {entry.entry_id[:8]}... | {source_name} | {reason} | {len(entry.violations)} |")

            if len(pending_entries) > 20:
                lines.append("")
                lines.append(f"> 还有 {len(pending_entries) - 20} 条待处理条目未显示")

        return "\n".join(lines)

    def _generate_schedule_analysis_section(self) -> str:
        """生成排班分析部分"""
        lines = []
        lines.append("## 📅 排班冲突分析")
        lines.append("")

        if not self.schedule_analysis:
            lines.append("暂无排班分析数据。")
            return "\n".join(lines)

        channel_usage = self.schedule_analysis.get("channel_usage", {})
        conflicts = self.schedule_analysis.get("conflicts", {})

        channel_conflicts = conflicts.get("channel_conflicts", [])
        operator_conflicts = conflicts.get("operator_conflicts", [])

        if channel_conflicts or operator_conflicts:
            lines.append("### ⚠️ 检测到的冲突")
            lines.append("")

            if channel_conflicts:
                lines.append(f"**频道冲突**: {len(channel_conflicts)} 处")
                lines.append("")
                for i, conflict in enumerate(channel_conflicts[:10], 1):
                    channel = conflict.get("channel_id", "未知频道")
                    shifts = conflict.get("conflicting_shifts", [])
                    lines.append(f"{i}. 频道 `{channel}` 冲突:")
                    for shift in shifts:
                        operator = shift.get("operator", "未知操作员")
                        time_start = shift.get("time_start", "")
                        time_end = shift.get("time_end", "")
                        lines.append(f"   - {operator}: {time_start} - {time_end}")
                    lines.append("")

                if len(channel_conflicts) > 10:
                    lines.append(f"> 还有 {len(channel_conflicts) - 10} 处频道冲突未显示")
                    lines.append("")

            if operator_conflicts:
                lines.append(f"**操作员冲突**: {len(operator_conflicts)} 处")
                lines.append("")
                for i, conflict in enumerate(operator_conflicts[:10], 1):
                    operator = conflict.get("operator", "未知操作员")
                    shifts = conflict.get("conflicting_shifts", [])
                    lines.append(f"{i}. 操作员 `{operator}` 冲突:")
                    for shift in shifts:
                        channel = shift.get("channel_id", "未知频道")
                        time_start = shift.get("time_start", "")
                        time_end = shift.get("time_end", "")
                        lines.append(f"   - {channel}: {time_start} - {time_end}")
                    lines.append("")

                if len(operator_conflicts) > 10:
                    lines.append(f"> 还有 {len(operator_conflicts) - 10} 处操作员冲突未显示")
                    lines.append("")
        else:
            lines.append("✅ 未检测到排班冲突")
            lines.append("")

        if channel_usage:
            lines.append("### 📊 频道占用情况")
            lines.append("")
            lines.append("| 频道ID | 占用时段数 | 操作员数 |")
            lines.append("|--------|-----------|---------|")
            for channel_id, usage in list(channel_usage.items())[:15]:
                time_slots = usage.get("time_slots", [])
                operators = usage.get("operators", [])
                lines.append(f"| {channel_id} | {len(time_slots)} | {len(operators)} |")

            if len(channel_usage) > 15:
                lines.append("")
                lines.append(f"> 还有 {len(channel_usage) - 15} 个频道未显示")

        return "\n".join(lines)

    def _generate_footer(self) -> str:
        """生成报告页脚"""
        lines = []
        lines.append("---")
        lines.append("")
        lines.append("## 📝 复核流程指引")
        lines.append("")
        lines.append("1. 使用 `fg review --list` 查看待处理条目")
        lines.append("2. 使用 `fg review --confirm <entry_id>` 确认违规")
        lines.append("3. 使用 `fg review --dismiss <entry_id>` 驳回误判")
        lines.append("4. 使用 `fg export` 重新生成完整报告")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append(f"*此报告由频率排班守门员生成于 {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}*")
        lines.append("")
        lines.append("### 配置参数")
        lines.append("")
        lines.append(f"- 频段范围: {self.config.min_frequency_mhz} - {self.config.max_frequency_mhz} MHz")
        lines.append(f"- 最大功率限制: {self.config.max_power_watts} W")
        lines.append(f"- 呼号格式: `{self.config.call_sign_pattern}`")

        return "\n".join(lines)
