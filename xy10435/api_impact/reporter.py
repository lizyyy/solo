from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich import box

from .models import (
    CallerImpact,
    ChangeAnalysis,
    ChangeType,
    ConfirmationStatus,
    RiskLevel,
)


console = Console()


RISK_COLORS = {
    RiskLevel.CRITICAL: "bold red",
    RiskLevel.HIGH: "bold orange3",
    RiskLevel.MEDIUM: "bold yellow",
    RiskLevel.LOW: "bold green",
}

CONFIRMATION_COLORS = {
    ConfirmationStatus.UNCONFIRMED: "bold red",
    ConfirmationStatus.CONFIRMED: "bold green",
    ConfirmationStatus.NOT_APPLICABLE: "dim",
}

CHANGE_TYPE_LABELS = {
    ChangeType.FIELD_REMOVED: "字段删除",
    ChangeType.TYPE_CHANGED: "类型变更",
    ChangeType.ENUM_CHANGED: "枚举变更",
    ChangeType.REQUIRED_ADDED: "新增必填",
    ChangeType.FIELD_ADDED: "新增可选",
    ChangeType.REQUIRED_REMOVED: "必填转可选",
}


class Reporter:
    def print_summary(self, analysis: ChangeAnalysis) -> None:
        api_diff = analysis.api_diff
        impacts = analysis.caller_impacts

        title = f"[bold blue]接口变更影响分析报告[/bold blue]"
        subtitle = (
            f"{api_diff.api_name}: {api_diff.old_version} → {api_diff.new_version}"
        )

        stats = self._calculate_stats(impacts)

        console.print()
        console.print(Panel(
            f"[bold]{subtitle}[/bold]\n"
            f"分析ID: {analysis.diff_id}\n"
            f"生成时间: {analysis.generated_at.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            f"变更端点: {len(api_diff.endpoint_changes)} 个\n"
            f"受影响调用方: {stats['total']} 个\n"
            f"[bold red]必须修改: {stats['action_required']}[/bold red]\n"
            f"[bold yellow]仅需关注: {stats['watch_only']}[/bold yellow]",
            title=title,
            expand=False,
        ))

    def _calculate_stats(self, impacts: List[CallerImpact]) -> Dict:
        stats = {
            "total": len(impacts),
            "action_required": 0,
            "watch_only": 0,
            "by_risk": {
                RiskLevel.CRITICAL: 0,
                RiskLevel.HIGH: 0,
                RiskLevel.MEDIUM: 0,
                RiskLevel.LOW: 0,
            },
            "by_status": {
                ConfirmationStatus.UNCONFIRMED: 0,
                ConfirmationStatus.CONFIRMED: 0,
                ConfirmationStatus.NOT_APPLICABLE: 0,
            },
        }
        for imp in impacts:
            stats["by_risk"][imp.risk_level] += 1
            stats["by_status"][imp.confirmation_status] += 1
            if imp.requires_action:
                stats["action_required"] += 1
            else:
                stats["watch_only"] += 1
        return stats

    def print_by_service(self, analysis: ChangeAnalysis, filter_service: Optional[str] = None) -> None:
        impacts = analysis.caller_impacts
        if filter_service:
            impacts = [i for i in impacts if i.service_name == filter_service]

        action_required = [i for i in impacts if i.requires_action]
        watch_only = [i for i in impacts if not i.requires_action]

        if action_required:
            console.print()
            console.print(Panel(
                "[bold red]🔴 必须修改的团队[/bold red]",
                expand=False,
            ))
            self._print_impacts_table(action_required)

        if watch_only:
            console.print()
            console.print(Panel(
                "[bold yellow]🟡 仅需关注的团队[/bold yellow]",
                expand=False,
            ))
            self._print_impacts_table(watch_only)

    def _print_impacts_table(self, impacts: List[CallerImpact]) -> None:
        table = Table(box=box.ROUNDED, show_lines=True)
        table.add_column("服务名", style="cyan", no_wrap=True)
        table.add_column("团队", style="magenta")
        table.add_column("负责人", style="blue")
        table.add_column("风险等级", style="bold")
        table.add_column("确认状态", style="bold")
        table.add_column("受影响端点", style="green")

        for imp in impacts:
            risk_color = RISK_COLORS.get(imp.risk_level, "white")
            status_color = CONFIRMATION_COLORS.get(imp.confirmation_status, "white")
            endpoints_str = "\n".join(imp.endpoints_affected)

            table.add_row(
                imp.service_name,
                imp.team_name,
                imp.owner or "[dim]未设置[/dim]",
                f"[{risk_color}]{imp.risk_level.value.upper()}[/{risk_color}]",
                f"[{status_color}]{imp.confirmation_status.value}[/{status_color}]",
                endpoints_str,
            )

        console.print(table)

    def print_details(self, analysis: ChangeAnalysis, service_name: Optional[str] = None) -> None:
        impacts = analysis.caller_impacts
        if service_name:
            impacts = [i for i in impacts if i.service_name == service_name]

        for imp in impacts:
            self._print_service_detail(imp)

    def _print_service_detail(self, impact: CallerImpact) -> None:
        title = (
            f"[cyan]{impact.service_name}[/cyan] "
            f"([magenta]{impact.team_name}[/magenta])"
        )

        tree = Tree(title)

        status_branch = tree.add("[bold]状态信息[/bold]")
        risk_color = RISK_COLORS.get(impact.risk_level, "white")
        status_color = CONFIRMATION_COLORS.get(impact.confirmation_status, "white")
        status_branch.add(
            f"风险等级: [{risk_color}]{impact.risk_level.value.upper()}[/{risk_color}]"
        )
        status_branch.add(
            f"确认状态: [{status_color}]{impact.confirmation_status.value}[/{status_color}]"
        )
        status_branch.add(
            f"需要处理: {'是' if impact.requires_action else '否'}"
        )
        status_branch.add(
            f"负责人: {impact.owner or '[dim]未设置[/dim]'}"
        )

        endpoints_branch = tree.add("[bold]受影响端点[/bold]")
        for ep in impact.endpoints_affected:
            endpoints_branch.add(ep)

        changes_branch = tree.add("[bold]具体变更[/bold]")
        for change in impact.changes:
            label = CHANGE_TYPE_LABELS.get(change.change_type, change.change_type.value)
            change_line = f"[yellow]{label}[/yellow]: {change.path}"
            if change.old_value is not None and change.new_value is not None:
                old_val = str(change.old_value)[:50]
                new_val = str(change.new_value)[:50]
                change_line += f" [dim]{old_val} → {new_val}[/dim]"
            changes_branch.add(change_line)

        if impact.alerts:
            alerts_branch = tree.add("[bold red]关联告警[/bold red]")
            for alert in impact.alerts:
                alerts_branch.add(f"[{alert.level}] {alert.message}")

        if impact.notes:
            notes_branch = tree.add("[bold blue]备注信息[/bold blue]")
            for note in impact.notes:
                notes_branch.add(note.content)

        console.print()
        console.print(tree)

    def print_warnings(
        self,
        missing_owners: List[str],
        duplicate_import: bool = False,
    ) -> None:
        if missing_owners:
            console.print()
            console.print(Panel(
                "[bold yellow]⚠️  以下调用方缺少负责人信息:\n"
                + "\n".join(f"  • {name}" for name in missing_owners),
                title="警告",
                style="yellow",
                expand=False,
            ))

        if duplicate_import:
            console.print()
            console.print(Panel(
                "[bold yellow]ℹ️  该变更已存在，已保留原有确认状态",
                title="提示",
                style="blue",
                expand=False,
            ))

    def export_markdown(
        self,
        analysis: ChangeAnalysis,
        output_path: str,
    ) -> str:
        api_diff = analysis.api_diff
        impacts = analysis.caller_impacts
        stats = self._calculate_stats(impacts)

        lines = []
        lines.append(f"# 接口变更影响分析报告")
        lines.append("")
        lines.append(f"- **API**: {api_diff.api_name}")
        lines.append(f"- **版本变化**: {api_diff.old_version} → {api_diff.new_version}")
        lines.append(f"- **分析ID**: {analysis.diff_id}")
        lines.append(f"- **生成时间**: {analysis.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 概览")
        lines.append("")
        lines.append(f"- 变更端点: {len(api_diff.endpoint_changes)} 个")
        lines.append(f"- 受影响调用方: {stats['total']} 个")
        lines.append(f"- 必须修改: **{stats['action_required']}** 个")
        lines.append(f"- 仅需关注: {stats['watch_only']} 个")
        lines.append("")

        action_required = [i for i in impacts if i.requires_action]
        if action_required:
            lines.append("## 必须修改的团队")
            lines.append("")
            lines.append("| 服务名 | 团队 | 负责人 | 风险等级 | 确认状态 |")
            lines.append("|--------|------|--------|----------|----------|")
            for imp in action_required:
                lines.append(
                    f"| {imp.service_name} | {imp.team_name} | "
                    f"{imp.owner or '-'} | {imp.risk_level.value.upper()} | "
                    f"{imp.confirmation_status.value} |"
                )
            lines.append("")

        watch_only = [i for i in impacts if not i.requires_action]
        if watch_only:
            lines.append("## 仅需关注的团队")
            lines.append("")
            lines.append("| 服务名 | 团队 | 负责人 | 风险等级 | 确认状态 |")
            lines.append("|--------|------|--------|----------|----------|")
            for imp in watch_only:
                lines.append(
                    f"| {imp.service_name} | {imp.team_name} | "
                    f"{imp.owner or '-'} | {imp.risk_level.value.upper()} | "
                    f"{imp.confirmation_status.value} |"
                )
            lines.append("")

        lines.append("## 变更详情")
        for imp in impacts:
            lines.append(f"### {imp.service_name} ({imp.team_name})")
            lines.append("")
            lines.append(f"- **风险等级**: {imp.risk_level.value.upper()}")
            lines.append(f"- **确认状态**: {imp.confirmation_status.value}")
            lines.append(f"- **需要处理**: {'是' if imp.requires_action else '否'}")
            lines.append(f"- **负责人**: {imp.owner or '-'}")
            lines.append("")
            lines.append("#### 受影响端点")
            for ep in imp.endpoints_affected:
                lines.append(f"- {ep}")
            lines.append("")
            lines.append("#### 具体变更")
            for change in imp.changes:
                label = CHANGE_TYPE_LABELS.get(change.change_type, change.change_type.value)
                line = f"- **{label}**: {change.path}"
                if change.old_value is not None and change.new_value is not None:
                    line += f" ({change.old_value} → {change.new_value})"
                lines.append(line)
            lines.append("")

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return str(path)

    def export_json(
        self,
        analysis: ChangeAnalysis,
        output_path: str,
    ) -> str:
        import json

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                analysis.model_dump(mode="json"),
                f,
                indent=2,
                ensure_ascii=False,
            )
        return str(path)
