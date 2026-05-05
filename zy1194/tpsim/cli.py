"""线程池模拟器 CLI"""

import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich import print as rprint

from .config import ConfigParser
from .simulator import ThreadPoolSimulator
from .analyzer import ResultAnalyzer
from .exporter import ReportExporter
from .models import SimulationConfig


console = Console()


@click.group()
@click.version_option(version="0.1.0")
@click.option("--verbose", "-v", is_flag=True, help="启用详细输出")
@click.pass_context
def main(ctx, verbose):
    """线程池任务调度模拟器 - 模拟、分析和优化线程池配置
    
    示例:
        tpsim simulate config.yaml
        tpsim analyze config.yaml --export report.md
        tpsim export config.json --format json
    """
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose


@main.command()
@click.argument("config_file", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), help="输出报告文件路径")
@click.option("--format", "-f", type=click.Choice(["markdown", "json"]), default="markdown", help="输出格式")
@click.option("--include-timeline", is_flag=True, help="包含详细时间线")
@click.pass_context
def simulate(ctx, config_file, output, format, include_timeline):
    """运行线程池模拟
    
    CONFIG_FILE: 配置文件路径 (YAML 或 JSON 格式)
    """
    verbose = ctx.obj["verbose"]
    
    # 解析配置
    if verbose:
        console.print(f"[blue]解析配置文件: {config_file}[/blue]")
    
    try:
        config = ConfigParser.parse_file(config_file)
    except Exception as e:
        console.print(f"[red]配置解析失败: {e}[/red]")
        sys.exit(1)
    
    if verbose:
        _print_config_summary(config)
    
    # 运行模拟
    console.print("[green]开始模拟...[/green]")
    
    try:
        simulator = ThreadPoolSimulator(config)
        result = simulator.run()
    except Exception as e:
        console.print(f"[red]模拟执行失败: {e}[/red]")
        sys.exit(1)
    
    console.print("[green]模拟完成[/green]")
    
    # 显示结果摘要
    analyzer = ResultAnalyzer(result)
    _print_result_summary(analyzer)
    
    # 导出报告
    if output:
        exporter = ReportExporter(result)
        try:
            exporter.export_to_file(
                output,
                format=format,
                include_timeline=include_timeline
            )
            console.print(f"[green]报告已导出: {output}[/green]")
        except Exception as e:
            console.print(f"[red]报告导出失败: {e}[/red]")
            sys.exit(1)


@main.command()
@click.argument("config_file", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), help="输出分析报告文件路径")
@click.option("--format", "-f", type=click.Choice(["markdown", "json"]), default="markdown", help="输出格式")
@click.option("--include-timeline", is_flag=True, help="包含详细时间线")
@click.option("--show-workers", is_flag=True, help="显示 Worker 详细统计")
@click.option("--show-bottlenecks", is_flag=True, help="显示瓶颈分析")
@click.pass_context
def analyze(ctx, config_file, output, format, include_timeline, show_workers, show_bottlenecks):
    """运行模拟并进行详细分析
    
    CONFIG_FILE: 配置文件路径 (YAML 或 JSON 格式)
    """
    verbose = ctx.obj["verbose"]
    
    # 解析配置
    try:
        config = ConfigParser.parse_file(config_file)
    except Exception as e:
        console.print(f"[red]配置解析失败: {e}[/red]")
        sys.exit(1)
    
    # 运行模拟
    console.print("[green]开始模拟...[/green]")
    
    try:
        simulator = ThreadPoolSimulator(config)
        result = simulator.run()
    except Exception as e:
        console.print(f"[red]模拟执行失败: {e}[/red]")
        sys.exit(1)
    
    console.print("[green]模拟完成[/green]")
    
    # 显示详细分析
    analyzer = ResultAnalyzer(result)
    
    # 显示概览
    _print_result_summary(analyzer)
    
    # 显示 Worker 详情
    if show_workers:
        _print_worker_details(analyzer)
    
    # 显示瓶颈分析
    if show_bottlenecks:
        _print_bottleneck_analysis(analyzer)
    
    # 显示调优建议
    _print_suggestions(analyzer)
    
    # 导出报告
    if output:
        exporter = ReportExporter(result)
        try:
            exporter.export_to_file(
                output,
                format=format,
                include_timeline=include_timeline
            )
            console.print(f"[green]报告已导出: {output}[/green]")
        except Exception as e:
            console.print(f"[red]报告导出失败: {e}[/red]")
            sys.exit(1)


