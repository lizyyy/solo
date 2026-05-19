import json
import sys
from typing import Optional, TextIO
from datetime import datetime

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .rules import CompatibilityResult, Severity, RuleType


class Reporter:
    def __init__(self):
        self.console = Console()

    def print_console_report(
        self,
        result: CompatibilityResult,
        old_snapshot_name: str,
        new_snapshot_name: str,
    ):
        title = Text.assemble(
            ("Proto 字段兼容性检查报告", "bold blue"),
        )
        self.console.print(Panel(title))

        self.console.print(f"\n对比快照: [cyan]{old_snapshot_name}[/cyan] -> [cyan]{new_snapshot_name}[/cyan]")
        self.console.print(f"检查时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

        self._print_summary(result)

        if result.violations:
            self._print_violations(result)
        else:
            self.console.print("\n[green]✓ 未发现兼容性问题[/green]\n")

    def _print_summary(self, result: CompatibilityResult):
        table = Table(title="检查汇总")
        table.add_column("问题类型", style="cyan")
        table.add_column("严重级别", style="magenta")
        table.add_column("数量", style="yellow", justify="right")

        for key, count in sorted(result.summary.items()):
            severity, rule_type = key.split("_", 1)
            table.add_row(rule_type, severity, str(count))

        self.console.print(table)

        error_count = sum(1 for v in result.violations if v.severity == Severity.ERROR)
        warning_count = sum(1 for v in result.violations if v.severity == Severity.WARNING)

        self.console.print(f"\n总问题数: [bold]{len(result.violations)}[/bold] "
              f"(错误: [red]{error_count}[/red], 警告: [yellow]{warning_count}[/yellow])")

    def _print_violations(self, result: CompatibilityResult):
        self.console.print("\n[bold red]问题详情:[/bold red]")

        for i, violation in enumerate(result.violations, 1):
            severity_style = "red" if violation.severity == Severity.ERROR else "yellow"

            header = Text.assemble(
                (f"\n{i}. [{violation.severity.value}] ", f"bold {severity_style}"),
                (violation.rule_type.value, "bold"),
            )
            self.console.print(header)

            self.console.print(f"   消息: [cyan]{violation.message_name}[/cyan]")
            if violation.field_number is not None:
                self.console.print(f"   字段编号: [yellow]{violation.field_number}[/yellow]")
            if violation.field_name is not None:
                self.console.print(f"   字段名称: [yellow]{violation.field_name}[/yellow]")

            self.console.print(f"   描述: {violation.message}")

            if violation.location:
                loc = violation.location
                file_path = loc.get('file_path', 'unknown')
                line = loc.get('line_start', '?')
                self.console.print(f"   当前位置: [blue]{file_path}:{line}[/blue]")

            if violation.old_location:
                loc = violation.old_location
                file_path = loc.get('file_path', 'unknown')
                line = loc.get('line_start', '?')
                self.console.print(f"   原始位置: [blue]{file_path}:{line}[/blue]")

    def export_json_report(
        self,
        result: CompatibilityResult,
        output_path: str,
        old_snapshot_name: Optional[str] = None,
        new_snapshot_name: Optional[str] = None,
    ):
        report = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "old_snapshot": old_snapshot_name,
            "new_snapshot": new_snapshot_name,
            "result": result.to_dict(),
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False, sort_keys=True)

        self.console.print(f"\n报告已导出到: [green]{output_path}[/green]")

    def export_json_string(
        self,
        result: CompatibilityResult,
        old_snapshot_name: Optional[str] = None,
        new_snapshot_name: Optional[str] = None,
    ) -> str:
        report = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "old_snapshot": old_snapshot_name,
            "new_snapshot": new_snapshot_name,
            "result": result.to_dict(),
        }

        return json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True)
