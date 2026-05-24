from __future__ import annotations

import json
import dataclasses
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .models import (
    AnalysisResult,
    CoverageGap,
    DeprecatedScopeUsage,
    ExitCode,
    ParseIssue,
    ReportConfig,
    Severity,
    SourceLocation,
)


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if dataclasses.is_dataclass(obj):
            return dataclasses.asdict(obj)
        if isinstance(obj, set):
            return list(obj)
        if isinstance(obj, Path):
            return str(obj)
        return super().default(obj)


class ConsoleReporter:
    def __init__(self, verbose: bool = False):
        self.console = Console()
        self.verbose = verbose

    def print_summary(self, result: AnalysisResult) -> None:
        self.console.print("\n")
        self.console.print(
            Panel.fit(
                "[bold cyan]Auth Scope 覆盖检查报告[/bold cyan]",
                subtitle=f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            )
        )

        self._print_statistics(result)
        self._print_deprecated_scope_usages(result)
        self._print_parse_issues(result)
        self._print_coverage_gaps(result)
        self._print_exit_code_explanation(result)

    def _print_statistics(self, result: AnalysisResult) -> None:
        table = Table(title="📊 统计摘要", show_header=True, header_style="bold magenta")
        table.add_column("项目", style="cyan")
        table.add_column("数量", justify="right")
        table.add_column("状态", justify="center")

        meta = result.metadata
        table.add_row("API 总数", str(meta.get("total_apis", 0)), "✅")
        table.add_row("Scope 总数", str(meta.get("total_scopes", 0)), "✅")
        table.add_row("SDK 示例数", str(meta.get("total_sdk_examples", 0)), "✅")
        table.add_row("文档片段数", str(meta.get("total_doc_fragments", 0)), "✅")
        table.add_row("调用日志数", str(meta.get("total_call_logs", 0)), "✅")
        table.add_row()

        sdk_gaps = meta.get("sdk_gaps_count", 0)
        doc_gaps = meta.get("doc_gaps_count", 0)
        scope_gaps = meta.get("scope_gaps_count", 0)

        table.add_row(
            "SDK 缺口",
            str(sdk_gaps),
            "❌" if sdk_gaps > 0 else "✅",
        )
        table.add_row(
            "文档缺口",
            str(doc_gaps),
            "⚠️" if doc_gaps > 0 else "✅",
        )
        table.add_row(
            "调用缺口",
            str(scope_gaps),
            "ℹ️" if scope_gaps > 0 else "✅",
        )
        table.add_row()

        parse_errors = meta.get("parse_errors_count", 0)
        parse_warnings = meta.get("parse_warnings_count", 0)
        deprecated_count = meta.get("deprecated_scope_count", 0)
        table.add_row(
            "解析错误",
            str(parse_errors),
            "❌" if parse_errors > 0 else "✅",
        )
        table.add_row(
            "解析警告",
            str(parse_warnings),
            "⚠️" if parse_warnings > 0 else "✅",
        )
        table.add_row(
            "过期 Scope 使用",
            str(deprecated_count),
            "⚠️" if deprecated_count > 0 else "✅",
        )

        self.console.print(table)

    def _print_deprecated_scope_usages(self, result: AnalysisResult) -> None:
        deprecated_usages = result.deprecated_scope_usages
        if not deprecated_usages:
            return

        self.console.print("\n[bold yellow]⚠️  过期 Scope 使用检测[/bold yellow]")
        for usage in deprecated_usages:
            self.console.print(f"  [yellow]●[/yellow] Scope: [bold yellow]{usage.scope_name}[/bold yellow]")
            self.console.print(f"     来源: {usage.source}")
            if usage.location:
                self.console.print(f"     定位: [dim]{usage.location}[/dim]")
            if usage.recommendation:
                self.console.print(f"     建议: {usage.recommendation}")
            self.console.print()

    def _print_parse_issues(self, result: AnalysisResult) -> None:
        if not result.parse_issues:
            return

        if not self.verbose:
            error_count = sum(
                1 for i in result.parse_issues if i.severity in (Severity.ERROR, Severity.CRITICAL)
            )
            warn_count = sum(1 for i in result.parse_issues if i.severity == Severity.WARNING)
            if error_count + warn_count > 0:
                self.console.print(
                    f"\n[yellow]💡 共 {len(result.parse_issues)} 个解析问题 "
                    f"(使用 --verbose 查看详情)[/yellow]"
                )
            return

        self.console.print("\n[bold yellow]⚠️  解析问题[/bold yellow]")
        for issue in result.parse_issues:
            severity_color = {
                Severity.INFO: "blue",
                Severity.WARNING: "yellow",
                Severity.ERROR: "red",
                Severity.CRITICAL: "bold red",
            }.get(issue.severity, "white")

            self.console.print(
                f"  [{severity_color}]●[/{severity_color}] "
                f"[dim]{issue.location}[/dim]: {issue.message}"
            )

    def _print_coverage_gaps(self, result: AnalysisResult) -> None:
        all_gaps = (
            result.sdk_coverage_gaps
            + result.doc_coverage_gaps
            + result.scope_coverage_gaps
        )

        if not all_gaps:
            self.console.print("\n[bold green]🎉 未发现覆盖缺口![/bold green]")
            return

        self.console.print("\n[bold red]❌ 覆盖缺口详情[/bold red]")

        for gap in all_gaps:
            severity_color = {
                Severity.INFO: "blue",
                Severity.WARNING: "yellow",
                Severity.ERROR: "red",
                Severity.CRITICAL: "bold red",
            }.get(gap.severity, "white")

            self.console.print(f"\n  [{severity_color}]▲[/{severity_color}] [bold]{gap.api_key}[/bold]")
            self.console.print(f"     来源: {gap.source}")
            if gap.source_location:
                self.console.print(f"     定位: [dim]{gap.source_location}[/dim]")
            if gap.missing_scopes:
                self.console.print(
                    f"     [red]缺少: {', '.join(gap.missing_scopes)}[/red]"
                )
            if gap.extra_scopes:
                self.console.print(
                    f"     [yellow]多余: {', '.join(gap.extra_scopes)}[/yellow]"
                )
            if self.verbose and gap.explanation:
                self.console.print(f"     说明: {gap.explanation}")

    def _print_exit_code_explanation(self, result: AnalysisResult) -> None:
        exit_code = self._determine_exit_code(result)

        self.console.print("\n[bold]📋 退出码说明:[/bold]")
        table = Table(show_header=True, header_style="bold dim")
        table.add_column("退出码", justify="center")
        table.add_column("含义")
        table.add_column("当前状态", justify="center")

        for code in ExitCode:
            is_current = code == exit_code
            style = "bold green" if is_current else "dim"
            marker = "←" if is_current else ""
            table.add_row(
                f"[{style}]{code.value}[/{style}]",
                code.name.replace("_", " ").title(),
                marker,
            )

        self.console.print(table)

    def _determine_exit_code(self, result: AnalysisResult) -> ExitCode:
        if result.has_errors():
            return ExitCode.PARSE_ERROR
        if result.has_gaps():
            return ExitCode.COVERAGE_GAP
        return ExitCode.SUCCESS


