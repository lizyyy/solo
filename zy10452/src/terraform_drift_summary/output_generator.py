import json
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich.text import Text
from rich import box
from jinja2 import Environment, PackageLoader, select_autoescape
from .models import DriftSummary, ChangeAction, ChangeSeverity
from .config import CliConfig


class OutputGenerator:
    def __init__(self, config: CliConfig, console: Console):
        self.config = config
        self.console = console

    def print_terminal_summary(self, summary: DriftSummary) -> None:
        self._print_header(summary)
        self._print_statistics(summary)
        
        if summary.changes_requiring_attention > 0:
            self._print_attention_required(summary)
        
        self._print_changes_by_severity(summary)
        self._print_team_summary(summary)
        
        if summary.errors:
            self._print_errors(summary)
        
        if self.config.verbosity >= 2:
            self._print_detailed_changes(summary)

    def _print_header(self, summary: DriftSummary) -> None:
        header = Panel.fit(
            f"[bold blue]Terraform 漂移摘要[/bold blue]\n"
            f"摘要ID: {summary.summary_id[:8]}...\n"
            f"输入文件: {summary.input_file}\n"
            f"生成时间: {summary.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            style="blue"
        )
        self.console.print(header)

    def _print_statistics(self, summary: DriftSummary) -> None:
        table = Table(title="变更统计", box=box.ROUNDED, show_header=True)
        table.add_column("类别", style="cyan")
        table.add_column("数量", style="magenta", justify="right")
        
        table.add_row("总资源数", str(summary.total_resources))
        table.add_row("总变更数", str(summary.total_changes))
        table.add_row("需人工关注", f"[bold red]{summary.changes_requiring_attention}[/bold red]")
        table.add_row("已遮蔽敏感字段", str(summary.masked_fields_count))
        table.add_row("解析错误", f"[yellow]{len(summary.errors)}[/yellow]" if summary.errors else "0")
        
        self.console.print(table)

    def _print_attention_required(self, summary: DriftSummary) -> None:
        attention_changes = [c for c in summary.changes if c.requires_attention]
        if not attention_changes:
            return

        table = Table(
            title="[bold red]需要立即关注的变更[/bold red]",
            box=box.ROUNDED,
            show_header=True,
            title_style="bold red"
        )
        table.add_column("资源地址", style="cyan", overflow="fold")
        table.add_column("动作", style="magenta")
        table.add_column("严重度", style="red")
        table.add_column("团队", style="blue")
        table.add_column("源文件行", style="dim")

        for change in attention_changes[:10]:
            action_color = self._get_action_color(change.action)
            table.add_row(
                change.resource_address,
                f"[{action_color}]{change.action.value}[/{action_color}]",
                f"[bold red]{change.severity.value}[/bold red]",
                change.responsible_team or "未分配",
                f"{Path(change.source_file).name}:{change.line_number}" if change.line_number else "-"
            )

        if len(attention_changes) > 10:
            table.add_row(f"... 还有 {len(attention_changes) - 10} 个", "", "", "", "")

        self.console.print(table)

    def _print_changes_by_severity(self, summary: DriftSummary) -> None:
        table = Table(title="按严重度分类", box=box.ROUNDED)
        table.add_column("严重度", style="cyan")
        table.add_column("数量", style="magenta", justify="right")
        table.add_column("占比", style="green")

        total = max(summary.total_changes, 1)
        for severity, count in sorted(summary.changes_by_severity.items(), key=lambda x: x[0].value):
            color = self._get_severity_color(severity)
            percentage = (count / total) * 100
            table.add_row(
                f"[{color}]{severity.value}[/{color}]",
                str(count),
                f"{percentage:.1f}%"
            )

        self.console.print(table)

    def _print_team_summary(self, summary: DriftSummary) -> None:
        if not summary.changes_by_team or len(summary.changes_by_team) <= 1 and 'Unassigned' in summary.changes_by_team:
            return

        table = Table(title="按团队分类", box=box.ROUNDED)
        table.add_column("团队", style="cyan")
        table.add_column("变更数", style="magenta", justify="right")

        for team, count in sorted(summary.changes_by_team.items(), key=lambda x: x[1], reverse=True):
            table.add_row(team, str(count))

        self.console.print(table)

    def _print_errors(self, summary: DriftSummary) -> None:
        table = Table(
            title="[bold yellow]解析错误列表[/bold yellow]",
            box=box.ROUNDED,
            title_style="bold yellow"
        )
        table.add_column("错误类型", style="red")
        table.add_column("消息", style="yellow")
        table.add_column("位置", style="dim")

        for error in summary.errors[:5]:
            location = f"{Path(error.source_file).name}:{error.line_number}" if error.line_number else Path(error.source_file).name
            table.add_row(
                error.error_type,
                Text(error.message[:80] + "..." if len(error.message) > 80 else error.message),
                location
            )

        if len(summary.errors) > 5:
            table.add_row(f"... 还有 {len(summary.errors) - 5} 个错误", "", "")

        self.console.print(table)

    def _print_detailed_changes(self, summary: DriftSummary) -> None:
        tree = Tree("[bold]详细变更列表[/bold]")
        
        for action in ChangeAction:
            if action not in summary.changes_by_action:
                continue
            
            action_color = self._get_action_color(action)
            action_branch = tree.add(f"[{action_color}]{action.value} ({summary.changes_by_action[action]})[/{action_color}]")
            
            action_changes = [c for c in summary.changes if c.action == action]
            for change in action_changes[:5]:
                change_info = f"[cyan]{change.resource_address}[/cyan]"
                if change.changed_fields:
                    change_info += f" [dim]({len(change.changed_fields)} 个字段变更)[/dim]"
                if change.requires_attention:
                    change_info = f"[red]⚠[/red] " + change_info
                action_branch.add(change_info)
            
            if len(action_changes) > 5:
                action_branch.add(f"[dim]... 还有 {len(action_changes) - 5} 个[/dim]")

        self.console.print(tree)

    def _get_action_color(self, action: ChangeAction) -> str:
        color_map = {
            ChangeAction.CREATE: "green",
            ChangeAction.DELETE: "red",
            ChangeAction.UPDATE: "yellow",
            ChangeAction.READ: "blue",
            ChangeAction.NO_OP: "dim",
            ChangeAction.UNKNOWN: "magenta"
        }
        return color_map.get(action, "white")

    def _get_severity_color(self, severity: ChangeSeverity) -> str:
        color_map = {
            ChangeSeverity.CRITICAL: "bold red",
            ChangeSeverity.HIGH: "red",
            ChangeSeverity.MEDIUM: "yellow",
            ChangeSeverity.LOW: "green"
        }
        return color_map.get(severity, "white")

    def export_json(self, summary: DriftSummary) -> Path:
        output_path = self.config.get_output_path("data", "json")
        
        class CustomEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                if hasattr(obj, 'value'):
                    return obj.value
                return super().default(obj)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(summary.model_dump(), f, cls=CustomEncoder, indent=2, ensure_ascii=False)
        
        return output_path

    def export_html(self, summary: DriftSummary) -> Path:
        from os.path import basename as path_basename
        
        env = Environment(
            loader=PackageLoader('terraform_drift_summary', 'templates'),
            autoescape=select_autoescape(['html', 'xml'])
        )
        env.filters['basename'] = path_basename
        
        template = env.get_template('summary.html')
        
        context = self._build_template_context(summary)
        html_content = template.render(**context)
        
        output_path = self.config.get_output_path("report", "html")
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return output_path

    def _build_template_context(self, summary: DriftSummary) -> Dict[str, Any]:
        attention_changes = [c for c in summary.changes if c.requires_attention]
        
        changes_by_action_grouped = {}
        for action in ChangeAction:
            changes_by_action_grouped[action.value] = [
                c for c in summary.changes if c.action == action
            ]

        return {
            "summary": summary,
            "generated_at": summary.generated_at.strftime('%Y-%m-%d %H:%M:%S'),
            "attention_changes": attention_changes,
            "changes_by_action_grouped": changes_by_action_grouped,
            "ChangeSeverity": ChangeSeverity,
            "ChangeAction": ChangeAction,
        }
