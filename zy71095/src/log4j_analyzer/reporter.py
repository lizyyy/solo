import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict

from rich.console import Console
from rich.table import Table
from rich.tree import Tree

from .constants import EXIT_CODE_DESCRIPTIONS
from .models import AnalysisResult


class Reporter:
    def __init__(self, result: AnalysisResult):
        self.result = result
        self.console = Console()

    def print_terminal_summary(self) -> None:
        self.console.print("\n[bold blue]=== Log4j 配置链分析报告 ===[/bold blue]\n")
        self._print_exit_code_info()
        self._print_config_sources()
        self._print_root_logger()
        self._print_package_resolutions()
        self._print_errors_and_warnings()

    def _print_exit_code_info(self) -> None:
        exit_code = self.result.exit_code
        description = EXIT_CODE_DESCRIPTIONS.get(exit_code, "未知状态")
        color = "green" if exit_code == 0 else "red"
        self.console.print(f"退出码: [{color}]{exit_code}[/{color}] - {description}\n")

    def _print_config_sources(self) -> None:
        table = Table(title="配置源文件")
        table.add_column("类型", style="cyan")
        table.add_column("路径", style="magenta")
        
        for f in self.result.config_files:
            table.add_row("Log4j 配置", str(f))
        for f in self.result.env_files:
            table.add_row("环境文件", str(f))
        
        if self.result.config_files or self.result.env_files:
            self.console.print(table)

    def _print_root_logger(self) -> None:
        if self.result.root_logger:
            rl = self.result.root_logger
            self.console.print(f"\n[bold]Root Logger:[/bold] [green]{rl.level}[/green]")
            self.console.print(f"  来源: {rl.source.path} (优先级: {rl.source.priority})")

    def _print_package_resolutions(self) -> None:
        if not self.result.resolutions:
            return

        self.console.print("\n[bold]包日志级别解析:[/bold]")
        
        for pkg, resolution in self.result.resolutions.items():
            tree = Tree(f"[blue]{pkg}[/blue] → [bold green]{resolution.final_level}[/bold green]")
            
            for link in reversed(resolution.chain):
                rule = link.rule
                source_type = {
                    "file": "📄",
                    "included_file": "📎",
                    "env_file": "🔧",
                    "env_var": "🌍",
                    "cli_override": "⌨️",
                }.get(rule.source.source_type, "❓")
                
                prev = link.previous_level or "N/A"
                branch = tree.add(
                    f"{source_type} [yellow]{rule.package_pattern}[/yellow] "
                    f"→ {rule.level} (was: {prev})"
                )
                branch.add(f"[dim]{link.reason}[/dim]")
            
            self.console.print(tree)

    def _print_errors_and_warnings(self) -> None:
        if self.result.errors:
            self.console.print("\n[bold red]❌ 错误:[/bold red]")
            for err in self.result.errors:
                self.console.print(f"  [red]• {err}[/red]")
        
        if self.result.warnings:
            self.console.print("\n[bold yellow]⚠️ 警告:[/bold yellow]")
            for warn in self.result.warnings:
                self.console.print(f"  [yellow]• {warn}[/yellow]")

    def generate_json(self, output_path: Path) -> None:
        data = self._result_to_dict()
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def generate_markdown(self, output_path: Path) -> None:
        lines = []
        lines.append("# Log4j 配置链分析报告\n")
        
        exit_desc = EXIT_CODE_DESCRIPTIONS.get(self.result.exit_code, "未知状态")
        lines.append(f"**退出码**: `{self.result.exit_code}` - {exit_desc}\n")
        
        lines.append("## 配置源\n")
        if self.result.config_files or self.result.env_files:
            lines.append("| 类型 | 路径 |")
            lines.append("|------|------|")
            for f in self.result.config_files:
                lines.append(f"| Log4j 配置 | `{f}` |")
            for f in self.result.env_files:
                lines.append(f"| 环境文件 | `{f}` |")
            lines.append("")
        
        if self.result.root_logger:
            rl = self.result.root_logger
            lines.append("## Root Logger\n")
            lines.append(f"- **最终级别**: `{rl.level}`")
            lines.append(f"- **来源**: `{rl.source.path}`")
            lines.append(f"- **优先级**: {rl.source.priority}")
            lines.append("")
        
        if self.result.resolutions:
            lines.append("## 包级别解析\n")
            for pkg, resolution in self.result.resolutions.items():
                lines.append(f"### `{pkg}` → `{resolution.final_level}`\n")
                lines.append("| 规则 | 级别 | 来源 | 原因 |")
                lines.append("|------|------|------|------|")
                for link in resolution.chain:
                    rule = link.rule
                    lines.append(
                        f"| `{rule.package_pattern}` | `{rule.level}` | "
                        f"`{rule.source.path}` | {link.reason} |"
                    )
                lines.append("")
        
        if self.result.errors:
            lines.append("## ❌ 错误\n")
            for err in self.result.errors:
                lines.append(f"- {err}")
            lines.append("")
        
        if self.result.warnings:
            lines.append("## ⚠️ 警告\n")
            for warn in self.result.warnings:
                lines.append(f"- {warn}")
            lines.append("")
        
        lines.append("## 退出码说明\n")
        lines.append("| 退出码 | 说明 |")
        lines.append("|--------|------|")
        for code, desc in EXIT_CODE_DESCRIPTIONS.items():
            lines.append(f"| `{code}` | {desc} |")
        lines.append("")

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    def _result_to_dict(self) -> Dict[str, Any]:
        return {
            "exit_code": self.result.exit_code,
            "exit_code_description": EXIT_CODE_DESCRIPTIONS.get(self.result.exit_code, "未知"),
            "config_files": [str(f) for f in self.result.config_files],
            "env_files": [str(f) for f in self.result.env_files],
            "environment_vars": self.result.environment_vars,
            "root_logger": asdict(self.result.root_logger) if self.result.root_logger else None,
            "loggers": {k: asdict(v) for k, v in self.result.loggers.items()},
            "resolutions": {
                pkg: {
                    "package_name": r.package_name,
                    "final_level": r.final_level,
                    "matched_patterns": r.matched_patterns,
                    "chain": [
                        {
                            "rule": asdict(link.rule),
                            "previous_level": link.previous_level,
                            "reason": link.reason
                        }
                        for link in r.chain
                    ]
                }
                for pkg, r in self.result.resolutions.items()
            },
            "errors": self.result.errors,
            "warnings": self.result.warnings,
            "exit_code_meanings": {str(k): v for k, v in EXIT_CODE_DESCRIPTIONS.items()}
        }
