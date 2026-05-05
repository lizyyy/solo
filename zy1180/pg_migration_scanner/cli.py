"""CLI 入口 - 提供命令行接口。"""

import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

from . import __version__
from .analyzer import MigrationAnalyzer
from .exporter import ReportExporter, RISK_LEVEL_EMOJI, RISK_LEVEL_LABEL
from .models import RiskLevel


console = Console()


@click.group()
@click.version_option(__version__, "-v", "--version")
@click.option("--debug/--no-debug", default=False, help="启用调试模式")
@click.pass_context
def main(ctx: click.Context, debug: bool) -> None:
    """PostgreSQL 迁移脚本风险分析工具。

    用于分析 PostgreSQL 迁移脚本的风险，识别高危 DDL、锁等待链、
    长事务冲突、CONCURRENTLY 缺失、回滚不可逆步骤等问题。
    """
    ctx.ensure_object(dict)
    ctx.obj["DEBUG"] = debug


@main.command()
@click.argument("migrations_dir", type=click.Path(exists=True, file_okay=False))
@click.option(
    "--table-stats", "-s",
    type=click.Path(exists=True, dir_okay=False),
    help="表统计信息 CSV 文件路径",
)
@click.option(
    "--output", "-o",
    type=click.Path(dir_okay=False),
    help="输出报告文件路径",
)
@click.option(
    "--format", "-f",
    type=click.Choice(["json", "markdown", "md"]),
    default="markdown",
    help="输出格式",
)
@click.pass_context
def scan(
    ctx: click.Context,
    migrations_dir: str,
    table_stats: Optional[str],
    output: Optional[str],
    format: str,
) -> None:
    """扫描迁移文件，识别风险。

    读取 migrations/ 目录下的迁移脚本，解析 DDL 操作，
    并识别潜在风险。

    MIGRATIONS_DIR: 迁移文件目录路径
    """
    analyzer = MigrationAnalyzer()

    with console.status("[bold green]正在分析迁移文件..."):
        result = analyzer.scan(
            migrations_dir=Path(migrations_dir),
            table_stats_path=Path(table_stats) if table_stats else None,
        )

    _display_scan_summary(result)

    if output:
        exporter = ReportExporter()
        if format in ["markdown", "md"]:
            exporter.export_markdown(result, Path(output))
            console.print(f"\n[green]报告已导出到: {output}[/green]")
        else:
            exporter.export_json(result, Path(output))
            console.print(f"\n[green]报告已导出到: {output}[/green]")


@main.command()
@click.argument("migrations_dir", type=click.Path(exists=True, file_okay=False))
@click.option(
    "--table-stats", "-s",
    type=click.Path(exists=True, dir_okay=False),
    help="表统计信息 CSV 文件路径",
)
@click.option(
    "--release-window", "-r",
    type=click.Path(exists=True, dir_okay=False),
    help="发布窗口配置 YAML 文件路径",
)
@click.option(
    "--output", "-o",
    type=click.Path(dir_okay=False),
    help="输出报告文件路径",
)
@click.option(
    "--format", "-f",
    type=click.Choice(["json", "markdown", "md"]),
    default="markdown",
    help="输出格式",
)
@click.pass_context
def plan(
    ctx: click.Context,
    migrations_dir: str,
    table_stats: Optional[str],
    release_window: Optional[str],
    output: Optional[str],
    format: str,
) -> None:
    """生成分批上线执行计划。

    分析迁移脚本并生成分批上线方案，包括执行步骤、
    预计时长、风险评估和回滚策略。

    MIGRATIONS_DIR: 迁移文件目录路径
    """
    analyzer = MigrationAnalyzer()

    with console.status("[bold green]正在生成执行计划..."):
        result = analyzer.plan(
            migrations_dir=Path(migrations_dir),
            table_stats_path=Path(table_stats) if table_stats else None,
            release_window_path=Path(release_window) if release_window else None,
        )

    _display_plan_summary(result)

    if output:
        exporter = ReportExporter()
        if format in ["markdown", "md"]:
            exporter.export_markdown(result, Path(output))
            console.print(f"\n[green]报告已导出到: {output}[/green]")
        else:
            exporter.export_json(result, Path(output))
            console.print(f"\n[green]报告已导出到: {output}[/green]")


