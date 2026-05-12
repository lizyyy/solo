from typing import List, Dict, Any, Optional
from datetime import datetime

from .models import (
    ChangeProject,
    ChangeCheckResult,
    ReportSummary,
    ChangeStatus,
    BackfillStatus,
)


class ReportGenerator:
    def generate_summary(
        self,
        project: ChangeProject,
        check_results: List[ChangeCheckResult]
    ) -> ReportSummary:
        summary = ReportSummary(
            total_changes=len(project.metric_changes),
            issues_found=len([r for r in check_results if not r.passed])
        )

        for change_id, change in project.metric_changes.items():
            metric = change.new_metric
            old_metric = change.old_metric

            dashboards = [
                {
                    "id": d_id,
                    "name": project.dashboards[d_id].name if d_id in project.dashboards else d_id,
                    "owner": project.dashboards[d_id].owner if d_id in project.dashboards else None
                }
                for d_id in change.affected_dashboards
            ]

            backfills = [
                {
                    "task_id": task_id,
                    "status": project.backfill_tasks[task_id].status if task_id in project.backfill_tasks else "unknown",
                    "start": project.backfill_tasks[task_id].start_date if task_id in project.backfill_tasks else None
                }
                for task_id in change.backfill_tasks
            ]

            change_info = {
                "change_id": change_id,
                "metric_id": metric.metric_id,
                "metric_name": metric.name,
                "old_metric_id": old_metric.metric_id if old_metric else None,
                "renamed": bool(change.renamed_from),
                "business_owner": metric.business_owner,
                "tech_owner": metric.tech_owner,
                "affected_dashboards": dashboards,
                "backfill_tasks": backfills,
                "current_status": change.status.value,
                "history_count": len(change.history)
            }

            if change.status == ChangeStatus.NOTIFY_BUSINESS:
                summary.notify_business.append(change_info)
            elif change.status == ChangeStatus.NEEDS_BACKFILL:
                summary.needs_backfill.append(change_info)
            else:
                summary.internal_only.append(change_info)

        return summary

    def generate_text_report(
        self,
        project: ChangeProject,
        summary: ReportSummary
    ) -> str:
        lines = []

        lines.append("=" * 70)
        lines.append(f"项目: {project.name}")
        lines.append(f"项目ID: {project.project_id}")
        lines.append(f"创建人: {project.created_by}")
        lines.append(f"创建时间: {project.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 70)
        lines.append("")

        lines.append("📊 变更概览")
        lines.append(f"  总变更数: {summary.total_changes}")
        lines.append(f"  需要通知业务: {len(summary.notify_business)} 项")
        lines.append(f"  需要回填: {len(summary.needs_backfill)} 项")
        lines.append(f"  仅内部调整: {len(summary.internal_only)} 项")
        lines.append("")

        if summary.notify_business:
            lines.append("=" * 70)
            lines.append("🔴 必须通知业务的变更（SQL/计算逻辑发生改变，业务需确认")
            lines.append("=" * 70)
            for info in summary.notify_business:
                lines.append("")
                lines.append(f"  指标: {info['metric_name']}")
                lines.append(f"  变更ID: {info['change_id']}")
                if info['renamed']:
                    lines.append(f"  ⚠️  重命名: {info['old_metric_id']} -> {info['metric_id']}")
                lines.append(f"  业务负责人: {info['business_owner'] or '⚠️ 未设置'}")
                lines.append(f"  技术负责人: {info['tech_owner'] or '⚠️ 未设置'}")
                if info['affected_dashboards']:
                    lines.append(f"  影响看板 ({len(info['affected_dashboards'])} 个:")
                    for d in info['affected_dashboards']:
                        owner_info = f" (负责人: {d['owner']})" if d['owner'] else " (⚠️ 无负责人)"
                        lines.append(f"    - {d['name']}{owner_info}")

        if summary.needs_backfill:
            lines.append("")
            lines.append("=" * 70)
            lines.append("🟡 需要回填数据（历史数据需重新计算")
            lines.append("=" * 70)
            for info in summary.needs_backfill:
                lines.append("")
                lines.append(f"  指标: {info['metric_name']}")
                lines.append(f"  变更ID: {info['change_id']}")
                lines.append(f"  业务负责人: {info['business_owner'] or '⚠️ 未设置'}")
                if info['backfill_tasks']:
                    lines.append(f"  回填任务 ({len(info['backfill_tasks'])} 个:")
                    for b in info['backfill_tasks']:
                        status_emoji = {
                            "pending": "⏳",
                            "running": "🔄",
                            "succeeded": "✅",
                            "failed": "❌",
                            "not_needed": "ℹ️"
                        }.get(b['status'], "❓")
                        lines.append(f"    {status_emoji} {b['task_id']} [{b['status']}]")

        if summary.internal_only:
            lines.append("")
            lines.append("=" * 70)
            lines.append("🟢 仅内部调整（不影响业务感知）")
            lines.append("=" * 70)
            for info in summary.internal_only:
                lines.append("")
                lines.append(f"  指标: {info['metric_name']}")
                lines.append(f"  变更ID: {info['change_id']}")
                lines.append(f"  当前状态: {info['current_status']}")

        lines.append("")
        lines.append("=" * 70)
        lines.append("📋 行动建议")
        lines.append("=" * 70)
        lines.append("")

        if summary.notify_business:
            lines.append("1. 🔴 优先处理业务通知")
            lines.append(f"   需联系 {len(summary.notify_business)} 个业务负责人确认变更影响")
            lines.append("")
        if summary.needs_backfill:
            lines.append("2. 🟡 跟进数据回填")
            lines.append(f"   监控 {len(summary.needs_backfill)} 个指标的回填任务状态")
            lines.append("")
        if summary.internal_only:
            lines.append("3. 🟢 内部跟踪")
            lines.append(f"   {len(summary.internal_only)} 项变更仅需内部监控")

        lines.append("")
        lines.append("=" * 70)
        lines.append("✅ 业务闭环判断标准")
        lines.append("=" * 70)
        lines.append("")
        lines.append("业务已闭环当且仅当:")
        lines.append("  - 所有notify_business状态的变更都收到业务确认")
        lines.append("  - 所有needs_backfill状态的回填任务都已成功")
        lines.append("  - 所有负责人信息已完整")
        lines.append("")

        all_closed = True
        if summary.notify_business:
            all_closed = False
            lines.append(f"❌ 仍有 {len(summary.notify_business)} 项需要业务确认")
        if summary.needs_backfill:
            all_closed = False
            lines.append(f"❌ 仍有 {len(summary.needs_backfill)} 项需等待回填")

        if all_closed:
            lines.append("✅ 所有变更已闭环！")
        else:
            lines.append(f"⚠️  业务未完全闭环，还需跟进上述事项")

        return "\n".join(lines)

    def generate_markdown_report(
        self,
        project: ChangeProject,
        summary: ReportSummary
    ) -> str:
        lines = []

        lines.append(f"# 报表口径变更报告 - {project.name}")
        lines.append("")
        lines.append(f"- **项目ID**: {project.project_id}")
        lines.append(f"- **创建人**: {project.created_by}")
        lines.append(f"- **创建时间**: {project.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- **总变更数**: {summary.total_changes}")
        lines.append("")

        if summary.notify_business:
            lines.append("## 🔴 必须通知业务")
            lines.append("")
            lines.append("| 指标名称 | 指标ID | 业务负责人 | 技术负责人 | 影响看板数 | 状态 |")
            lines.append("|---------|--------|-----------|-----------|-----------|------|")
            for info in summary.notify_business:
                lines.append(
                    f"| {info['metric_name']} | {info['metric_id']} | "
                    f"{info['business_owner'] or '⚠️ 未设置'} | "
                    f"{info['tech_owner'] or '⚠️ 未设置'} | "
                    f"{len(info['affected_dashboards'])} | {info['current_status']} |"
                )
            lines.append("")

        if summary.needs_backfill:
            lines.append("## 🟡 需要回填")
            lines.append("")
            lines.append("| 指标名称 | 指标ID | 回填任务数 | 状态 |")
            lines.append("|---------|--------|-----------|------|")
            for info in summary.needs_backfill:
                lines.append(
                    f"| {info['metric_name']} | {info['metric_id']} | "
                    f"{len(info['backfill_tasks'])} | {info['current_status']} |"
                )
            lines.append("")

        if summary.internal_only:
            lines.append("## 🟢 仅内部调整")
            lines.append("")
            lines.append("| 指标名称 | 指标ID | 影响看板数 | 状态 |")
            lines.append("|---------|--------|-----------|------|")
            for info in summary.internal_only:
                lines.append(
                    f"| {info['metric_name']} | {info['metric_id']} | "
                    f"{len(info['affected_dashboards'])} | {info['current_status']} |"
                )
            lines.append("")

        lines.append("## ✅ 业务闭环状态")
        lines.append("")

        all_closed = (not summary.notify_business) and (not summary.needs_backfill)

        if all_closed:
            lines.append("**状态: ✅ 已闭环**")
        else:
            lines.append("**状态: ⚠️ 未闭环**")
            lines.append("")
            if summary.notify_business:
                lines.append(f"- 需业务确认: {len(summary.notify_business)} 项")
            if summary.needs_backfill:
                lines.append(f"- 需回填完成: {len(summary.needs_backfill)} 项")

        return "\n".join(lines)
