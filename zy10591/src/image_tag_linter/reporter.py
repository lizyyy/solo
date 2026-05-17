import json
from datetime import datetime
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from .models import ValidationReport, ValidationStatus, ValidationResult


class ConsoleReporter:
    def __init__(self):
        self.console = Console()

    def print_summary(self, report: ValidationReport):
        stats = report.get_statistics()
        
        self.console.print(Panel.fit(
            f"[bold blue]镜像标签命名检查报告[/bold blue]\n"
            f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"输入文件: {report.input_file or '标准输入'}\n"
            f"检查耗时: {report.duration_seconds:.3f}秒",
            title="报告摘要",
            style="blue"
        ))

        table = Table(title="检查统计")
        table.add_column("类别", style="cyan")
        table.add_column("数量", justify="right")
        table.add_column("占比", justify="right")
        
        for status in ['valid', 'warning', 'invalid', 'error']:
            count = stats.get(status, 0)
            percentage = (count / stats['total'] * 100) if stats['total'] > 0 else 0
            style = "green" if status == "valid" else "yellow" if status == "warning" else "red"
            table.add_row(
                f"[{style}]{status.upper()}[/{style}]",
                str(count),
                f"{percentage:.1f}%"
            )
        table.add_row("TOTAL", str(stats['total']), "100.0%", style="bold")
        
        self.console.print(table)

        if stats.get('by_stage'):
            stage_table = Table(title="环境阶段分布")
            stage_table.add_column("阶段", style="cyan")
            stage_table.add_column("数量", justify="right")
            for stage, count in sorted(stats['by_stage'].items()):
                stage_table.add_row(stage.upper(), str(count))
            self.console.print(stage_table)

    def print_details(self, report: ValidationReport, show_all: bool = False):
        self.console.print("\n[bold]详细检查结果[/bold]\n")
        
        for result in report.results:
            if result.status == ValidationStatus.VALID and not show_all:
                continue
                
            image = result.image_info
            line_info = f"[行 {image.line_number}] " if image.line_number else ""
            
            status_style = {
                ValidationStatus.VALID: "green",
                ValidationStatus.WARNING: "yellow",
                ValidationStatus.INVALID: "red",
                ValidationStatus.ERROR: "red",
            }.get(result.status, "white")
            
            self.console.print(
                f"{line_info}[{status_style}]{result.status.value.upper()}[/{status_style}] "
                f"[bold]{image.image_name}:{image.tag}[/bold]"
            )
            
            if image.parsed_version:
                self.console.print(f"  版本: {image.parsed_version}")
            if image.parsed_commit:
                self.console.print(f"  提交: {image.parsed_commit}")
            if image.parsed_stage:
                self.console.print(f"  阶段: {image.parsed_stage}")
            
            for error in result.errors:
                self.console.print(f"  [red]✗ {error.message}[/red]")
                if error.suggestion:
                    self.console.print(f"    [dim]建议: {error.suggestion}[/dim]")
            
            for warning in result.warnings:
                self.console.print(f"  [yellow]⚠ {warning.message}[/yellow]")
            
            self.console.print("")

    def print_bad_lines(self, bad_lines: list):
        if not bad_lines:
            return
            
        self.console.print("[bold red]无法解析的行:[/bold red]")
        for line_num, line, error in bad_lines:
            self.console.print(f"  行 {line_num}: {error}")
            self.console.print(f"    原始内容: {line}")
            self.console.print("")


