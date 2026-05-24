import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.tree import Tree

from .models import (
    SnapshotReport,
    SnapshotDiff,
    BuildStatus,
)


class ReportExporter:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.console = Console()

    def print_terminal_summary(self, report: SnapshotReport) -> None:
        console = self.console
        build = report.build

        console.print()
        title = f"Jenkins 构建参数快照 #{build.build_number}"
        console.print(Panel(title, style="bold blue"))
        console.print()

        info_table = Table(title="基本信息", show_header=False, box=None)
        info_table.add_column("字段", style="cyan")
        info_table.add_column("值", style="white")
        
        status_color = {
            BuildStatus.SUCCESS: "green",
            BuildStatus.FAILURE: "red",
            BuildStatus.ABORTED: "yellow",
            BuildStatus.UNSTABLE: "orange",
        }.get(build.status, "white")
        
        info_table.add_row("Job 名称", build.job_name)
        info_table.add_row("构建号", str(build.build_number))
        info_table.add_row("状态", Text(build.status, style=status_color))
        info_table.add_row("触发时间", build.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
        if build.duration_ms:
            info_table.add_row("耗时", f"{build.duration_ms / 1000:.1f} 秒")
        info_table.add_row("触发人", build.triggered_by or "未知")
        if build.git_info:
            info_table.add_row("Git 提交", build.git_info.commit[:8] if build.git_info.commit else "未知")
        info_table.add_row("快照ID", report.metadata.snapshot_id)
        
        console.print(info_table)
        console.print()

        if build.parameters:
            param_table = Table(title=f"参数列表 ({len(build.parameters)} 个)")
            param_table.add_column("名称", style="cyan")
            param_table.add_column("类型", style="magenta")
            param_table.add_column("值", style="white")
            
            for param in build.parameters:
                value_str = str(param.value)
                if len(value_str) > 50:
                    value_str = value_str[:47] + "..."
                param_table.add_row(param.name, param.type, value_str)
            
            console.print(param_table)
            console.print()

        if build.artifacts:
            art_table = Table(title=f"产物清单 ({len(build.artifacts)} 个)")
            art_table.add_column("名称", style="cyan")
            art_table.add_column("路径", style="blue")
            art_table.add_column("大小", style="green")
            art_table.add_column("状态", style="yellow")
            
            for artifact in build.artifacts:
                size_str = f"{artifact.size:,} B" if artifact.size else "N/A"
                status = "✓ 存在" if artifact.exists else "✗ 缺失"
                status_style = "green" if artifact.exists else "red"
                art_table.add_row(
                    artifact.name,
                    artifact.path,
                    size_str,
                    Text(status, style=status_style)
                )
            
            console.print(art_table)
            console.print()

        if report.validation.errors or report.validation.warnings:
            valid_table = Table(title="校验结果")
            valid_table.add_column("级别", style="red")
            valid_table.add_column("字段", style="cyan")
            valid_table.add_column("消息", style="white")
            
            for err in report.validation.errors:
                valid_table.add_row("错误", err.field, err.message)
            for warn in report.validation.warnings:
                valid_table.add_row("警告", warn.field, warn.message)
            
            console.print(valid_table)
            console.print()

        if report.notes:
            console.print(Panel("操作日志", style="bold green"))
            for note in report.notes:
                console.print(f"  • {note}")
            console.print()

        if report.diff:
            self._print_diff_summary(report.diff, console)

        exit_status = "成功" if report.validation.valid else "有警告"
        exit_color = "green" if report.validation.valid else "yellow"
        console.print(f"[bold]退出状态: [/bold] [{exit_color}]{exit_status}[/{exit_color}]")
        console.print()

    def _print_diff_summary(self, diff: SnapshotDiff, console: Console) -> None:
        console.print(Panel("差异比较", style="bold magenta"))
        console.print(f"比较构建: #{diff.build_number_old} → #{diff.build_number_new}")
        console.print()

        if diff.status_changed:
            console.print(f"[yellow]状态变化:[/yellow] {diff.old_status} → {diff.new_status}")
            console.print()

        if diff.parameter_changes:
            diff_table = Table(title="参数变化")
            diff_table.add_column("名称", style="cyan")
            diff_table.add_column("变化类型", style="magenta")
            diff_table.add_column("原值", style="red")
            diff_table.add_column("新值", style="green")
            
            for change in diff.parameter_changes:
                change_type_label = {
                    "added": "新增",
                    "removed": "删除",
                    "type_change": "类型变化",
                    "value_change": "值变化",
                    "modified": "修改",
                }.get(change.change_type, change.change_type)
                
                if change.is_type_change:
                    change_type_label += f" ({change.old_type}→{change.new_type})"
                
                old_val = str(change.old_value) if change.old_value is not None else "-"
                new_val = str(change.new_value) if change.new_value is not None else "-"
                
                diff_table.add_row(change.name, change_type_label, old_val, new_val)
            
            console.print(diff_table)
            console.print()

        artifacts_changed = any([
            diff.artifacts_added,
            diff.artifacts_removed,
            diff.artifacts_modified
        ])
        
        if artifacts_changed:
            art_diff_table = Table(title="产物变化")
            art_diff_table.add_column("变化类型", style="magenta")
            art_diff_table.add_column("产物名称", style="cyan")
            
            for name in diff.artifacts_added:
                art_diff_table.add_row("新增", name)
            for name in diff.artifacts_removed:
                art_diff_table.add_row("删除", name)
            for name in diff.artifacts_modified:
                art_diff_table.add_row("修改", name)
            
            console.print(art_diff_table)
            console.print()

    def export_json(self, report: SnapshotReport, filename: Optional[str] = None) -> str:
        if not filename:
            filename = f"snapshot_{report.build.job_name.replace('/', '_')}_{report.build.build_number}.json"
        
        output_path = self.output_dir / filename
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(
                report.model_dump(),
                f,
                indent=2,
                ensure_ascii=False,
                default=str
            )
        
        return str(output_path)

    def export_markdown(self, report: SnapshotReport, filename: Optional[str] = None) -> str:
        if not filename:
            filename = f"snapshot_{report.build.job_name.replace('/', '_')}_{report.build.build_number}.md"
        
        output_path = self.output_dir / filename
        build = report.build

        lines = []
        lines.append(f"# Jenkins 构建参数快照 #{build.build_number}")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**快照ID**: `{report.metadata.snapshot_id}`")
        lines.append("")

        lines.append("## 基本信息")
        lines.append("")
        lines.append("| 字段 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| Job 名称 | {build.job_name} |")
        lines.append(f"| 构建号 | {build.build_number} |")
        status_emoji = {
            BuildStatus.SUCCESS: "✅",
            BuildStatus.FAILURE: "❌",
            BuildStatus.ABORTED: "⏹️",
            BuildStatus.UNSTABLE: "⚠️",
        }.get(build.status, "❓")
        lines.append(f"| 状态 | {status_emoji} {build.status} |")
        lines.append(f"| 触发时间 | {build.timestamp.strftime('%Y-%m-%d %H:%M:%S')} |")
        if build.duration_ms:
            lines.append(f"| 耗时 | {build.duration_ms / 1000:.1f} 秒 |")
        lines.append(f"| 触发人 | {build.triggered_by or '未知'} |")
        if build.git_info:
            lines.append(f"| Git 提交 | `{build.git_info.commit}` |")
        if build.url:
            lines.append(f"| Jenkins URL | [{build.url}]({build.url}) |")
        lines.append("")

        if build.parameters:
            lines.append("## 参数列表")
            lines.append("")
            lines.append("| 参数名 | 类型 | 值 |")
            lines.append("|--------|------|-----|")
            for param in build.parameters:
                value_str = str(param.value).replace('|', '\\|').replace('\n', '<br>')
                lines.append(f"| `{param.name}` | {param.type} | `{value_str}` |")
            lines.append("")

        if build.artifacts:
            lines.append("## 产物清单")
            lines.append("")
            lines.append("| 产物名 | 路径 | 大小 | 状态 |")
            lines.append("|--------|------|------|------|")
            for artifact in build.artifacts:
                size_str = f"{artifact.size:,} B" if artifact.size else "N/A"
                status = "✅ 存在" if artifact.exists else "❌ 缺失"
                lines.append(f"| {artifact.name} | `{artifact.path}` | {size_str} | {status} |")
            lines.append("")

        if report.validation.errors or report.validation.warnings:
            lines.append("## 校验结果")
            lines.append("")
            if report.validation.errors:
                lines.append("### ❌ 错误")
                lines.append("")
                for err in report.validation.errors:
                    lines.append(f"- **{err.field}**: {err.message}")
                lines.append("")
            if report.validation.warnings:
                lines.append("### ⚠️ 警告")
                lines.append("")
                for warn in report.validation.warnings:
                    lines.append(f"- **{warn.field}**: {warn.message}")
                lines.append("")

        if report.diff:
            lines.append("## 差异比较")
            lines.append("")
            lines.append(f"比较构建: `#{report.diff.build_number_old}` → `#{report.diff.build_number_new}`")
            lines.append("")

            if report.diff.status_changed:
                lines.append(f"### 状态变化")
                lines.append("")
                lines.append(f"- **旧状态**: {report.diff.old_status}")
                lines.append(f"- **新状态**: {report.diff.new_status}")
                lines.append("")

            if report.diff.parameter_changes:
                lines.append("### 参数变化")
                lines.append("")
                lines.append("| 参数名 | 变化类型 | 原值 | 新值 |")
                lines.append("|--------|----------|------|------|")
                for change in report.diff.parameter_changes:
                    change_type_label = {
                        "added": "新增",
                        "removed": "删除",
                        "type_change": "类型变化",
                        "value_change": "值变化",
                        "modified": "修改",
                    }.get(change.change_type, change.change_type)
                    
                    old_val = str(change.old_value) if change.old_value is not None else "-"
                    new_val = str(change.new_value) if change.new_value is not None else "-"
                    
                    lines.append(f"| `{change.name}` | {change_type_label} | `{old_val}` | `{new_val}` |")
                lines.append("")

        if report.notes:
            lines.append("## 操作日志")
            lines.append("")
            for note in report.notes:
                lines.append(f"- {note}")
            lines.append("")

        lines.append("---")
        lines.append(f"*由 jenkins-snapshot v{report.metadata.tool_version} 生成*")

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return str(output_path)

    def export_all(self, report: SnapshotReport, base_filename: Optional[str] = None) -> dict:
        if not base_filename:
            base_filename = f"snapshot_{report.build.job_name.replace('/', '_')}_{report.build.build_number}"
        
        results = {
            "json": self.export_json(report, f"{base_filename}.json"),
            "markdown": self.export_markdown(report, f"{base_filename}.md"),
        }
        
        return results
