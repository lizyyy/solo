import json
from typing import Any
from datetime import datetime
from rich.console import Console, Group
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from .models import FreshnessReport, FreshnessStatus, BlockReason


class ReportExporter:
    def __init__(self):
        self.status_colors = {
            FreshnessStatus.FRESH: "green",
            FreshnessStatus.WARNING: "yellow",
            FreshnessStatus.STALE: "orange",
            FreshnessStatus.CRITICAL: "red",
            FreshnessStatus.UNKNOWN: "gray",
        }

    def export_json(self, report: FreshnessReport, output_path: str) -> None:
        def _serialize(obj: Any) -> Any:
            if isinstance(obj, datetime):
                return obj.isoformat()
            if hasattr(obj, 'value'):
                return obj.value
            return str(obj)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(
                report.dict(),
                f,
                default=_serialize,
                ensure_ascii=False,
                indent=2
            )

    def export_text(self, report: FreshnessReport, output_path: str) -> None:
        text_report = self._format_text_report(report)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text_report)

    def _format_text_report(self, report: FreshnessReport) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("              镜像源新鲜度阻塞项目归因报告")
        lines.append("=" * 70)
        lines.append("")

        lines.append(f"报告ID: {report.report_id}")
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"镜像源: {report.mirror_source.name} ({report.mirror_source.type})")
        lines.append(f"URL: {report.mirror_source.url}")
        lines.append("")

        lines.append("-" * 70)
        lines.append("【总体状态】")
        lines.append("-" * 70)
        status_map = {
            FreshnessStatus.FRESH: "新鲜",
            FreshnessStatus.WARNING: "警告",
            FreshnessStatus.STALE: "陈旧",
            FreshnessStatus.CRITICAL: "严重",
            FreshnessStatus.UNKNOWN: "未知"
        }
        lines.append(f"  总体状态: {status_map.get(report.overall_status, '未知')}")
        lines.append(f"  总包数: {report.total_packages}")
        lines.append(f"  新鲜: {report.fresh_packages}")
        lines.append(f"  陈旧: {report.stale_packages}")
        lines.append(f"  严重: {report.critical_packages}")
        lines.append(f"  平均延迟: {report.average_delay_hours:.2f} 小时")
        lines.append("")

        if report.has_dirty_data and report.dirty_data_issues:
            lines.append("-" * 70)
            lines.append("【脏数据问题】")
            lines.append("-" * 70)
            issue_type_map = {
                "validation_error": "验证错误",
                "format_error": "格式错误",
                "fallback_applied": "已使用默认值",
                "partial_valid": "部分有效数据",
                "load_failed": "加载失败",
                "unexpected_error": "意外错误",
                "critical_fallback_failed": "关键回退失败"
            }
            for idx, issue in enumerate(report.dirty_data_issues, 1):
                issue_type_display = issue_type_map.get(issue.issue_type, issue.issue_type)
                lines.append(f"\n  {idx}. [{issue_type_display}] {issue.field}")
                lines.append(f"     问题: {issue.message}")
                if issue.value is not None:
                    lines.append(f"     原始值: {issue.value}")
            lines.append("")

        lines.append("-" * 70)
        lines.append("【包新鲜度详情】")
        lines.append("-" * 70)
        for pkg_result in report.package_results:
            status_text = status_map.get(pkg_result.status, "未知")
            lines.append(f"\n  包名: {pkg_result.package_name}")
            lines.append(f"    状态: {status_text}")
            if pkg_result.version_gap_result.version_gap:
                lines.append(f"    版本差距: {pkg_result.version_gap_result.version_gap}")
            if pkg_result.version_gap_result.time_delay_hours is not None:
                lines.append(f"    时间延迟: {pkg_result.version_gap_result.time_delay_hours:.2f} 小时")
            lines.append(f"    同步窗口内: {'是' if pkg_result.in_sync_window else '否'}")
            if pkg_result.block_reason:
                reason_map = {
                    BlockReason.VERSION_GAP_TOO_LARGE: "版本差距过大",
                    BlockReason.OUTSIDE_SYNC_WINDOW: "不在同步窗口",
                    BlockReason.MIRROR_SYNC_FAILED: "镜像同步失败",
                    BlockReason.UPSTREAM_UNAVAILABLE: "上游不可用",
                    BlockReason.MANUAL_CONFIRMATION_REQUIRED: "需要人工确认",
                    BlockReason.NO_DATA: "无数据",
                    BlockReason.UNKNOWN: "未知"
                }
                lines.append(f"    阻塞原因: {reason_map.get(pkg_result.block_reason, '未知')}")
            if pkg_result.recommendation:
                lines.append(f"    建议: {pkg_result.recommendation}")
            if pkg_result.requires_manual_confirm:
                lines.append(f"    需要人工确认: 是")

        lines.append("\n" + "-" * 70)
        lines.append("【项目阻塞归因】")
        lines.append("-" * 70)
        for proj_result in report.project_results:
            lines.append(f"\n  项目: {proj_result.project_name}")
            lines.append(f"    优先级: P{proj_result.priority}")
            lines.append(f"    阻塞状态: {'阻塞' if proj_result.is_blocked else '正常'}")
            if proj_result.blocked_packages:
                lines.append(f"    阻塞包数: {len(proj_result.blocked_packages)}")
                lines.append(f"    阻塞包: {', '.join(proj_result.blocked_packages)}")
            if proj_result.contact:
                lines.append(f"    联系人: {proj_result.contact}")
            if proj_result.is_manually_confirmed:
                lines.append(f"    已人工确认: 是")

        lines.append("\n" + "-" * 70)
        lines.append("【摘要】")
        lines.append("-" * 70)
        for key, value in report.summary.items():
            lines.append(f"  {key}: {value}")

        lines.append("\n" + "=" * 70)
        return "\n".join(lines)

    def format_rich_report(self, report: FreshnessReport) -> Panel:
        status_emoji = {
            FreshnessStatus.FRESH: "✅",
            FreshnessStatus.WARNING: "⚠️",
            FreshnessStatus.STALE: "🔶",
            FreshnessStatus.CRITICAL: "❌",
            FreshnessStatus.UNKNOWN: "❓",
        }

        title = Text("镜像源新鲜度阻塞项目归因报告", style="bold blue")
        subtitle = Text(f"\n报告ID: {report.report_id} | 生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}", style="dim")

        summary_table = Table(show_header=True, header_style="bold magenta")
        summary_table.add_column("指标", style="dim")
        summary_table.add_column("值")

        status_color = self.status_colors[report.overall_status]
        summary_table.add_row("总体状态", f"[{status_color}]{status_emoji[report.overall_status]} {report.overall_status.value}[/{status_color}]")
        summary_table.add_row("镜像源", report.mirror_source.name)
        summary_table.add_row("镜像类型", report.mirror_source.type)
        summary_table.add_row("总包数", str(report.total_packages))
        summary_table.add_row("新鲜包数", f"[green]{report.fresh_packages}[/green]")
        summary_table.add_row("陈旧包数", f"[orange]{report.stale_packages}[/orange]")
        summary_table.add_row("严重包数", f"[red]{report.critical_packages}[/red]")
        summary_table.add_row("平均延迟", f"{report.average_delay_hours:.2f} 小时")
        if report.has_dirty_data:
            summary_table.add_row("脏数据问题", f"[red]{len(report.dirty_data_issues)} 个[/red]")

        dirty_data_table = None
        if report.has_dirty_data and report.dirty_data_issues:
            dirty_data_table = Table(show_header=True, header_style="bold red", title="⚠️  脏数据问题详情")
            dirty_data_table.add_column("序号", style="dim")
            dirty_data_table.add_column("字段")
            dirty_data_table.add_column("问题类型")
            dirty_data_table.add_column("消息")

            issue_type_colors = {
                "validation_error": "red",
                "format_error": "red",
                "fallback_applied": "yellow",
                "partial_valid": "yellow",
                "load_failed": "red",
                "unexpected_error": "red",
                "critical_fallback_failed": "red"
            }

            for idx, issue in enumerate(report.dirty_data_issues, 1):
                color = issue_type_colors.get(issue.issue_type, "white")
                dirty_data_table.add_row(
                    str(idx),
                    issue.field,
                    f"[{color}]{issue.issue_type}[/{color}]",
                    issue.message
                )

        packages_table = Table(show_header=True, header_style="bold cyan", title="包新鲜度详情")
        packages_table.add_column("包名")
        packages_table.add_column("状态")
        packages_table.add_column("版本差距")
        packages_table.add_column("延迟(小时)")
        packages_table.add_column("窗口内")
        packages_table.add_column("阻塞原因")
        packages_table.add_column("需人工确认")

        for pkg in report.package_results:
            status_color = self.status_colors[pkg.status]
            gap = pkg.version_gap_result.version_gap or "-"
            delay = f"{pkg.version_gap_result.time_delay_hours:.1f}" if pkg.version_gap_result.time_delay_hours else "-"
            in_window = "✅" if pkg.in_sync_window else "❌"
            block_reason = pkg.block_reason.value if pkg.block_reason else "-"
            need_confirm = "⚠️" if pkg.requires_manual_confirm else "-"

            packages_table.add_row(
                pkg.package_name,
                f"[{status_color}]{status_emoji[pkg.status]} {pkg.status.value}[/{status_color}]",
                gap,
                delay,
                in_window,
                block_reason,
                need_confirm
            )

        projects_table = Table(show_header=True, header_style="bold green", title="项目阻塞归因")
        projects_table.add_column("项目")
        projects_table.add_column("优先级")
        projects_table.add_column("状态")
        projects_table.add_column("阻塞包数")
        projects_table.add_column("阻塞包")
        projects_table.add_column("人工确认")

        for proj in report.project_results:
            status = "[red]阻塞[/red]" if proj.is_blocked else "[green]正常[/green]"
            blocked_count = str(len(proj.blocked_packages)) if proj.blocked_packages else "0"
            blocked_pkgs = ", ".join(proj.blocked_packages) if proj.blocked_packages else "-"
            confirmed = "✅" if proj.is_manually_confirmed else "-"

            projects_table.add_row(
                proj.project_name,
                f"P{proj.priority}",
                status,
                blocked_count,
                blocked_pkgs,
                confirmed
            )

        content_items = [
            title,
            subtitle,
            Text("\n\n"),
            summary_table,
        ]

        if dirty_data_table is not None:
            content_items.extend([
                Text("\n\n"),
                dirty_data_table
            ])

        content_items.extend([
            Text("\n\n"),
            packages_table,
            Text("\n\n"),
            projects_table
        ])

        content = Group(*content_items)

        return Panel(content, border_style="blue")