class JsonReporter:
    @staticmethod
    def generate(report: ValidationReport, output_file: Optional[str] = None) -> str:
        data = {
            "metadata": {
                "generated_at": report.generated_at.isoformat(),
                "input_file": report.input_file,
                "duration_seconds": report.duration_seconds,
                "version": "0.1.0",
            },
            "statistics": report.get_statistics(),
            "rules": [
                {
                    "name": rule.name,
                    "description": rule.description,
                    "pattern": rule.pattern,
                    "required": rule.required,
                }
                for rule in report.rules
            ],
            "results": [
                {
                    "image": {
                        "name": result.image_info.image_name,
                        "tag": result.image_info.tag,
                        "commit_hash": result.image_info.commit_hash,
                        "environment": result.image_info.environment,
                        "line_number": result.image_info.line_number,
                        "parsed": {
                            "version": result.image_info.parsed_version,
                            "commit": result.image_info.parsed_commit,
                            "stage": result.image_info.parsed_stage,
                            "build_time": result.image_info.parsed_build_time,
                        },
                    },
                    "status": result.status.value,
                    "errors": [
                        {
                            "code": e.code,
                            "message": e.message,
                            "field": e.field,
                            "suggestion": e.suggestion,
                        }
                        for e in result.errors
                    ],
                    "warnings": [
                        {
                            "code": w.code,
                            "message": w.message,
                            "field": w.field,
                            "suggestion": w.suggestion,
                        }
                        for w in result.warnings
                    ],
                }
                for result in report.results
            ],
        }
        
        json_str = json.dumps(data, ensure_ascii=False, indent=2)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(json_str)
        
        return json_str


class MarkdownReporter:
    @staticmethod
    def generate(report: ValidationReport, output_file: Optional[str] = None) -> str:
        stats = report.get_statistics()
        
        lines = []
        
        lines.append("# 镜像标签命名检查报告")
        lines.append("")
        lines.append(f"**生成时间**: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**输入文件**: {report.input_file or '标准输入'}")
        lines.append(f"**检查耗时**: {report.duration_seconds:.3f} 秒")
        lines.append("")
        
        lines.append("## 检查统计")
        lines.append("")
        lines.append("| 状态 | 数量 | 占比 |")
        lines.append("|------|------|------|")
        for status in ['valid', 'warning', 'invalid', 'error']:
            count = stats.get(status, 0)
            percentage = (count / stats['total'] * 100) if stats['total'] > 0 else 0
            status_emoji = "✅" if status == "valid" else "⚠️" if status == "warning" else "❌"
            lines.append(f"| {status_emoji} {status.upper()} | {count} | {percentage:.1f}% |")
        lines.append(f"| **总计** | **{stats['total']}** | **100.0%** |")
        lines.append("")
        
        lines.append("## 环境阶段分布")
        lines.append("")
        lines.append("| 阶段 | 数量 |")
        lines.append("|------|------|")
        for stage, count in sorted(stats['by_stage'].items()):
            lines.append(f"| {stage.upper()} | {count} |")
        lines.append("")
        
        lines.append("## 命名规则说明")
        lines.append("")
        for rule in report.rules:
            required = "✅ 必需" if rule.required else "⚠️ 建议"
            lines.append(f"### {rule.name}")
            lines.append(f"- **说明**: {rule.description}")
            lines.append(f"- **要求**: {required}")
            if rule.examples:
                lines.append(f"- **正确示例**: `{'`, `'.join(rule.examples)}`")
            if rule.bad_examples:
                lines.append(f"- **错误示例**: `{'`, `'.join(rule.bad_examples)}`")
            lines.append("")
        
        lines.append("## 详细检查结果")
        lines.append("")
        
        for result in report.results:
            image = result.image_info
            status_emoji = "✅" if result.status == ValidationStatus.VALID else "⚠️" if result.status == ValidationStatus.WARNING else "❌"
            
            lines.append(f"### {status_emoji} {image.image_name}:{image.tag}")
            if image.line_number:
                lines.append(f"- **行号**: {image.line_number}")
            lines.append(f"- **状态**: {result.status.value.upper()}")
            if image.parsed_version:
                lines.append(f"- **解析版本**: {image.parsed_version}")
            if image.parsed_commit:
                lines.append(f"- **解析提交**: {image.parsed_commit}")
            if image.parsed_stage:
                lines.append(f"- **解析阶段**: {image.parsed_stage}")
            
            if result.errors:
                lines.append("- **错误**:")
                for error in result.errors:
                    lines.append(f"  - ❌ {error.message}")
                    if error.suggestion:
                        lines.append(f"    - 建议: {error.suggestion}")
            
            if result.warnings:
                lines.append("- **警告**:")
                for warning in result.warnings:
                    lines.append(f"  - ⚠️ {warning.message}")
            
            lines.append("")
        
        md_content = "\n".join(lines)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(md_content)
        
        return md_content
