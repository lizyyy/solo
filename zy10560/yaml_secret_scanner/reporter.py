import json
from dataclasses import asdict
from pathlib import Path
from typing import List

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import FileResult, Finding, ParseError


class Reporter:
    RISK_COLORS = {
        "low": "cyan",
        "medium": "yellow",
        "high": "bright_yellow",
        "critical": "red",
    }

    RISK_ICONS = {
        "low": "ℹ",
        "medium": "⚠",
        "high": "⚡",
        "critical": "🔴",
    }

    def __init__(self, results: List[FileResult], console: Console):
        self.results = results
        self.console = console

    def print_summary(self, verbose: bool = False):
        total_files = len(self.results)
        files_with_findings = sum(1 for r in self.results if r.findings)
        files_with_errors = sum(1 for r in self.results if r.errors)
        total_findings = sum(len(r.findings) for r in self.results)
        total_errors = sum(len(r.errors) for r in self.results)

        summary = Table(title="扫描概览", show_header=True, header_style="bold magenta")
        summary.add_column("统计项", style="cyan")
        summary.add_column("数值", style="green", justify="right")
        summary.add_row("扫描文件总数", str(total_files))
        summary.add_row("发现问题的文件", str(files_with_findings))
        summary.add_row("发现问题总数", str(total_findings))
        summary.add_row("解析错误数", str(total_errors))

        risk_summary = Table(title="风险等级分布", show_header=True, header_style="bold magenta")
        risk_summary.add_column("风险等级", style="cyan")
        risk_summary.add_column("数量", style="green", justify="right")

        risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for result in self.results:
            for finding in result.findings:
                risk_counts[finding.risk_level] += 1

        for risk in ["critical", "high", "medium", "low"]:
            color = self.RISK_COLORS[risk]
            risk_summary.add_row(
                Text(f"{self.RISK_ICONS[risk]} {risk.upper()}", style=color),
                Text(str(risk_counts[risk]), style=color)
            )

        self.console.print(summary)
        self.console.print()
        self.console.print(risk_summary)
        self.console.print()

        if files_with_findings > 0:
            self._print_findings(verbose)

        if files_with_errors > 0:
            self._print_errors(verbose)

    def _print_findings(self, verbose: bool):
        self.console.print(Panel("[bold red]发现的密钥泄漏问题[/bold red]", border_style="red"))

        for result in self.results:
            if not result.findings:
                continue

            file_table = Table(title=str(result.file_path), show_header=True, header_style="bold blue")
            file_table.add_column("行", style="dim", justify="right")
            file_table.add_column("字段路径", style="cyan")
            file_table.add_column("风险", style="magenta")
            file_table.add_column("描述", style="green")

            if verbose:
                file_table.add_column("原始内容", style="yellow")

            for finding in result.findings:
                color = self.RISK_COLORS[finding.risk_level]
                risk_text = Text(f"{self.RISK_ICONS[finding.risk_level]} {finding.risk_level.upper()}", style=color)
                row = [
                    str(finding.line),
                    finding.field_path,
                    risk_text,
                    finding.description,
                ]
                if verbose:
                    row.append(finding.raw_line or "-")
                file_table.add_row(*row)

            self.console.print(file_table)
            self.console.print()

    def _print_errors(self, verbose: bool):
        self.console.print(Panel("[bold yellow]YAML 解析错误[/bold yellow]", border_style="yellow"))

        for result in self.results:
            if not result.errors:
                continue

            error_table = Table(title=str(result.file_path), show_header=True, header_style="bold bright_yellow")
            error_table.add_column("行", style="dim", justify="right")
            error_table.add_column("列", style="dim", justify="right")
            error_table.add_column("错误信息", style="red")

            if verbose:
                error_table.add_column("原始内容", style="yellow")

            for error in result.errors:
                row = [
                    str(error.line),
                    str(error.column),
                    error.message,
                ]
                if verbose:
                    row.append(error.raw_line or "-")
                error_table.add_row(*row)

            self.console.print(error_table)
            self.console.print()

    def export_json(self, output_path: Path):
        data = []
        for result in self.results:
            result_dict = {
                "file_path": str(result.file_path),
                "findings": [
                    {
                        "field_path": f.field_path,
                        "line": f.line,
                        "column": f.column,
                        "value": f.value,
                        "pattern_name": f.pattern_name,
                        "risk_level": f.risk_level,
                        "description": f.description,
                        "raw_line": f.raw_line,
                    }
                    for f in result.findings
                ],
                "errors": [
                    {
                        "line": e.line,
                        "column": e.column,
                        "message": e.message,
                        "raw_line": e.raw_line,
                    }
                    for e in result.errors
                ],
            }
            data.append(result_dict)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def export_markdown(self, output_path: Path):
        total_files = len(self.results)
        total_findings = sum(len(r.findings) for r in self.results)
        total_errors = sum(len(r.errors) for r in self.results)

        lines = [
            "# YAML 密钥泄漏扫描报告",
            "",
            "## 扫描概览",
            "",
            f"- **扫描文件总数**: {total_files}",
            f"- **发现问题总数**: {total_findings}",
            f"- **解析错误数**: {total_errors}",
            "",
        ]

        if total_findings > 0:
            lines.extend([
                "## 发现的问题",
                "",
            ])

            for result in self.results:
                if not result.findings:
                    continue

                lines.extend([
                    f"### 文件: `{result.file_path}`",
                    "",
                    "| 行 | 字段路径 | 风险等级 | 描述 | 原始内容 |",
                    "|----|----------|----------|------|----------|",
                ])

                for finding in result.findings:
                    raw = finding.raw_line.replace('|', '\\|') if finding.raw_line else "-"
                    lines.append(
                        f"| {finding.line} | `{finding.field_path}` | **{finding.risk_level.upper()}** | {finding.description} | `{raw}` |"
                    )

                lines.append("")

        if total_errors > 0:
            lines.extend([
                "## 解析错误",
                "",
            ])

            for result in self.results:
                if not result.errors:
                    continue

                lines.extend([
                    f"### 文件: `{result.file_path}`",
                    "",
                    "| 行 | 列 | 错误信息 | 原始内容 |",
                    "|----|----|----------|----------|",
                ])

                for error in result.errors:
                    raw = error.raw_line.replace('|', '\\|') if error.raw_line else "-"
                    lines.append(
                        f"| {error.line} | {error.column} | {error.message} | `{raw}` |"
                    )

                lines.append("")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def export_text(self, output_path: Path):
        lines = [
            "YAML 密钥泄漏扫描报告",
            "=" * 50,
            "",
        ]

        for result in self.results:
            if not result.findings and not result.errors:
                continue

            lines.append(f"文件: {result.file_path}")
            lines.append("-" * 50)

            if result.findings:
                lines.append("发现的问题:")
                for f in result.findings:
                    lines.append(f"  [{f.risk_level.upper()}] 行 {f.line}: {f.field_path}")
                    lines.append(f"    描述: {f.description}")
                    if f.raw_line:
                        lines.append(f"    内容: {f.raw_line}")
                    lines.append("")

            if result.errors:
                lines.append("解析错误:")
                for e in result.errors:
                    lines.append(f"  行 {e.line}, 列 {e.column}: {e.message}")
                    if e.raw_line:
                        lines.append(f"    内容: {e.raw_line}")
                    lines.append("")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