class FileReporter:
    def __init__(self, config: ReportConfig):
        self.config = config
        config.output_dir.mkdir(parents=True, exist_ok=True)

    def generate(self, result: AnalysisResult) -> None:
        if self.config.include_json:
            self._write_json(result)
        if self.config.include_markdown:
            self._write_markdown(result)

    def _write_json(self, result: AnalysisResult) -> None:
        output_path = self.config.output_dir / "coverage_report.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, cls=EnhancedJSONEncoder, indent=2, ensure_ascii=False)

    def _write_markdown(self, result: AnalysisResult) -> None:
        output_path = self.config.output_dir / "coverage_report.md"
        content = self._build_markdown(result)
        output_path.write_text(content, encoding="utf-8")

    def _build_markdown(self, result: AnalysisResult) -> str:
        lines: List[str] = []

        lines.append("# Auth Scope 覆盖检查报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 执行摘要")
        lines.append("")
        lines.append("| 项目 | 数量 | 状态 |")
        lines.append("|------|------|------|")
        meta = result.metadata
        lines.append(f"| API 总数 | {meta.get('total_apis', 0)} | ✅ |")
        lines.append(f"| Scope 总数 | {meta.get('total_scopes', 0)} | ✅ |")
        lines.append(f"| SDK 示例数 | {meta.get('total_sdk_examples', 0)} | ✅ |")
        lines.append(f"| 文档片段数 | {meta.get('total_doc_fragments', 0)} | ✅ |")
        lines.append(f"| 调用日志数 | {meta.get('total_call_logs', 0)} | ✅ |")
        lines.append(f"| SDK 缺口 | {meta.get('sdk_gaps_count', 0)} | {'❌' if meta.get('sdk_gaps_count') else '✅'} |")
        lines.append(f"| 文档缺口 | {meta.get('doc_gaps_count', 0)} | {'⚠️' if meta.get('doc_gaps_count') else '✅'} |")
        lines.append(f"| 调用缺口 | {meta.get('scope_gaps_count', 0)} | {'ℹ️' if meta.get('scope_gaps_count') else '✅'} |")
        lines.append(f"| 过期 Scope 使用 | {meta.get('deprecated_scope_count', 0)} | {'⚠️' if meta.get('deprecated_scope_count') else '✅'} |")
        lines.append("")

        if result.deprecated_scope_usages:
            lines.append("## ⚠️ 过期 Scope 使用检测")
            lines.append("")
            lines.append("以下位置使用了已标记为过期的 scope，建议尽快更新：")
            lines.append("")
            lines.append("| Scope | 来源 | 类型 | 位置 | 建议 |")
            lines.append("|-------|------|------|------|------|")
            for usage in result.deprecated_scope_usages:
                loc = f"`{usage.location}`" if usage.location else "-"
                lines.append(f"| `{usage.scope_name}` | {usage.source} | {usage.source_type} | {loc} | {usage.recommendation or '-'} |")
            lines.append("")

        if result.parse_issues:
            lines.append("## 解析问题")
            lines.append("")
            for issue in result.parse_issues:
                severity_icon = {
                    Severity.INFO: "ℹ️",
                    Severity.WARNING: "⚠️",
                    Severity.ERROR: "❌",
                    Severity.CRITICAL: "🔥",
                }.get(issue.severity, "•")
                lines.append(f"- {severity_icon} **[{issue.severity.upper()}]** {issue.message}")
                lines.append(f"  - 位置: `{issue.location}`")
                lines.append(f"  - 解析器: {issue.parser}")
                lines.append("")

        all_gaps = (
            result.sdk_coverage_gaps
            + result.doc_coverage_gaps
            + result.scope_coverage_gaps
        )

        if all_gaps:
            lines.append("## 覆盖缺口详情")
            lines.append("")

            for gap in all_gaps:
                severity_icon = {
                    Severity.INFO: "ℹ️",
                    Severity.WARNING: "⚠️",
                    Severity.ERROR: "❌",
                    Severity.CRITICAL: "🔥",
                }.get(gap.severity, "•")

                lines.append(f"### {severity_icon} {gap.api_key}")
                lines.append("")
                lines.append(f"- **类型**: {gap.gap_type}")
                lines.append(f"- **严重程度**: {gap.severity}")
                lines.append(f"- **来源**: {gap.source}")
                if gap.source_location:
                    lines.append(f"- **文件定位**: `{gap.source_location}`")
                lines.append("")
                if gap.expected_scopes:
                    lines.append(f"- **期望 Scope**: `{', '.join(gap.expected_scopes)}`")
                if gap.actual_scopes:
                    lines.append(f"- **实际 Scope**: `{', '.join(gap.actual_scopes)}`")
                if gap.missing_scopes:
                    lines.append(f"- **❌ 缺少 Scope**: `{', '.join(gap.missing_scopes)}`")
                if gap.extra_scopes:
                    lines.append(f"- **⚠️ 多余 Scope**: `{', '.join(gap.extra_scopes)}`")
                if gap.explanation:
                    lines.append("")
                    lines.append(f"> {gap.explanation}")
                lines.append("")

        lines.append("## 退出码说明")
        lines.append("")
        lines.append("| 退出码 | 含义 |")
        lines.append("|--------|------|")
        for code in ExitCode:
            lines.append(f"| {code.value} | {code.name.replace('_', ' ').title()} |")
        lines.append("")

        lines.append("## Scope 映射表")
        lines.append("")
        lines.append("| 标准名称 | 别名 | 包含权限 |")
        lines.append("|----------|------|----------|")
        for name, scope in result.resolved_scopes.items():
            aliases = ", ".join(scope.aliases) if scope.aliases else "-"
            includes = ", ".join(scope.includes) if scope.includes else "-"
            lines.append(f"| `{name}` | `{aliases}` | `{includes}` |")
        lines.append("")

        return "\n".join(lines)


def determine_exit_code(result: AnalysisResult) -> ExitCode:
    if result.has_errors():
        return ExitCode.PARSE_ERROR
    if result.has_gaps():
        return ExitCode.COVERAGE_GAP
    return ExitCode.SUCCESS
