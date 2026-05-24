import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.tree import Tree

from .models import Manifest, ValidationReport, ValidationIssue, ExitCode


class ReportGenerator:
    def __init__(self, output_dir: str = "./reports", verbose: bool = False):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.verbose = verbose
        self.console = Console()

    def generate_all(self, report: ValidationReport, manifest: Manifest) -> dict:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"validation_report_{timestamp}"

        paths = {
            "json": self.output_dir / f"{base_name}.json",
            "md": self.output_dir / f"{base_name}.md",
            "summary": self.output_dir / f"{base_name}_summary.txt"
        }

        self._write_json(report, paths["json"])
        self._write_markdown(report, manifest, paths["md"])
        self._write_summary(report, paths["summary"])

        return {k: str(v) for k, v in paths.items()}

    def print_console_summary(self, report: ValidationReport, manifest: Manifest):
        console = Console()

        console.print()
        title = Text("对象存储校验报告", style="bold blue")
        console.print(Panel(title, expand=False))

        console.print()
        self._print_basic_info(report, manifest)

        console.print()
        self._print_summary_table(report, manifest)

        console.print()
        if report.has_errors:
            self._print_error_summary(report)

        console.print()
        if report.has_warnings:
            self._print_warning_summary(report)

        console.print()
        self._print_exit_code_info(report)

        console.print()
        console.print(f"[dim]报告生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}[/dim]")
        console.print(f"[dim]总耗时: {report.duration_seconds:.2f} 秒[/dim]")

    def _print_basic_info(self, report: ValidationReport, manifest: Manifest):
        table = Table(show_header=False, box=None)
        table.add_column("属性", style="cyan")
        table.add_column("值")

        table.add_row("Manifest ID", manifest.manifest_id)
        table.add_row("Manifest 版本", manifest.version)
        table.add_row("数据源", manifest.source)
        table.add_row("存储区域", ", ".join(manifest.get_regions()))
        table.add_row("报告 ID", report.report_id)

        self.console.print(table)

    def _print_summary_table(self, report: ValidationReport, manifest: Manifest):
        table = Table(title="校验摘要", show_header=True, header_style="bold magenta")
        table.add_column("项目", style="cyan")
        table.add_column("数量", justify="right")
        table.add_column("状态", justify="center")

        ok_files = sum(1 for f in manifest.get_all_files() if f.status.value == "ok")
        ok_chunks = sum(
            1 for r in manifest.regions.values()
            for f in r.files.values()
            for c in f.chunks if c.status.value == "ok"
        )

        status_ok = not report.has_errors
        status_style = "green" if status_ok else "red"
        status_text = "✓ 通过" if status_ok else "✗ 失败"

        table.add_row("检查文件数", str(report.files_checked), "")
        table.add_row("检查分片数", str(report.chunks_checked), "")
        table.add_row("正常文件", str(ok_files), "")
        table.add_row("正常分片", str(ok_chunks), "")
        table.add_row("错误数量", str(report.error_count), "⚠️" if report.error_count > 0 else "")
        table.add_row("警告数量", str(report.warning_count), "⚡" if report.warning_count > 0 else "")
        table.add_row("整体状态", "", f"[{status_style}]{status_text}[/{status_style}]")

        self.console.print(table)

    def _print_error_summary(self, report: ValidationReport):
        errors = [i for i in report.issues if i.severity == "error"]

        console = Console()
        console.print("[bold red]错误详情:[/bold red]")

        table = Table(show_header=True, header_style="bold red")
        table.add_column("#", style="dim", width=4)
        table.add_column("错误代码", style="yellow")
        table.add_column("文件/分片")
        table.add_column("区域")
        table.add_column("描述", overflow="fold")

        for idx, issue in enumerate(errors[:10], 1):
            table.add_row(
                str(idx),
                issue.code,
                issue.file_id or issue.chunk_id or "-",
                issue.region or "-",
                issue.message
            )

        if len(errors) > 10:
            table.add_row("...", "", "", "", f"还有 {len(errors) - 10} 个错误未显示")

        self.console.print(table)

    def _print_warning_summary(self, report: ValidationReport):
        warnings = [i for i in report.issues if i.severity == "warning"]

        console = Console()
        console.print("[bold yellow]警告详情:[/bold yellow]")

        table = Table(show_header=True, header_style="bold yellow")
        table.add_column("#", style="dim", width=4)
        table.add_column("警告代码", style="orange")
        table.add_column("文件/分片")
        table.add_column("区域")
        table.add_column("描述", overflow="fold")

        for idx, issue in enumerate(warnings[:5], 1):
            table.add_row(
                str(idx),
                issue.code,
                issue.file_id or issue.chunk_id or "-",
                issue.region or "-",
                issue.message
            )

        if len(warnings) > 5:
            table.add_row("...", "", "", "", f"还有 {len(warnings) - 5} 个警告未显示")

        self.console.print(table)

    def _print_exit_code_info(self, report: ValidationReport):
        exit_code = ExitCode.SUCCESS if not report.has_errors else ExitCode.VALIDATION_ERROR
        console = Console()
        console.print(f"退出码: [bold]{exit_code.value}[/bold] ({exit_code.name})")

    def _write_json(self, report: ValidationReport, path: Path):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(json.loads(report.model_dump_json()), f, indent=2, ensure_ascii=False)

    def _write_markdown(self, report: ValidationReport, manifest: Manifest, path: Path):
        content = []

        content.append("# 对象存储校验报告\n")
        content.append(f"**生成时间**: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}\n")
        content.append(f"**报告 ID**: {report.report_id}\n")
        content.append(f"**总耗时**: {report.duration_seconds:.2f} 秒\n\n")

        content.append("## 基本信息\n")
        content.append(f"- Manifest ID: `{manifest.manifest_id}`\n")
        content.append(f"- Manifest 版本: `{manifest.version}`\n")
        content.append(f"- 数据源: `{manifest.source}`\n")
        content.append(f"- 存储区域: {', '.join(manifest.get_regions())}\n\n")

        content.append("## 校验摘要\n")
        content.append("| 项目 | 数量 |\n")
        content.append("|------|------|\n")
        content.append(f"| 检查文件数 | {report.files_checked} |\n")
        content.append(f"| 检查分片数 | {report.chunks_checked} |\n")
        content.append(f"| 错误数量 | {report.error_count} |\n")
        content.append(f"| 警告数量 | {report.warning_count} |\n\n")

        if report.has_errors:
            content.append("## ❌ 错误详情\n")
            errors = [i for i in report.issues if i.severity == "error"]
            content.append(f"共发现 **{len(errors)}** 个错误:\n\n")
            content.append("| # | 错误代码 | 文件/分片 | 区域 | 描述 |\n")
            content.append("|---|----------|-----------|------|------|\n")
            for idx, issue in enumerate(errors, 1):
                content.append(
                    f"| {idx} | `{issue.code}` | {issue.file_id or issue.chunk_id or '-'} | "
                    f"{issue.region or '-'} | {issue.message} |\n"
                )
            content.append("\n")

        if report.has_warnings:
            content.append("## ⚠️ 警告详情\n")
            warnings = [i for i in report.issues if i.severity == "warning"]
            content.append(f"共发现 **{len(warnings)}** 个警告:\n\n")
            content.append("| # | 警告代码 | 文件/分片 | 区域 | 描述 |\n")
            content.append("|---|----------|-----------|------|------|\n")
            for idx, issue in enumerate(warnings, 1):
                content.append(
                    f"| {idx} | `{issue.code}` | {issue.file_id or issue.chunk_id or '-'} | "
                    f"{issue.region or '-'} | {issue.message} |\n"
                )
            content.append("\n")

        if report.region_comparison:
            content.append("## 区域对比\n")
            comp = report.region_comparison
            if "summary" in comp:
                summary = comp["summary"]
                content.append(f"- 文件数差异: {summary.get('files_with_differences', 0)}\n")
                content.append(f"- 分片数差异: {summary.get('chunks_with_differences', 0)}\n\n")

        content.append("## 建议行动\n")
        if report.has_errors:
            content.append("1. **立即修复以下问题**:")
            content.append("   - 重新上传缺失的分片")
            content.append("   - 校验并修复 checksum 不匹配的文件")
            content.append("   - 同步各区域间不一致的副本\n")
        else:
            content.append("✅ 所有校验通过！\n")

        with open(path, 'w', encoding='utf-8') as f:
            f.write("".join(content))

    def _write_summary(self, report: ValidationReport, path: Path):
        lines = []
        lines.append("=" * 60)
        lines.append("对象存储校验报告 - 摘要")
        lines.append("=" * 60)
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"报告 ID: {report.report_id}")
        lines.append(f"总耗时: {report.duration_seconds:.2f} 秒")
        lines.append("")
        lines.append(f"检查文件数: {report.files_checked}")
        lines.append(f"检查分片数: {report.chunks_checked}")
        lines.append(f"错误数量: {report.error_count}")
        lines.append(f"警告数量: {report.warning_count}")
        lines.append("")

        status = "PASS" if not report.has_errors else "FAIL"
        lines.append(f"整体状态: {status}")
        lines.append("=" * 60)

        with open(path, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))