@main.command()
@click.argument("config_file", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), required=True, help="输出报告文件路径")
@click.option("--format", "-f", type=click.Choice(["markdown", "json"]), default="markdown", help="输出格式")
@click.option("--include-timeline", is_flag=True, help="包含详细时间线")
@click.pass_context
def export(ctx, config_file, output, format, include_timeline):
    """运行模拟并导出完整报告
    
    CONFIG_FILE: 配置文件路径 (YAML 或 JSON 格式)
    """
    # 解析配置
    try:
        config = ConfigParser.parse_file(config_file)
    except Exception as e:
        console.print(f"[red]配置解析失败: {e}[/red]")
        sys.exit(1)
    
    # 运行模拟
    console.print("[green]开始模拟...[/green]")
    
    try:
        simulator = ThreadPoolSimulator(config)
        result = simulator.run()
    except Exception as e:
        console.print(f"[red]模拟执行失败: {e}[/red]")
        sys.exit(1)
    
    # 导出报告
    exporter = ReportExporter(result)
    try:
        exporter.export_to_file(
            output,
            format=format,
            include_timeline=include_timeline
        )
        console.print(f"[green]报告已导出: {output}[/green]")
    except Exception as e:
        console.print(f"[red]报告导出失败: {e}[/red]")
        sys.exit(1)


def _print_config_summary(config: SimulationConfig):
    """打印配置摘要"""
    table = Table(title="配置摘要")
    table.add_column("类别", style="cyan")
    table.add_column("参数", style="magenta")
    table.add_column("值", style="green")
    
    table.add_row("线程池", "Worker 数量", str(config.worker_count))
    table.add_row("线程池", "本地队列容量", str(config.local_queue_capacity))
    table.add_row("线程池", "全局队列容量", str(config.global_queue_capacity))
    table.add_row("队列策略", "工作窃取", "启用" if config.use_work_stealing else "禁用")
    table.add_row("队列策略", "窃取策略", config.steal_from)
    table.add_row("背压策略", "策略", config.backpressure_strategy)
    table.add_row("背压策略", "最大等待时间", str(config.max_queue_wait_time))
    table.add_row("饥饿检测", "阈值", str(config.starvation_threshold))
    table.add_row("模拟", "时长", str(config.simulation_duration))
    table.add_row("模拟", "任务数", str(len(config.tasks)))
    table.add_row("模拟", "生产者数", str(len(config.producers)))
    
    console.print(table)


def _print_result_summary(analyzer: ResultAnalyzer):
    """打印结果摘要"""
    overview = analyzer.get_overview()
    
    # 状态面板
    status_color = "green"
    if overview["dropped_tasks"] > 0 or overview["starved_tasks"] > 0:
        status_color = "yellow"
    if overview["success_rate"] < 0.8:
        status_color = "red"
    
    status_panel = Panel(
        f"""
[bold]模拟概览[/bold]

  [cyan]模拟时长:[/cyan] {overview['simulation_duration']:.2f}
  [cyan]Worker 数量:[/cyan] {overview['worker_count']}
  [cyan]工作窃取:[/cyan] {'启用' if overview['work_stealing_enabled'] else '禁用'}

[bold]任务统计[/bold]

  [green]总任务数:[/green] {overview['total_tasks']}
  [green]已完成:[/green] {overview['completed_tasks']}
  [yellow]已丢弃:[/yellow] {overview['dropped_tasks']}
  [red]饥饿任务:[/red] {overview['starved_tasks']}
  [cyan]成功率:[/cyan] {overview['success_rate']:.1%}

[bold]性能指标[/bold]

  [green]吞吐量:[/green] {overview['throughput']:.2f} 任务/单位时间
  [yellow]平均等待时间:[/yellow] {overview['avg_wait_time']:.2f}
  [yellow]平均周转时间:[/yellow] {overview['avg_turnaround_time']:.2f}
  [cyan]平均 Worker 利用率:[/cyan] {overview['avg_worker_utilization']:.1%}
        """,
        title="[bold green]模拟结果[/bold green]",
        border_style=status_color
    )
    console.print(status_panel)


