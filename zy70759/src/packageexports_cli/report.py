import json
from dataclasses import asdict
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .example_generator import MissingAnalyzer
from .models import ValidationResult


class ReportGenerator:
    def __init__(self, console: Optional[Console] = None):
        self.console = console or Console()
        self.missing_analyzer = MissingAnalyzer()
        
    def generate_human_readable(self, result: ValidationResult) -> None:
        self._print_header(result)
        self._print_export_entries(result)
        self._print_import_examples(result)
        self._print_issues(result)
        self._print_summary(result)
        
    def generate_machine_readable(self, result: ValidationResult) -> str:
        data = {
            "package": {
                "name": result.package_name,
                "version": result.package_version,
            },
            "summary": {
                "total_entries": len(result.exports_entries),
                "total_issues": len(result.issues),
                "error_count": result.error_count,
                "warning_count": result.warning_count,
                "has_errors": result.has_errors,
            },
            "exports_entries": [
                asdict(entry) for entry in result.exports_entries
            ],
            "file_checks": result.file_checks,
            "issues": [
                asdict(issue) for issue in result.issues
            ],
            "import_examples": [
                {
                    "import_statement": example.import_statement,
                    "resolved_path": example.resolved_path,
                    "is_valid": example.is_valid,
                    "issues": [asdict(i) for i in example.issues],
                }
                for example in result.import_examples
            ],
            "missing_analysis": self.missing_analyzer.analyze_missing(result),
        }
        return json.dumps(data, indent=2, ensure_ascii=False)
        
    def _print_header(self, result: ValidationResult) -> None:
        title = Text("📦 packageexports 入口体检排查报告", style="bold cyan")
        subtitle = Text(f"包名: {result.package_name} @ {result.package_version}", style="dim")
        
        self.console.print()
        self.console.print(Panel(title, subtitle=subtitle))
        
    def _print_export_entries(self, result: ValidationResult) -> None:
        if not result.exports_entries:
            self.console.print("[yellow]⚠️  未找到 exports 入口配置[/yellow]")
            return
            
        table = Table(title="✅ Exports 入口列表", show_lines=True)
        table.add_column("导出路径", style="cyan")
        table.add_column("目标路径", style="green")
        table.add_column("条件", style="magenta")
        table.add_column("文件存在", style="yellow")
        
        for entry in result.exports_entries:
            conditions = ", ".join(entry.conditions) if entry.conditions else "-"
            exists = result.file_checks.get(entry.target_path, False)
            exists_status = "✅" if exists else "❌"
            
            table.add_row(
                entry.export_path,
                entry.target_path,
                conditions,
                exists_status,
            )
            
        self.console.print(table)
        
    def _print_import_examples(self, result: ValidationResult) -> None:
        if not result.import_examples:
            return
            
        table = Table(title="📝 导入样例生成", show_lines=True)
        table.add_column("导入语句", style="cyan")
        table.add_column("解析路径", style="green")
        table.add_column("有效", style="yellow")
        
        for example in result.import_examples:
            is_valid = "✅" if example.is_valid else "❌"
            table.add_row(
                example.import_statement,
                example.resolved_path or "-",
                is_valid,
            )
            
        self.console.print(table)
        
    def _print_issues(self, result: ValidationResult) -> None:
        if not result.issues:
            self.console.print("[green]🎉 未发现任何问题[/green]")
            return
            
        errors = [i for i in result.issues if i.severity == "error"]
        warnings = [i for i in result.issues if i.severity == "warning"]
        infos = [i for i in result.issues if i.severity == "info"]
        
        if errors:
            self._print_issue_table("❌ 错误列表", errors, "red")
        if warnings:
            self._print_issue_table("⚠️  警告列表", warnings, "yellow")
        if infos:
            self._print_issue_table("ℹ️  信息列表", infos, "blue")
            
    def _print_issue_table(self, title: str, issues: list, color: str) -> None:
        table = Table(title=title, show_lines=True)
        table.add_column("问题类型", style=color)
        table.add_column("导出路径", style="cyan")
        table.add_column("目标路径", style="green")
        table.add_column("消息", style="dim")
        
        for issue in issues:
            table.add_row(
                issue.issue_type,
                issue.export_path or "-",
                issue.target_path or "-",
                issue.message,
            )
            
        self.console.print(table)
        
    def _print_summary(self, result: ValidationResult) -> None:
        self.console.print()
        self.console.print("━" * 60)
        
        summary_color = "red" if result.has_errors else "green"
        
        self.console.print()
        self.console.print(f"[{summary_color}]📊 体检总结[/{summary_color}]")
        self.console.print(f"  入口总数: {len(result.exports_entries)}")
        self.console.print(f"  问题总数: {len(result.issues)}")
        self.console.print(f"  错误数量: {result.error_count} {'❌' if result.error_count > 0 else '✅'}")
        self.console.print(f"  警告数量: {result.warning_count} {'⚠️' if result.warning_count > 0 else ''}")
        
        if result.has_errors:
            self.console.print()
            self.console.print("[red]❌ 存在错误，请检查 exports 配置和文件路径[/red]")
        else:
            self.console.print()
            self.console.print("[green]✅ 所有入口检查通过[/green]")
            
        self.console.print()
        self.console.print("━" * 60)
        self.console.print()