@main.command()
@click.argument("migrations_dir", type=click.Path(exists=True, file_okay=False))
@click.argument("pg_stat_activity", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "--table-stats", "-s",
    type=click.Path(exists=True, dir_okay=False),
    help="表统计信息 CSV 文件路径",
)
@click.option(
    "--output", "-o",
    type=click.Path(dir_okay=False),
    help="输出报告文件路径",
)
@click.option(
    "--format", "-f",
    type=click.Choice(["json", "markdown", "md"]),
    default="markdown",
    help="输出格式",
)
@click.pass_context
def replay(
    ctx: click.Context,
    migrations_dir: str,
    pg_stat_activity: str,
    table_stats: Optional[str],
    output: Optional[str],
    format: str,
) -> None:
    """重放分析 - 结合 pg_stat_activity 分析锁等待链。

    分析迁移脚本与当前数据库状态的潜在冲突，
    识别锁等待链和长事务。

    MIGRATIONS_DIR: 迁移文件目录路径
    PG_STAT_ACTIVITY: pg_stat_activity 数据文件路径（JSON/YAML/CSV）
    """
    analyzer = MigrationAnalyzer()

    with console.status("[bold green]正在重放分析..."):
        result = analyzer.replay(
            migrations_dir=Path(migrations_dir),
            pg_stat_activity_path=Path(pg_stat_activity),
            table_stats_path=Path(table_stats) if table_stats else None,
        )

    _display_replay_summary(result)

    if output:
        exporter = ReportExporter()
        if format in ["markdown", "md"]:
            exporter.export_markdown(result, Path(output))
            console.print(f"\n[green]报告已导出到: {output}[/green]")
        else:
            exporter.export_json(result, Path(output))
            console.print(f"\n[green]报告已导出到: {output}[/green]")


@main.command()
@click.argument("migrations_dir", type=click.Path(exists=True, file_okay=False))
@click.option(
    "--table-stats", "-s",
    type=click.Path(exists=True, dir_okay=False),
    help="表统计信息 CSV 文件路径",
)
@click.option(
    "--release-window", "-r",
    type=click.Path(exists=True, dir_okay=False),
    help="发布窗口配置 YAML 文件路径",
)
@click.option(
    "--pg-stat-activity", "-p",
    type=click.Path(exists=True, dir_okay=False),
    help="pg_stat_activity 数据文件路径",
)
@click.option(
    "--output", "-o",
    type=click.Path(dir_okay=False),
    required=True,
    help="输出报告文件路径",
)
@click.option(
    "--format", "-f",
    type=click.Choice(["json", "markdown", "md"]),
    default="markdown",
    help="输出格式",
)
@click.option(
    "--include-plan/--no-plan",
    default=True,
    help="是否包含执行计划",
)
@click.pass_context
def export(
    ctx: click.Context,
    migrations_dir: str,
    table_stats: Optional[str],
    release_window: Optional[str],
    pg_stat_activity: Optional[str],
    output: str,
    format: str,
    include_plan: bool,
) -> None:
    """导出完整分析报告。

    执行完整分析并导出 Markdown 或 JSON 格式报告。

    MIGRATIONS_DIR: 迁移文件目录路径
    """
    analyzer = MigrationAnalyzer()

    with console.status("[bold green]正在执行完整分析..."):
        result = analyzer.analyze(
            migrations_dir=Path(migrations_dir),
            table_stats_path=Path(table_stats) if table_stats else None,
            release_window_path=Path(release_window) if release_window else None,
            pg_stat_activity_path=Path(pg_stat_activity) if pg_stat_activity else None,
            include_plan=include_plan,
        )

    exporter = ReportExporter()
    if format in ["markdown", "md"]:
        exporter.export_markdown(result, Path(output))
    else:
        exporter.export_json(result, Path(output))

    console.print(f"[green]报告已导出到: {output}[/green]")
    _display_brief_summary(result)


def _display_scan_summary(result) -> None:
    """显示扫描结果摘要。"""
    console.print("\n")
    console.print(Panel.fit(
        "[bold green]扫描完成[/bold green]",
        subtitle=f"分析 ID: {result.analysis_id}",
    ))

    summary = result.summary
    risk_counts = summary.get("risk_counts", {})

    table = Table(title="风险统计")
    table.add_column("级别", style="bold")
    table.add_column("数量", justify="right")
    table.add_column("状态", style="italic")

    for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
        count = risk_counts.get(level.value, 0)
        emoji = RISK_LEVEL_EMOJI[level]
        label = RISK_LEVEL_LABEL[level]
        status = "需要立即处理" if count > 0 and level in [RiskLevel.CRITICAL, RiskLevel.HIGH] else "正常"
        table.add_row(f"{emoji} {label}", str(count), status)

    console.print(table)

    if result.risk_findings:
        console.print("\n[bold]风险详情:[/bold]")
        for i, risk in enumerate(result.risk_findings[:10], 1):
            emoji = RISK_LEVEL_EMOJI[risk.risk_level]
            console.print(f"\n  {emoji} [bold]{risk.title}[/bold]")
            console.print(f"     影响对象: {risk.affected_object}")
            console.print(f"     描述: {risk.description}")

        if len(result.risk_findings) > 10:
            console.print(f"\n  ... 还有 {len(result.risk_findings) - 10} 个风险未显示")

    ddl_types = summary.get("ddl_type_counts", {})
    if ddl_types:
        console.print("\n[bold]DDL 操作类型统计:[/bold]")
        for ddl_type, count in ddl_types.items():
            console.print(f"  - {ddl_type}: {count} 次")


