import json
import os
from pathlib import Path
from typing import Optional
from datetime import datetime

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .result import BatchResult, SanitizationResult
from .constants import ExitCode, EXIT_CODE_DESCRIPTIONS


console = Console()


class ReportGenerator:
    def __init__(self, batch_result: BatchResult, output_dir: str):
        self.batch_result = batch_result
        self.output_dir = Path(output_dir)

    def generate_all(self) -> dict:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        json_path = self._generate_json()
        md_path = self._generate_markdown()
        self._print_console_summary()
        return {
            "json": json_path,
            "markdown": md_path
        }

    def _generate_json(self) -> str:
        file_path = self.output_dir / "sanitization_report.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(self.batch_result.to_dict(), f, indent=2, ensure_ascii=False)
        return str(file_path)

    def _generate_markdown(self) -> str:
        file_path = self.output_dir / "sanitization_report.md"
        content = self._build_markdown()
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return str(file_path)

    def _build_markdown(self) -> str:
        br = self.batch_result
        lines = []
        lines.append("# PDF 元数据脱敏报告")
        lines.append("")
        lines.append(f"**生成时间**: {br.timestamp}")
        lines.append("")
        lines.append("## 执行摘要")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 处理文件总数 | {br.total_files} |")
        lines.append(f"| 成功 | {br.success_count} |")
        lines.append(f"| 失败 | {br.failed_count} |")
        lines.append(f"| 输出目录 | `{br.output_directory}` |")
        lines.append("")

        total_annotations = sum(len(r.original_annotations) for r in br.results)
        total_attachments = sum(len(r.original_attachments) for r in br.results)
        removed_annotations = sum(r.removed_annotations_count for r in br.results)
        removed_attachments = sum(r.removed_attachments_count for r in br.results)

        lines.append("## 清理统计")
        lines.append("")
        lines.append("| 项目 | 原始数量 | 清理数量 | 剩余数量 |")
        lines.append("|--------|----------|----------|----------|")
        lines.append(f"| 批注 | {total_annotations} | {removed_annotations} | {total_annotations - removed_annotations} |")
        lines.append(f"| 附件 | {total_attachments} | {removed_attachments} | {total_attachments - removed_attachments} |")
        lines.append("")

        incremental_count = sum(1 for r in br.results if r.has_incremental_updates)
        if incremental_count > 0:
            lines.append("## ⚠️ 增量更新检测")
            lines.append("")
            lines.append(f"检测到 **{incremental_count}** 个文件包含增量更新残留。")
            lines.append("这些文件可能包含已删除但未彻底清除的历史数据。")
            lines.append("")

        lines.append("## 文件处理详情")
        lines.append("")

        for idx, result in enumerate(br.results, 1):
            status_emoji = "✅" if result.success else "❌"
            lines.append(f"### {status_emoji} {Path(result.input_file).name}")
            lines.append("")
            lines.append(f"- **输入文件**: `{result.input_file}`")
            lines.append(f"- **输出文件**: `{result.output_file}`")
            lines.append(f"- **处理状态**: {'成功' if result.success else '失败'}")
            if result.error_message:
                lines.append(f"- **错误信息**: {result.error_message}")
            lines.append(f"- **退出码**: {result.exit_code.value} ({EXIT_CODE_DESCRIPTIONS.get(result.exit_code, '未知')})")
            if result.file_hash:
                lines.append(f"- **输入文件哈希**: `{result.file_hash}`")
            if result.output_hash:
                lines.append(f"- **输出文件哈希**: `{result.output_hash}`")
            lines.append("")

            if result.original_metadata and not result.original_metadata.is_empty():
                lines.append("#### 原始元数据")
                lines.append("")
                lines.append("| 字段 | 值 |")
                lines.append("|------|-----|")
                for key in ['title', 'author', 'subject', 'keywords', 'creator', 'producer']:
                    value = getattr(result.original_metadata, key)
                    if value:
                        lines.append(f"| {key} | {value} |")
                if result.original_metadata.custom_fields:
                    for k, v in result.original_metadata.custom_fields.items():
                        lines.append(f"| {k} | {v} |")
                lines.append("")

            if result.original_annotations:
                lines.append(f"#### 原始批注 ({len(result.original_annotations)} 个)")
                lines.append("")
                lines.append("| 页码 | 类型 | 作者 | 内容预览 |")
                lines.append("|------|------|------|----------|")
                for annot in result.original_annotations:
                    content = (annot.contents or "")[:50].replace('\n', ' ')
                    author = annot.author or "-"
                    lines.append(f"| {annot.page} | {annot.type} | {author} | {content} |")
                lines.append("")

            if result.original_attachments:
                lines.append(f"#### 原始附件 ({len(result.original_attachments)} 个)")
                lines.append("")
                lines.append("| 文件名 | 大小 | 嵌入 | 隐藏 |")
                lines.append("|--------|------|------|------|")
                for att in result.original_attachments:
                    lines.append(f"| {att.name} | {att.size} bytes | {'是' if att.is_embedded else '否'} | {'是' if att.is_hidden else '否'} |")
                lines.append("")

        lines.append("## 退出码说明")
        lines.append("")
        for code in ExitCode:
            lines.append(f"- **{code.value}**: {EXIT_CODE_DESCRIPTIONS[code]}")
        lines.append("")

        lines.append("---")
        lines.append("*此报告由 pdf-sanitizer 工具自动生成*")
        lines.append("")

        return "\n".join(lines)

    def _print_console_summary(self):
        br = self.batch_result

        console.print()
        console.print(Panel.fit(
            "[bold cyan]PDF 元数据脱敏处理完成[/bold cyan]",
            border_style="cyan"
        ))
        console.print()

        summary_table = Table(title="处理摘要", show_header=True, header_style="bold magenta")
        summary_table.add_column("项目", style="cyan")
        summary_table.add_column("数值", justify="right")
        summary_table.add_row("总文件数", str(br.total_files))
        summary_table.add_row("成功", f"[green]{br.success_count}[/green]")
        summary_table.add_row("失败", f"[red]{br.failed_count}[/red]")
        console.print(summary_table)
        console.print()

        total_annotations = sum(len(r.original_annotations) for r in br.results)
        total_attachments = sum(len(r.original_attachments) for r in br.results)
        removed_annotations = sum(r.removed_annotations_count for r in br.results)
        removed_attachments = sum(r.removed_attachments_count for r in br.results)

        cleanup_table = Table(title="清理统计", show_header=True, header_style="bold magenta")
        cleanup_table.add_column("项目", style="cyan")
        cleanup_table.add_column("原始", justify="right")
        cleanup_table.add_column("已清理", justify="right")
        cleanup_table.add_column("剩余", justify="right")
        cleanup_table.add_row("批注", str(total_annotations), 
                              f"[green]{removed_annotations}[/green]", 
                              str(total_annotations - removed_annotations))
        cleanup_table.add_row("附件", str(total_attachments), 
                              f"[green]{removed_attachments}[/green]", 
                              str(total_attachments - removed_attachments))
        console.print(cleanup_table)
        console.print()

        incremental_count = sum(1 for r in br.results if r.has_incremental_updates)
        if incremental_count > 0:
            console.print(f"[yellow]⚠️  检测到 {incremental_count} 个文件包含增量更新残留[/yellow]")
            console.print()

        files_table = Table(title="文件详情", show_header=True, header_style="bold magenta")
        files_table.add_column("#", justify="right")
        files_table.add_column("文件名", style="cyan")
        files_table.add_column("状态")
        files_table.add_column("批注", justify="right")
        files_table.add_column("附件", justify="right")

        for idx, result in enumerate(br.results, 1):
            status = "[green]✓[/green]" if result.success else "[red]✗[/red]"
            annot_count = f"{len(result.original_annotations)}→{len(result.final_annotations)}"
            att_count = f"{len(result.original_attachments)}→{len(result.final_attachments)}"
            files_table.add_row(str(idx), Path(result.input_file).name, status, annot_count, att_count)

        console.print(files_table)
        console.print()

        console.print(f"[dim]报告文件已保存至: {self.output_dir}[/dim]")
        console.print(f"[dim]  - JSON: sanitization_report.json[/dim]")
        console.print(f"[dim]  - Markdown: sanitization_report.md[/dim]")
        console.print()
