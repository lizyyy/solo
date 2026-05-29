import sys
from typing import List
from ..models import SettlementResult, Issue, IssueSeverity


class ConsolePrinter:
    COLORS = {
        "reset": "\033[0m",
        "bold": "\033[1m",
        "red": "\033[91m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "cyan": "\033[96m",
    }

    def __init__(self, use_colors: bool = True):
        self.use_colors = use_colors and sys.stdout.isatty()

    def _color(self, text: str, color: str) -> str:
        if self.use_colors and color in self.COLORS:
            return f"{self.COLORS[color]}{text}{self.COLORS['reset']}"
        return text

    def print_summary(self, summary: str):
        print(summary)

    def print_issues(self, issues: List[Issue]):
        if not issues:
            return

        print("\n" + self._color("=" * 80, "bold"))
        print(self._color(" 问 题 清 单 ", "bold"))
        print(self._color("=" * 80, "bold"))

        criticals = [i for i in issues if i.severity == IssueSeverity.CRITICAL]
        errors = [i for i in issues if i.severity == IssueSeverity.ERROR]
        warnings = [i for i in issues if i.severity == IssueSeverity.WARNING]
        infos = [i for i in issues if i.severity == IssueSeverity.INFO]

        for issue in criticals:
            self._print_issue(issue, "CRITICAL", "red")
        for issue in errors:
            self._print_issue(issue, "ERROR", "red")
        for issue in warnings:
            self._print_issue(issue, "WARNING", "yellow")
        for issue in infos:
            self._print_issue(issue, "INFO", "cyan")

    def _print_issue(self, issue: Issue, label: str, color: str):
        icon = {"CRITICAL": "★", "ERROR": "✖", "WARNING": "⚠", "INFO": "ℹ"}.get(label, "•")
        prefix = self._color(f"[{icon} {label}]", color)

        print(f"\n{prefix} {issue.message}")
        if issue.reason:
            print(f"    {self._color('原因:', 'bold')} {issue.reason}")
        if issue.affected_items:
            print(f"    {self._color('影响范围:', 'bold')} {', '.join(issue.affected_items)}")
        if issue.impact:
            print(f"    {self._color('影响:', 'bold')} {issue.impact}")
        if issue.next_steps:
            print(f"    {self._color('下一步动作:', 'bold')}")
            for step in issue.next_steps:
                print(f"      → {step}")

    def print_result(self, result: SettlementResult, output_paths: dict):
        print("\n" + self._color("=" * 80, "bold"))
        print(self._color(" 输 出 文 件 ", "bold"))
        print(self._color("=" * 80, "bold"))

        for fmt, path in output_paths.items():
            label = {"summary": "摘要文件", "json": "JSON明细", "csv": "CSV明细"}.get(fmt, fmt)
            print(f"  {self._color(label + ':', 'bold')} {path}")

        print("\n" + self._color("✓ 分账计算完成", "green") + "\n")