def _print_worker_details(analyzer: ResultAnalyzer):
    """打印 Worker 详情"""
    worker_details = analyzer.get_worker_utilization_details()
    
    table = Table(title="Worker 详细统计")
    table.add_column("Worker ID", style="cyan")
    table.add_column("状态", style="magenta")
    table.add_column("完成任务", style="green")
    table.add_column("窃取任务", style="yellow")
    table.add_column("窃取成功率", style="blue")
    table.add_column("利用率", style="cyan")
    table.add_column("本地队列", style="magenta")
    
    for w in worker_details:
        util_color = "green" if w["utilization"] > 0.5 else "yellow" if w["utilization"] > 0.2 else "red"
        table.add_row(
            w["worker_id"],
            w["state"],
            str(w["tasks_completed"]),
            str(w["tasks_stolen"]),
            f"{w['steal_success_rate']:.1%}",
            f"[{util_color}]{w['utilization']:.1%}[/{util_color}]",
            f"{w['local_queue_size']}/{w['local_queue_capacity']}"
        )
    
    console.print(table)


def _print_bottleneck_analysis(analyzer: ResultAnalyzer):
    """打印瓶颈分析"""
    bottleneck_analysis = analyzer.get_bottleneck_analysis()
    bottlenecks = bottleneck_analysis["bottlenecks"]
    
    if not bottlenecks:
        console.print(Panel(
            "[green]未检测到明显瓶颈[/green]",
            title="瓶颈分析"
        ))
        return
    
    tree = Tree("[bold yellow]瓶颈分析[/bold yellow]")
    
    for b in bottlenecks:
        severity_icon = "🔴" if b["severity"] == "critical" else "🟡" if b["severity"] == "warning" else "🔵"
        branch = tree.add(f"{severity_icon} [bold]{b['description']}[/bold]")
        branch.add(f"类型: {b['type']}")
        branch.add(f"严重程度: {b['severity']}")
        
        details = b["details"]
        for key, value in details.items():
            if key != "suggestion":
                branch.add(f"{key}: {value}")
        
        if "suggestion" in details:
            branch.add(f"[green]建议: {details['suggestion']}[/green]")
    
    console.print(tree)


def _print_suggestions(analyzer: ResultAnalyzer):
    """打印调优建议"""
    suggestions = analyzer.get_suggestions_summary()
    
    if not suggestions:
        console.print(Panel(
            "[green]无调优建议，当前配置表现良好[/green]",
            title="调优建议"
        ))
        return
    
    table = Table(title="调优建议")
    table.add_column("严重程度", style="cyan")
    table.add_column("类别", style="magenta")
    table.add_column("建议", style="green")
    table.add_column("当前值", style="yellow")
    table.add_column("推荐值", style="blue")
    
    for s in suggestions:
        severity_icon = "🔴" if s["severity"] == "critical" else "🟡" if s["severity"] == "warning" else "🔵"
        table.add_row(
            f"{severity_icon} {s['severity']}",
            s["category"],
            s["suggestion"],
            s["current_value"],
            s["recommended_value"]
        )
    
    console.print(table)


if __name__ == "__main__":
    main()