def _display_plan_summary(result) -> None:
    """显示计划结果摘要。"""
    console.print("\n")
    console.print(Panel.fit(
        "[bold green]执行计划生成完成[/bold green]",
        subtitle=f"计划 ID: {result.execution_plan.plan_id if result.execution_plan else result.analysis_id}",
    ))

    if result.execution_plan:
        plan = result.execution_plan
        risk_emoji = RISK_LEVEL_EMOJI[plan.overall_risk_level]
        risk_label = RISK_LEVEL_LABEL[plan.overall_risk_level]

        console.print(f"\n[bold]整体风险等级:[/bold] {risk_emoji} {risk_label}")
        console.print(f"[bold]预计总时长:[/bold] {plan.total_estimated_duration_minutes:.1f} 分钟")

        if plan.warnings:
            console.print("\n[bold yellow]⚠️ 警告:[/bold yellow]")
            for warning in plan.warnings:
                console.print(f"  - {warning}")

        console.print("\n[bold]执行步骤:[/bold]")
        for step in plan.steps:
            step_emoji = RISK_LEVEL_EMOJI[step.risk_level]
            console.print(
                f"\n  {step.order}. [bold]{step.title}[/bold] "
                f"({step_emoji} {RISK_LEVEL_LABEL[step.risk_level]})"
            )
            console.print(f"     预计时长: {step.estimated_duration_minutes:.1f} 分钟")
            for op in step.operations[:3]:
                console.print(f"     - {op}")
            if len(step.operations) > 3:
                console.print(f"     ... 还有 {len(step.operations) - 3} 个操作")

    if result.risk_findings:
        critical_count = sum(
            1 for r in result.risk_findings
            if r.risk_level == RiskLevel.CRITICAL
        )
        high_count = sum(
            1 for r in result.risk_findings
            if r.risk_level == RiskLevel.HIGH
        )
        if critical_count > 0 or high_count > 0:
            console.print(
                f"\n[bold red]⚠️ 检测到 {critical_count} 个严重风险和 {high_count} 个高风险，"
                f"建议在执行前解决。[/bold red]"
            )


def _display_replay_summary(result) -> None:
    """显示重放分析结果摘要。"""
    console.print("\n")
    console.print(Panel.fit(
        "[bold green]重放分析完成[/bold green]",
        subtitle=f"分析 ID: {result.analysis_id}",
    ))

    if result.lock_wait_chains:
        console.print(f"\n[bold]🔗 检测到 {len(result.lock_wait_chains)} 个锁等待链:[/bold]")
        for chain in result.lock_wait_chains[:5]:
            console.print(f"\n  {chain.chain_id}:")
            console.print(f"     被阻塞 PID: {chain.blocked_pid}")
            console.print(f"     阻塞 PID: {chain.blocking_pid}")
            console.print(f"     等待时长: {chain.duration_seconds:.2f} 秒")
            console.print(f"     锁定对象: {chain.locked_object}")
        if len(result.lock_wait_chains) > 5:
            console.print(f"\n  ... 还有 {len(result.lock_wait_chains) - 5} 个等待链未显示")

    if result.long_transactions:
        console.print(f"\n[bold]⏱️ 检测到 {len(result.long_transactions)} 个长事务:[/bold]")
        for txn in result.long_transactions[:5]:
            duration_min = txn.duration_seconds / 60
            console.print(f"\n  PID {txn.pid}:")
            console.print(f"     持续时间: {duration_min:.1f} 分钟")
            console.print(f"     用户: {txn.usename}")
            console.print(f"     应用: {txn.application_name}")
        if len(result.long_transactions) > 5:
            console.print(f"\n  ... 还有 {len(result.long_transactions) - 5} 个长事务未显示")

    if not result.lock_wait_chains and not result.long_transactions:
        console.print("\n[green]✓ 未检测到锁等待链或长事务[/green]")

    if result.risk_findings:
        critical_count = sum(
            1 for r in result.risk_findings
            if r.risk_level == RiskLevel.CRITICAL
        )
        high_count = sum(
            1 for r in result.risk_findings
            if r.risk_level == RiskLevel.HIGH
        )
        if critical_count > 0 or high_count > 0:
            console.print(
                f"\n[bold red]⚠️ 迁移脚本包含 {critical_count} 个严重风险和 {high_count} 个高风险。[/bold red]"
            )
            console.print("[bold red]建议在执行迁移前解决这些问题或等待锁释放。[/bold red]")


def _display_brief_summary(result) -> None:
    """显示简要摘要。"""
    summary = result.summary
    risk_counts = summary.get("risk_counts", {})

    critical = risk_counts.get("critical", 0)
    high = risk_counts.get("high", 0)

    if critical > 0 or high > 0:
        console.print(
            f"\n[bold yellow]摘要:[/bold yellow] 检测到 {critical} 个严重风险, {high} 个高风险"
        )
    else:
        console.print("\n[green]摘要: 未检测到严重风险[/green]")

    console.print(f"  迁移文件: {summary.get('migration_files_count', 0)} 个")
    console.print(f"  DDL 操作: {summary.get('operations_count', 0)} 个")


if __name__ == "__main__":
    main()
