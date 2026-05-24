import json
from pathlib import Path
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.tree import Tree
from .models import DriftReport, RiskLevel, SubmoduleStatus


class Reporter:
    def __init__(self, report: DriftReport, output_dir: Optional[Path] = None):
        self.report = report
        self.output_dir = output_dir or Path.cwd()
        self.console = Console()

    def _get_risk_color(self, risk: RiskLevel) -> str:
        colors = {
            RiskLevel.CRITICAL: "red",
            RiskLevel.HIGH: "bright_red",
            RiskLevel.MEDIUM: "yellow",
            RiskLevel.LOW: "blue",
            RiskLevel.NONE: "green",
        }
        return colors.get(risk, "white")

    def _get_status_symbol(self, status: SubmoduleStatus) -> str:
        symbols = {
            SubmoduleStatus.CLEAN: "✓",
            SubmoduleStatus.DRIFTED: "⚠",
            SubmoduleStatus.DETACHED: "→",
            SubmoduleStatus.MISSING: "✗",
            SubmoduleStatus.DIRTY: "✱",
            SubmoduleStatus.UNINITIALIZED: "○",
        }
        return symbols.get(status, "?")

    def print_console_summary(self, verbose: bool = False) -> None:
        self.console.print(
            Panel.fit(
                f"[bold blue]Git 子模块漂移检测报告[/bold blue]\n"
                f"仓库: [cyan]{self.report.repo_root}[/cyan]\n"
                f"扫描时间: [dim]{self.report.scan_time}[/dim]",
                border_style="blue",
            )
        )

        stats_table = Table(show_header=False, box=None, padding=(0, 2))
        stats_table.add_column("Item", style="bold")
        stats_table.add_column("Count", justify="right")
        stats_table.add_row("子模块总数", str(self.report.total_submodules))
        stats_table.add_row("[red]版本漂移[/red]", str(self.report.drifted_count))
        stats_table.add_row("[yellow]游离头[/yellow]", str(self.report.detached_count))
        stats_table.add_row("[orange]本地修改[/orange]", str(self.report.dirty_count))
        self.console.print(stats_table)

        if self.report.missing_in_lock:
            self.console.print(
                f"\n[yellow]⚠  警告: {len(self.report.missing_in_lock)} 个子模块未在锁定清单中定义[/yellow]"
            )
            for path in self.report.missing_in_lock[:3]:
                self.console.print(f"   - {path}")
            if len(self.report.missing_in_lock) > 3:
                self.console.print(f"   - ... 还有 {len(self.report.missing_in_lock) - 3} 个")

        if self.report.not_in_repo:
            self.console.print(
                f"\n[yellow]⚠  警告: {len(self.report.not_in_repo)} 个锁定条目在仓库中不存在[/yellow]"
            )
            for path in self.report.not_in_repo[:3]:
                self.console.print(f"   - {path}")
            if len(self.report.not_in_repo) > 3:
                self.console.print(f"   - ... 还有 {len(self.report.not_in_repo) - 3} 个")

        if verbose:
            self.print_detailed_table()
        else:
            self.print_problem_summary()

    def print_problem_summary(self) -> None:
        problems = [s for s in self.report.submodules if s.risk_level != RiskLevel.NONE]
        if not problems:
            self.console.print("\n[green]✓ 所有子模块状态正常[/green]")
            return

        self.console.print("\n[bold]问题摘要（按风险排序）:[/bold]\n")

        for submodule in problems:
            color = self._get_risk_color(submodule.risk_level)
            symbol = self._get_status_symbol(submodule.status)

            line = Text.assemble(
                (f"[{symbol}] ", color),
                (f"{submodule.path}: ", "bold"),
                (submodule.drift_reason or submodule.status.value, color),
            )
            self.console.print(line)

    def print_detailed_table(self) -> None:
        self.console.print("\n[bold]详细信息:[/bold]\n")

        table = Table(show_lines=True)
        table.add_column("风险", style="bold", width=8)
        table.add_column("路径", style="cyan")
        table.add_column("状态")
        table.add_column("当前提交")
        table.add_column("锁定提交")
        table.add_column("说明")

        for s in self.report.submodules:
            risk_color = self._get_risk_color(s.risk_level)
            current_short = s.current_commit_info.short_hash if s.current_commit_info else (s.current_commit[:7] if s.current_commit else "-")
            locked_short = s.locked_commit_info.short_hash if s.locked_commit_info else (s.locked_commit[:7] if s.locked_commit else "-")

            table.add_row(
                Text(s.risk_level.value.upper(), style=risk_color),
                s.path,
                self._get_status_symbol(s.status) + " " + s.status.value,
                current_short,
                locked_short,
                s.drift_reason or "",
            )

        self.console.print(table)

    def print_tree_view(self) -> None:
        self.console.print("\n[bold]子模块结构:[/bold]\n")

        root = Tree(f"[cyan]{self.report.repo_root.name}[/cyan]")
        nodes = {"": root}

        sorted_submodules = sorted(self.report.submodules, key=lambda s: s.path)

        for s in sorted_submodules:
            parent_path = s.parent_path or ""
            parent = nodes.get(parent_path, root)

            color = self._get_risk_color(s.risk_level)
            label = Text.assemble(
                (f"{self._get_status_symbol(s.status)} ", color),
                (s.name, "bold"),
                (f" ({s.path})", "dim"),
            )
            nodes[s.path] = parent.add(label)

        self.console.print(root)

    def export_json(self, filename: str = "drift-report.json") -> Path:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.output_dir / filename

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.report.to_dict(), f, indent=2, ensure_ascii=False)

        return output_path

    def export_markdown(self, filename: str = "drift-report.md") -> Path:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.output_dir / filename

        content = self._generate_markdown()
        output_path.write_text(content, encoding="utf-8")

        return output_path

    def _generate_markdown(self) -> str:
        lines = []
        lines.append("# Git 子模块漂移检测报告")
        lines.append("")
        lines.append(f"- **仓库**: `{self.report.repo_root}`")
        lines.append(f"- **扫描时间**: {self.report.scan_time}")
        lines.append("")

        lines.append("## 摘要")
        lines.append("")
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 子模块总数 | {self.report.total_submodules} |")
        lines.append(f"| 版本漂移 | {self.report.drifted_count} |")
        lines.append(f"| 游离头状态 | {self.report.detached_count} |")
        lines.append(f"| 本地修改 | {self.report.dirty_count} |")
        lines.append("")

        if self.report.missing_in_lock:
            lines.append("## ⚠️ 未在锁定清单中的子模块")
            lines.append("")
            for path in self.report.missing_in_lock:
                lines.append(f"- `{path}`")
            lines.append("")

        if self.report.not_in_repo:
            lines.append("## ⚠️ 仓库中不存在的锁定条目")
            lines.append("")
            for path in self.report.not_in_repo:
                lines.append(f"- `{path}`")
            lines.append("")

        lines.append("## 详细报告")
        lines.append("")

        risk_groups = {}
        for s in self.report.submodules:
            risk_groups.setdefault(s.risk_level, []).append(s)

        for risk in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.NONE]:
            submodules = risk_groups.get(risk, [])
            if not submodules:
                continue

            risk_emoji = {
                RiskLevel.CRITICAL: "🔴",
                RiskLevel.HIGH: "🟠",
                RiskLevel.MEDIUM: "🟡",
                RiskLevel.LOW: "🔵",
                RiskLevel.NONE: "🟢",
            }[risk]

            lines.append(f"### {risk_emoji} {risk.value.upper()} ({len(submodules)})")
            lines.append("")

            for s in submodules:
                lines.append(f"#### `{s.path}`")
                lines.append("")
                lines.append(f"- **状态**: `{s.status.value}`")
                if s.branch:
                    lines.append(f"- **分支**: `{s.branch}`")
                if s.current_commit:
                    lines.append(f"- **当前提交**: `{s.current_commit[:7]}`")
                    if s.current_commit_info:
                        lines.append(f"  - 信息: {s.current_commit_info.message}")
                        lines.append(f"  - 作者: {s.current_commit_info.author}")
                        lines.append(f"  - 日期: {s.current_commit_info.date}")
                if s.locked_commit:
                    lines.append(f"- **锁定提交**: `{s.locked_commit[:7]}`")
                    if s.locked_commit_info:
                        lines.append(f"  - 信息: {s.locked_commit_info.message}")
                if s.drift_reason:
                    lines.append(f"- **漂移原因**: {s.drift_reason}")
                if s.commits_ahead > 0:
                    lines.append(f"- **超前提交数**: {s.commits_ahead}")
                if s.commits_behind > 0:
                    lines.append(f"- **落后提交数**: {s.commits_behind}")
                if s.is_nested:
                    lines.append(f"- **嵌套子模块**: 父路径 `{s.parent_path}`")
                lines.append("")

        if self.report.errors:
            lines.append("## ❌ 错误")
            lines.append("")
            for error in self.report.errors:
                lines.append(f"- {error}")
            lines.append("")

        lines.append("## 建议操作")
        lines.append("")

        if self.report.drifted_count > 0:
            lines.append("1. **版本漂移**: 运行 `git submodule update --init --recursive` 同步子模块")
        if self.report.detached_count > 0:
            lines.append("2. **游离头**: 检查子模块是否需要切换到正确的分支")
        if self.report.missing_in_lock:
            lines.append("3. **锁定清单缺失**: 将新子模块添加到锁定清单中")
        if self.report.not_in_repo:
            lines.append("4. **无效锁定条目**: 从锁定清单中移除不存在的子模块")
        if not any([self.report.drifted_count, self.report.detached_count, self.report.missing_in_lock, self.report.not_in_repo]):
            lines.append("- 所有子模块状态正常！")
        lines.append("")

        return "\n".join(lines)

    def export_all(self) -> dict:
        results = {
            "json": self.export_json(),
            "markdown": self.export_markdown(),
        }
        return results
