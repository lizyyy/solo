"""
报表生成器
"""

from typing import List
from datetime import datetime
from .models import (
    Change, Alert, CorrelationResult, Report, ChangeType
)


class ReportGenerator:
    def generate_report(
        self,
        changes: List[Change],
        alerts: List[Alert],
        correlations: List[CorrelationResult],
    ) -> Report:
        excluded_changes = [c for c in changes if c.excluded]
        marked_root_causes = [c for c in changes if c.marked_cause]

        report = Report(
            generated_at=datetime.now(),
            changes=changes,
            alerts=alerts,
            correlations=correlations,
            excluded_changes=excluded_changes,
            marked_root_causes=marked_root_causes,
        )

        return report

    def format_text_report(self, report: Report) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("变更告警关联分析报告")
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")

        lines.append(f"总变更数: {len(report.changes)}")
        lines.append(f"总告警数: {len(report.alerts)}")
        lines.append(f"关联对数: {len(report.correlations)}")
        lines.append(f"已排除变更: {len(report.excluded_changes)}")
        lines.append(f"已标记根因: {len(report.marked_root_causes)}")
        lines.append("")

        if report.marked_root_causes:
            lines.append("-" * 80)
            lines.append("【已确认根因】")
            lines.append("-" * 80)
            for cause in report.marked_root_causes:
                lines.append(f"  变更ID: {cause.id}")
                lines.append(f"  类型: {cause.type.value}")
                lines.append(f"  服务: {cause.service}")
                lines.append(f"  时间: {cause.start_time}")
                lines.append(f"  描述: {cause.description}")
                if cause.cause_remark:
                    lines.append(f"  根因说明: {cause.cause_remark}")
                lines.append("")

        lines.append("-" * 80)
        lines.append("【关联分析结果】（按评分降序）")
        lines.append("-" * 80)
        lines.append("")

        if not report.correlations:
            lines.append("  未找到任何关联。")
            lines.append("")
        else:
            for i, corr in enumerate(report.correlations, 1):
                change = corr.change
                alert = corr.alert
                score = corr.score

                lines.append(f"【关联 #{i}】总评分: {score.total_score}")
                if corr.is_root_cause:
                    lines.append("  [★ 已标记为根因]")
                lines.append(f"  ┌─ 变更信息")
                lines.append(f"  │  ID: {change.id}")
                lines.append(f"  │  类型: {change.type.value}")
                lines.append(f"  │  服务: {change.service}")
                lines.append(f"  │  时间: {change.start_time} ~ {change.end_time or '进行中'}")
                lines.append(f"  │  描述: {change.description}")
                lines.append(f"  ├─ 告警信息")
                lines.append(f"  │  ID: {alert.id}")
                lines.append(f"  │  级别: {alert.severity}")
                lines.append(f"  │  指标: {alert.metric_type.value}")
                lines.append(f"  │  时间: {alert.start_time}")
                lines.append(f"  │  描述: {alert.description}")
                lines.append(f"  └─ 评分详情")
                lines.append(f"     时间评分: {score.time_score} - {score.time_reason}")
                lines.append(f"     服务评分: {score.service_score} - {score.service_reason}")
                lines.append(f"     实例评分: {score.instance_score} - {score.instance_reason}")
                lines.append(f"     租户评分: {score.tenant_score} - {score.tenant_reason}")
                lines.append(f"     指标评分: {score.metric_score} - {score.metric_reason}")
                lines.append("")

        if report.excluded_changes:
            lines.append("-" * 80)
            lines.append("【已排除的变更】（保留用于复盘讨论）")
            lines.append("-" * 80)
            lines.append("")
            for change in report.excluded_changes:
                lines.append(f"  变更ID: {change.id}")
                lines.append(f"  类型: {change.type.value}")
                lines.append(f"  服务: {change.service}")
                lines.append(f"  时间: {change.start_time}")
                lines.append(f"  描述: {change.description}")
                lines.append(f"  排除原因: {change.exclude_reason or '未说明'}")
                lines.append("")

        lines.append("=" * 80)
        return "\n".join(lines)

    def format_summary(self, report: Report) -> str:
        lines = []
        lines.append("变更告警关联分析摘要")
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        if report.marked_root_causes:
            lines.append(f"✅ 已确认根因: {len(report.marked_root_causes)} 个")
            for cause in report.marked_root_causes:
                lines.append(f"   - {cause.id}: {cause.type.value} - {cause.service}")

        high_correlations = [c for c in report.correlations if c.score.total_score >= 0.7]
        medium_correlations = [c for c in report.correlations if 0.4 <= c.score.total_score < 0.7]
        low_correlations = [c for c in report.correlations if c.score.total_score < 0.4]

        lines.append(f"🔍 高关联(≥0.7): {len(high_correlations)} 对")
        lines.append(f"⚖️  中关联(0.4-0.7): {len(medium_correlations)} 对")
        lines.append(f"❓ 低关联(<0.4): {len(low_correlations)} 对")
        lines.append(f"🚫 已排除: {len(report.excluded_changes)} 个变更")

        return "\n".join(lines)
