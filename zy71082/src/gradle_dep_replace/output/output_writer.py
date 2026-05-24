import json
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

from ..models.report import Report, ReportStatistics
from ..models.conflict import ConflictSeverity


class OutputFormat(str, Enum):
    JSON = "json"
    MARKDOWN = "markdown"
    ALL = "all"


class OutputWriter:
    def __init__(
        self,
        report: Report,
        output_dir: str,
        output_format: OutputFormat = OutputFormat.ALL,
        overwrite: bool = True,
    ):
        self.report = report
        self.output_dir = Path(output_dir)
        self.output_format = output_format
        self.overwrite = overwrite
        self.console = Console()
        self.generated_files: List[str] = []

    def write(self) -> List[str]:
        self.output_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if self.output_format in (OutputFormat.JSON, OutputFormat.ALL):
            json_path = self._write_json(timestamp)
            if json_path:
                self.generated_files.append(json_path)

        if self.output_format in (OutputFormat.MARKDOWN, OutputFormat.ALL):
            md_path = self._write_markdown(timestamp)
            if md_path:
                self.generated_files.append(md_path)

        return self.generated_files

    def _get_safe_path(self, filename: str) -> Optional[Path]:
        file_path = self.output_dir / filename
        if file_path.exists() and not self.overwrite:
            return None
        return file_path

    def _write_json(self, timestamp: str) -> Optional[str]:
        filename = f"dependency_report_{timestamp}.json"
        file_path = self._get_safe_path(filename)
        if not file_path:
            return None

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(self.report.to_dict(), f, ensure_ascii=False, indent=2)

        return str(file_path)

    def _write_markdown(self, timestamp: str) -> Optional[str]:
        filename = f"dependency_report_{timestamp}.md"
        file_path = self._get_safe_path(filename)
        if not file_path:
            return None

        content = self._generate_markdown()

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        return str(file_path)

    def _generate_markdown(self) -> str:
        lines = []

        lines.append("# Gradle 依赖替换报告")
        lines.append("")
        lines.append(f"**生成时间**: {self.report.metadata.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**工具版本**: {self.report.metadata.tool_version}")
        lines.append("")

        lines.append("## 退出码信息")
        lines.append("")
        lines.append(f"- **退出码**: `{int(self.report.exit_code_info.code)}` ({self.report.exit_code_info.name})")
        lines.append(f"- **说明**: {self.report.exit_code_info.description}")
        lines.append("")

        lines.append("## 统计信息")
        lines.append("")
        stats = self.report.statistics
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总依赖数 | {stats.total_dependencies} |")
        lines.append(f"| 插件数 | {stats.total_plugins} |")
        lines.append(f"| 已变更依赖 | {stats.changed_dependencies} |")
        lines.append(f"| 未变更依赖 | {stats.unchanged_dependencies} |")
        lines.append(f"| 动态版本 | {stats.dynamic_versions} |")
        lines.append(f"| 冲突总数 | {stats.conflicts_found} |")
        lines.append(f"| 严重冲突 | {stats.critical_conflicts} |")
        lines.append(f"| 错误冲突 | {stats.error_conflicts} |")
        lines.append(f"| 警告冲突 | {stats.warning_conflicts} |")
        lines.append(f"| 信息冲突 | {stats.info_conflicts} |")
        lines.append("")

        if self.report.conflicts:
            lines.append("## 冲突详情")
            lines.append("")

            for conflict in self.report.conflicts:
                severity_emoji = {
                    "critical": "🔴",
                    "error": "🟠",
                    "warning": "🟡",
                    "info": "🔵",
                }.get(conflict.severity, "⚪")

                lines.append(f"### {severity_emoji} {conflict.type.replace('_', ' ').title()}")
                lines.append("")
                lines.append(f"**ID**: `{conflict.id}`")
                lines.append("")
                lines.append(f"**严重程度**: `{conflict.severity.upper()}`")
                lines.append("")
                lines.append(f"**描述**: {conflict.message}")
                lines.append("")

                if conflict.dependencies:
                    lines.append("**涉及依赖**:")
                    lines.append("")
                    lines.append("```")
                    for dep in conflict.dependencies:
                        lines.append(f"  - {dep.full_coordinate}")
                        if dep.source_file:
                            lines.append(f"    来源: {Path(dep.source_file).name}")
                    lines.append("```")
                    lines.append("")

                if conflict.suggestion:
                    lines.append(f"**建议**: {conflict.suggestion}")
                    lines.append("")

                if conflict.resolution:
                    lines.append(f"**解决方案**: {conflict.resolution}")
                    lines.append("")

        if self.report.replacement_result and self.report.replacement_result.chains:
            lines.append("## 替换链追踪")
            lines.append("")

            changed_chains = [c for c in self.report.replacement_result.chains if c.has_changes]

            if changed_chains:
                for chain in changed_chains:
                    lines.append(f"### `{chain.original.full_coordinate}`")
                    lines.append("")
                    lines.append("```")
                    lines.append(f"  原始: {chain.original.full_coordinate}")
                    for i, step in enumerate(chain.chain):
                        rule_id = chain.applied_rules[i] if i < len(chain.applied_rules) else "unknown"
                        lines.append(f"  → {step.full_coordinate} [规则: {rule_id}]")
                    lines.append(f"  最终: {chain.final.full_coordinate}")
                    lines.append("```")
                    lines.append("")
            else:
                lines.append("没有发生依赖变更。")
                lines.append("")

        if self.report.notes:
            lines.append("## 备注")
            lines.append("")
            for note in self.report.notes:
                lines.append(f"- {note}")
            lines.append("")

        if self.generated_files:
            lines.append("## 生成文件")
            lines.append("")
            for f in self.generated_files:
                lines.append(f"- `{f}`")
            lines.append("")

        if self.report.metadata.input_files:
            lines.append("## 输入文件")
            lines.append("")
            for f in self.report.metadata.input_files:
                lines.append(f"- `{f}`")
            lines.append("")

        return "\n".join(lines)

    def print_console_summary(self) -> None:
        console = self.console

        console.print()
        console.print(Panel.fit("📊 Gradle 依赖替换分析完成", style="bold blue"))
        console.print()

        self._print_stats_table()
        self._print_conflicts_summary()
        self._print_changes_summary()

        console.print()
        console.print(f"📝 退出码: [bold]{int(self.report.exit_code_info.code)}[/bold] - {self.report.exit_code_info.description}")
        console.print()

        if self.generated_files:
            console.print("📁 生成文件:")
            for f in self.generated_files:
                console.print(f"   • {f}")
            console.print()

    def _print_stats_table(self) -> None:
        stats = self.report.statistics
        table = Table(title="统计摘要", show_header=True, header_style="bold magenta")

        table.add_column("指标", style="cyan")
        table.add_column("数值", justify="right", style="green")

        table.add_row("总依赖数", str(stats.total_dependencies))
        table.add_row("插件数", str(stats.total_plugins))
        table.add_row("已变更", str(stats.changed_dependencies), style="yellow" if stats.changed_dependencies > 0 else "default")
        table.add_row("未变更", str(stats.unchanged_dependencies))
        table.add_row("动态版本", str(stats.dynamic_versions), style="yellow" if stats.dynamic_versions > 0 else "default")
        table.add_row("冲突总数", str(stats.conflicts_found), style="red" if stats.conflicts_found > 0 else "default")

        self.console.print(table)
        self.console.print()

    def _print_conflicts_summary(self) -> None:
        if not self.report.conflicts:
            return

        self.console.print("⚠️  [bold yellow]冲突摘要[/bold yellow]")
        self.console.print()

        for conflict in self.report.conflicts[:5]:
            severity_style = {
                ConflictSeverity.CRITICAL: "bold red",
                ConflictSeverity.ERROR: "red",
                ConflictSeverity.WARNING: "yellow",
                ConflictSeverity.INFO: "blue",
            }.get(conflict.severity, "default")

            self.console.print(f"  [{severity_style}]●[/{severity_style}] {conflict.message}")

        if len(self.report.conflicts) > 5:
            self.console.print(f"  ... 还有 {len(self.report.conflicts) - 5} 个冲突")

        self.console.print()

    def _print_changes_summary(self) -> None:
        if not self.report.replacement_result:
            return

        changed = [c for c in self.report.replacement_result.chains if c.has_changes]

        if not changed:
            self.console.print("✅ 没有依赖需要变更")
            self.console.print()
            return

        self.console.print("🔄 [bold green]变更摘要[/bold green]")
        self.console.print()

        tree = Tree("已变更依赖")
        for chain in changed[:10]:
            branch = tree.add(f"[cyan]{chain.original.full_coordinate}[/cyan]")
            branch.add(f"→ [green]{chain.final.full_coordinate}[/green] ({chain.change_count} 步)")

        if len(changed) > 10:
            tree.add(f"... 还有 {len(changed) - 10} 个变更")

        self.console.print(tree)
        self.console.print()
