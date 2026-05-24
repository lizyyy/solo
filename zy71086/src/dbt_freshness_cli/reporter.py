import json
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from rich.console import Console
from rich.table import Table as RichTable
from rich.panel import Panel
from rich.text import Text

from .models import (
    FreshnessReport,
    ReportModel,
    Severity,
    ReportIssue,
)


class ReportEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, "value"):
            return obj.value
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        return super().default(obj)


class ReportReporter:
    def __init__(self, report: FreshnessReport, output_dir: Path):
        self.report = report
        self.output_dir = output_dir
        self.console = Console()

    def generate_all(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.generate_json()
        self.generate_markdown()

    def generate_json(self) -> Path:
        json_path = self.output_dir / "freshness_report.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(
                self.report.model_dump(),
                f,
                cls=ReportEncoder,
                indent=2,
                ensure_ascii=False,
            )
        return json_path

    def generate_markdown(self) -> Path:
        md_path = self.output_dir / "freshness_report.md"
        content = self._build_markdown()
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(content)
        return md_path

    def _build_markdown(self) -> str:
        lines: List[str] = []

        lines.append("# DBT 模型新鲜度诊断报告")
        lines.append("")
        lines.append(f"**生成时间**: {self.report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        severity_emoji = self._get_severity_emoji(self.report.severity)
        lines.append(f"## 总体状态: {severity_emoji} {self.report.severity.value.upper()}")
        lines.append("")

        lines.append("### 统计概览")
        lines.append("")
        lines.append("| 状态 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 正常 | {self.report.ok_count} |")
        lines.append(f"| 警告 | {self.report.warning_count} |")
        lines.append(f"| 严重 | {self.report.critical_count} |")
        lines.append(f"| 错误 | {self.report.error_count} |")
        lines.append(f"| 跳过 | {self.report.skipped_count} |")
        lines.append(f"| 缺失 | {self.report.missing_count} |")
        lines.append(f"| **总计** | **{self.report.total_nodes}** |")
        lines.append("")

        if self.report.issues_summary:
            lines.append("### 问题类型汇总")
            lines.append("")
            for issue, count in sorted(self.report.issues_summary.items(), key=lambda x: -x[1]):
                lines.append(f"- **{self._get_issue_display(issue)}**: {count} 个")
            lines.append("")

        if self.report.broken_dependencies:
            lines.append("### 🔗 依赖问题")
            lines.append("")
            for dep_issue in self.report.broken_dependencies:
                lines.append(f"- **{self._get_issue_display(dep_issue.type)}**:")
                lines.append(f"  - 来源: `{dep_issue.from_node}`")
                lines.append(f"  - 目标: `{dep_issue.to_node}`")
                lines.append(f"  - 说明: {dep_issue.message}")
                lines.append("")

        if self.report.late_models:
            lines.append("### ⚠️ 迟到/问题模型")
            lines.append("")
            lines.append("| 严重程度 | 模型名称 | 资源类型 | 状态 | 迟到(分钟) | 问题类型 | 说明 |")
            lines.append("|----------|----------|----------|------|------------|----------|------|")

            for model in self.report.late_models:
                severity_icon = self._get_severity_emoji(model.severity)
                issues_display = ", ".join(self._get_issue_display(i) for i in model.issues)
                minutes_late = f"{model.minutes_late:.1f}" if model.minutes_late is not None else "-"
                message = model.message or "-"

                lines.append(
                    f"| {severity_icon} {model.severity.value.upper()} | "
                    f"`{model.name}` | "
                    f"{model.resource_type.value} | "
                    f"{model.status.value} | "
                    f"{minutes_late} | "
                    f"{issues_display} | "
                    f"{message} |"
                )
            lines.append("")

            lines.append("### 模型详细信息")
            lines.append("")
            for model in self.report.late_models:
                severity_icon = self._get_severity_emoji(model.severity)
                lines.append(f"#### {severity_icon} {model.name}")
                lines.append("")
                lines.append(f"- **唯一ID**: `{model.unique_id}`")
                lines.append(f"- **资源类型**: {model.resource_type.value}")
                lines.append(f"- **运行状态**: {model.status.value}")
                lines.append(f"- **新鲜度状态**: {model.freshness_status.value}")
                lines.append(f"- **严重程度**: {model.severity.value.upper()}")
                if model.minutes_late is not None:
                    lines.append(f"- **迟到时间**: {model.minutes_late:.1f} 分钟")
                if model.last_success_at:
                    lines.append(f"- **上次成功时间**: {model.last_success_at.strftime('%Y-%m-%d %H:%M:%S')}")
                if model.last_data_at:
                    lines.append(f"- **数据更新时间**: {model.last_data_at.strftime('%Y-%m-%d %H:%M:%S')}")
                if model.message:
                    lines.append(f"- **说明**: {model.message}")

                lines.append(f"- **问题类型**: {', '.join(self._get_issue_display(i) for i in model.issues)}")

                if model.upstream_dependencies:
                    lines.append(f"- **上游依赖** ({len(model.upstream_dependencies)}):")
                    for dep in model.upstream_dependencies:
                        lines.append(f"  - `{dep}`")

                if model.downstream_references:
                    lines.append(f"- **下游引用** ({len(model.downstream_references)}):")
                    for ref in model.downstream_references:
                        lines.append(f"  - `{ref}`")

                lines.append("")

        if self.report.report_tables:
            lines.append("### 📊 报表影响分析")
            lines.append("")
            lines.append("| 状态 | 报表表名 | 影响模型数 | 受影响 |")
            lines.append("|------|----------|------------|--------|")
            for table in self.report.report_tables:
                icon = self._get_severity_emoji(table.status)
                impacted = "✅" if table.impacted else "❌"
                lines.append(
                    f"| {icon} {table.status.value.upper()} | "
                    f"`{table.table_name}` | "
                    f"{len(table.affected_models)} | "
                    f"{impacted} |"
                )
            lines.append("")

            for table in self.report.report_tables:
                if table.impacted and table.affected_models:
                    lines.append(f"#### {self._get_severity_emoji(table.status)} {table.table_name}")
                    lines.append("")
                    lines.append(f"- **唯一ID**: `{table.unique_id}`")
                    lines.append(f"- **状态**: {table.status.value.upper()}")
                    lines.append(f"- **影响的模型**:")
                    for model_id in table.affected_models:
                        lines.append(f"  - `{model_id}`")
                    lines.append("")

        if self.report.execution_warnings:
            lines.append("### ⚙️ 执行警告")
            lines.append("")
            for warning in self.report.execution_warnings:
                lines.append(f"- {warning}")
            lines.append("")

        lines.append("---")
        lines.append("*此报告由 DBT 模型新鲜度 CLI 工具自动生成*")

        return "\n".join(lines)

    def print_console_summary(self) -> None:
        severity_color = self._get_severity_color(self.report.severity)
        severity_text = Text(
            f"总体状态: {self.report.severity.value.upper()}",
            style=f"bold {severity_color}"
        )

        self.console.print(Panel(severity_text, title="DBT 模型新鲜度诊断", expand=False))

        stats_table = RichTable(title="统计概览", show_header=True, header_style="bold magenta")
        stats_table.add_column("状态", style="cyan")
        stats_table.add_column("数量", justify="right")
        stats_table.add_row("正常", str(self.report.ok_count), style="green")
        stats_table.add_row("警告", str(self.report.warning_count), style="yellow")
        stats_table.add_row("严重", str(self.report.critical_count), style="red")
        stats_table.add_row("错误", str(self.report.error_count), style="red bold")
        stats_table.add_row("跳过", str(self.report.skipped_count), style="dim")
        stats_table.add_row("缺失", str(self.report.missing_count), style="red dim")
        stats_table.add_row("总计", str(self.report.total_nodes), style="bold")
        self.console.print(stats_table)

        if self.report.issues_summary:
            self.console.print("\n[bold]问题类型汇总:[/bold]")
            for issue, count in sorted(self.report.issues_summary.items(), key=lambda x: -x[1]):
                self.console.print(f"  • {self._get_issue_display(issue)}: {count} 个")

        if self.report.late_models:
            self.console.print(f"\n[bold red]前 10 个问题模型:[/bold red]")
            issues_table = RichTable(show_header=True, header_style="bold magenta")
            issues_table.add_column("程度", style="cyan")
            issues_table.add_column("模型", style="green")
            issues_table.add_column("类型", style="blue")
            issues_table.add_column("迟到(分)", justify="right")
            issues_table.add_column("问题", style="yellow")

            for model in self.report.late_models[:10]:
                severity_style = self._get_severity_color(model.severity)
                issues_display = ", ".join(self._get_issue_display(i) for i in model.issues[:2])
                minutes_late = f"{model.minutes_late:.1f}" if model.minutes_late is not None else "-"

                issues_table.add_row(
                    Text(model.severity.value.upper(), style=severity_style),
                    model.name,
                    model.resource_type.value,
                    minutes_late,
                    issues_display,
                )
            self.console.print(issues_table)

        if self.report.report_tables:
            impacted = [t for t in self.report.report_tables if t.impacted]
            if impacted:
                self.console.print(f"\n[bold blue]受影响报表 ({len(impacted)}):[/bold blue]")
                tables_table = RichTable(show_header=True, header_style="bold magenta")
                tables_table.add_column("状态", style="cyan")
                tables_table.add_column("报表表名", style="green")
                tables_table.add_column("影响模型数", justify="right")

                for table in impacted:
                    color = self._get_severity_color(table.status)
                    tables_table.add_row(
                        Text(table.status.value.upper(), style=color),
                        table.table_name,
                        str(len(table.affected_models)),
                    )
                self.console.print(tables_table)

        json_path = self.output_dir / "freshness_report.json"
        md_path = self.output_dir / "freshness_report.md"
        self.console.print(f"\n[dim]JSON 报告: {json_path}[/dim]")
        self.console.print(f"[dim]Markdown 报告: {md_path}[/dim]")

    @staticmethod
    def _get_severity_emoji(severity: Severity) -> str:
        mapping = {
            Severity.OK: "✅",
            Severity.WARNING: "⚠️",
            Severity.CRITICAL: "🔴",
            Severity.ERROR: "❌",
            Severity.SKIPPED: "⏭️",
            Severity.MISSING: "❓",
        }
        return mapping.get(severity, "❓")

    @staticmethod
    def _get_severity_color(severity: Severity) -> str:
        mapping = {
            Severity.OK: "green",
            Severity.WARNING: "yellow",
            Severity.CRITICAL: "red",
            Severity.ERROR: "red bold",
            Severity.SKIPPED: "dim",
            Severity.MISSING: "magenta",
        }
        return mapping.get(severity, "white")

    @staticmethod
    def _get_issue_display(issue: ReportIssue) -> str:
        mapping = {
            ReportIssue.SOURCE_MISSING: "数据源缺失",
            ReportIssue.MODEL_SKIPPED: "模型跳过",
            ReportIssue.DEPENDENCY_BROKEN: "依赖断裂",
            ReportIssue.MODEL_STALE: "模型过时",
            ReportIssue.DOWNSTREAM_IMPACT: "下游受影响",
            ReportIssue.UPSTREAM_LATE: "上游迟到",
        }
        return mapping.get(issue, issue.value)
