from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .parser import ConfigParser, LockConfig, WorkloadParser, generate_seed_workload
from .reporter import Reporter, format_timeline_console
from .simulator import Simulator

console = Console()


@click.group()
@click.version_option(version="0.1.0", prog_name="lock-analyzer")
def cli():
    """单文件数据库读写锁冲突复盘工具"""
    pass


@cli.command()
@click.option(
    "--output", "-o",
    type=click.Path(path_type=Path),
    default=Path("."),
    help="输出目录 (默认: 当前目录)",
)
@click.option(
    "--seed", "-s",
    type=int,
    default=42,
    help="随机种子 (默认: 42)",
)
@click.option(
    "--connections", "-c",
    type=int,
    default=3,
    help="连接数 (默认: 3)",
)
@click.option(
    "--events", "-e",
    type=int,
    default=20,
    help="事件数 (默认: 20)",
)
@click.option(
    "--force", "-f",
    is_flag=True,
    help="覆盖已存在的文件",
)
def init(output: Path, seed: int, connections: int, events: int, force: bool):
    """初始化示例项目，生成 workload.jsonl 和 lock-config.yaml"""
    output_dir = output if output.is_dir() else output.parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    workload_path = output_dir / "workload.jsonl"
    config_path = output_dir / "lock-config.yaml"
    
    if workload_path.exists() and not force:
        console.print(f"[red]错误: {workload_path} 已存在，使用 --force 覆盖[/]")
        return
    
    if config_path.exists() and not force:
        console.print(f"[red]错误: {config_path} 已存在，使用 --force 覆盖[/]")
        return
    
    seed_events = generate_seed_workload(seed=seed, num_connections=connections, num_events=events)
    
    with open(workload_path, "w") as f:
        for event in seed_events:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")
    
    default_config = LockConfig()
    ConfigParser.write(default_config, config_path)
    
    console.print(f"[green]✅ 已初始化示例项目[/]")
    console.print(f"   workload: {workload_path}")
    console.print(f"   config: {config_path}")
    console.print()
    console.print("运行以下命令开始模拟:")
    console.print(f"  [cyan]lock-analyzer simulate -w {workload_path} -c {config_path}[/]")


@cli.command()
@click.option(
    "--workload", "-w",
    type=click.Path(exists=True, path_type=Path),
    required=True,
    help="Workload JSONL 文件路径",
)
@click.option(
    "--config", "-c",
    type=click.Path(exists=True, path_type=Path),
    help="Lock config YAML 文件路径 (可选，使用默认配置)",
)
@click.option(
    "--output", "-o",
    type=click.Path(path_type=Path),
    help="输出报告文件路径 (不含扩展名)",
)
@click.option(
    "--format", "-f",
    type=click.Choice(["json", "markdown", "both", "none"]),
    default="none",
    help="输出格式 (默认: 仅控制台)",
)
@click.option(
    "--show-timeline/--hide-timeline",
    default=True,
    help="是否显示时间线 (默认: 显示)",
)
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="详细输出",
)
def simulate(
    workload: Path,
    config: Optional[Path],
    output: Optional[Path],
    format: str,
    show_timeline: bool,
    verbose: bool,
):
    """模拟并发读写，分析锁冲突"""
    with console.status("[bold green]解析 workload...[/]"):
        parser = WorkloadParser()
        events = parser.parse_file(workload)
        
        if config:
            lock_config = ConfigParser.parse_file(config)
        else:
            lock_config = LockConfig()
        
        console.print(f"[cyan]解析完成: {len(events)} 个事件，{len(parser.get_connection_ids())} 个连接[/]")
    
    with console.status("[bold green]执行模拟...[/]"):
        simulator = Simulator(lock_config)
        result = simulator.simulate(events)
    
    console.print()
    console.print(Panel(
        _build_summary_panel(result),
        title="模拟结果",
        border_style="green" if result.success else "red",
    ))
    
    if result.deadlocks:
        console.print()
        console.print("[bold red]🔴 检测到死锁[/]")
        for i, deadlock in enumerate(result.deadlocks, 1):
            console.print(f"  死锁 #{i}: 涉及连接 {', '.join(deadlock.connections)}")
            if verbose:
                console.print(f"    等待图:")
                for conn, waiting in deadlock.waiting_graph.items():
                    if waiting:
                        console.print(f"      {conn} → {', '.join(waiting)}")
    
    if result.starvation_risks:
        console.print()
        console.print("[bold yellow]🟡 检测到饿死风险[/]")
        for i, risk in enumerate(result.starvation_risks, 1):
            console.print(f"  风险 #{i}: 连接 {risk.connection_id} 已等待 {risk.wait_time_ms:.0f}ms")
            console.print(f"    被阻塞者: {', '.join(risk.blocked_by)}")
    
    if show_timeline and result.timeline:
        console.print()
        console.print(format_timeline_console(result))
    
    if format != "none" and output:
        with console.status("[bold green]生成报告...[/]"):
            if format == "json":
                Reporter.export_json(result, output.with_suffix(".json"))
                console.print(f"[green]✅ 已导出 JSON 报告: {output.with_suffix('.json')}[/]")
            elif format == "markdown":
                Reporter.export_markdown(result, output.with_suffix(".md"))
                console.print(f"[green]✅ 已导出 Markdown 报告: {output.with_suffix('.md')}[/]")
            elif format == "both":
                Reporter.export_both(result, output)
                console.print(f"[green]✅ 已导出报告: {output}.json 和 {output}.md[/]")


@cli.command()
@click.option(
    "--workload", "-w",
    type=click.Path(exists=True, path_type=Path),
    required=True,
    help="Workload JSONL 文件路径",
)
@click.option(
    "--config", "-c",
    type=click.Path(exists=True, path_type=Path),
    help="Lock config YAML 文件路径",
)
@click.option(
    "--connection", "-C",
    type=str,
    required=True,
    help="要分析的连接 ID",
)
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="详细输出",
)
def explain(workload: Path, config: Optional[Path], connection: str, verbose: bool):
    """解释特定连接的阻塞原因"""
    parser = WorkloadParser()
    events = parser.parse_file(workload)
    
    if config:
        lock_config = ConfigParser.parse_file(config)
    else:
        lock_config = LockConfig()
    
    simulator = Simulator(lock_config)
    result = simulator.simulate(events)
    
    explanation = simulator.explain_block(connection)
    
    if "error" in explanation:
        console.print(f"[red]❌ {explanation['error']}[/]")
        return
    
    console.print()
    console.print(Panel(
        _build_explanation_panel(explanation),
        title=f"连接 {connection} 分析",
        border_style="cyan",
    ))
    
    if explanation["blocked_by"]:
        console.print()
        console.print("[bold red]🔴 被以下连接阻塞:[/]")
        for blocker in explanation["blocked_by"]:
            console.print(f"  - {blocker['connection_id']} (持有 {blocker['lock_type']} 锁)")


@cli.command()
@click.option(
    "--workload", "-w",
    type=click.Path(exists=True, path_type=Path),
    required=True,
    help="Workload JSONL 文件路径",
)
@click.option(
    "--config", "-c",
    type=click.Path(exists=True, path_type=Path),
    help="Lock config YAML 文件路径",
)
@click.option(
    "--output", "-o",
    type=click.Path(path_type=Path),
    required=True,
    help="输出报告文件路径 (不含扩展名)",
)
@click.option(
    "--format", "-f",
    type=click.Choice(["json", "markdown", "both"]),
    default="both",
    help="输出格式 (默认: 两者都输出)",
)
@click.option(
    "--show-timeline/--hide-timeline",
    default=True,
    help="是否在 Markdown 中包含时间线 (默认: 包含)",
)
def export(
    workload: Path,
    config: Optional[Path],
    output: Path,
    format: str,
    show_timeline: bool,
):
    """导出完整的分析报告"""
    parser = WorkloadParser()
    events = parser.parse_file(workload)
    
    if config:
        lock_config = ConfigParser.parse_file(config)
    else:
        lock_config = LockConfig()
    
    simulator = Simulator(lock_config)
    result = simulator.simulate(events)
    
    with console.status("[bold green]导出报告...[/]"):
        if format == "json":
            Reporter.export_json(result, output.with_suffix(".json"))
            console.print(f"[green]✅ 已导出: {output.with_suffix('.json')}[/]")
        elif format == "markdown":
            Reporter.export_markdown(result, output.with_suffix(".md"), include_timeline=show_timeline)
            console.print(f"[green]✅ 已导出: {output.with_suffix('.md')}[/]")
        else:
            Reporter.export_both(result, output, include_timeline=show_timeline)
            console.print(f"[green]✅ 已导出: {output}.json 和 {output}.md[/]")


def _build_summary_panel(result) -> Text:
    text = Text()
    
    text.append(f"{'状态:':<15}", style="bold")
    if result.success:
        text.append("✅ 成功", style="green")
    else:
        text.append("❌ 检测到问题", style="red")
    text.append("\n")
    
    text.append(f"{'时间范围:':<15}", style="bold")
    if result.start_time and result.end_time:
        text.append(f"{result.start_time.strftime('%H:%M:%S')} → {result.end_time.strftime('%H:%M:%S')}")
    text.append("\n")
    
    text.append(f"{'总事件数:':<15}", style="bold")
    text.append(f"{result.total_events}\n")
    
    text.append(f"{'已完成:':<15}", style="bold")
    text.append(f"{result.completed_events} ", style="green")
    text.append("\n")
    
    text.append(f"{'被阻塞:':<15}", style="bold")
    text.append(f"{result.blocked_events} ", style="yellow")
    text.append("\n")
    
    text.append(f"{'超时:':<15}", style="bold")
    text.append(f"{result.timeout_events} ", style="red")
    text.append("\n")
    
    text.append(f"{'死锁:':<15}", style="bold")
    if result.deadlocks:
        text.append(f"{len(result.deadlocks)} 个", style="red")
    else:
        text.append("0", style="green")
    text.append("\n")
    
    text.append(f"{'饿死风险:':<15}", style="bold")
    if result.starvation_risks:
        text.append(f"{len(result.starvation_risks)} 个", style="yellow")
    else:
        text.append("0", style="green")
    
    return text


def _build_explanation_panel(explanation: dict) -> Text:
    text = Text()
    
    text.append(f"{'连接 ID:':<20}", style="bold")
    text.append(f"{explanation['connection_id']}\n")
    
    text.append(f"{'事务中:':<20}", style="bold")
    if explanation["in_transaction"]:
        text.append("✅ 是", style="green")
    else:
        text.append("❌ 否", style="yellow")
    text.append("\n")
    
    text.append(f"{'持有的锁:':<20}", style="bold")
    if explanation["held_lock"]:
        text.append(f"{explanation['held_lock']}", style="cyan")
    else:
        text.append("无")
    text.append("\n")
    
    text.append(f"{'当前锁状态:':<20}", style="bold")
    text.append(f"{explanation['current_lock_state']}", style="magenta")
    text.append("\n")
    
    if explanation["waiting_for"] and explanation["waiting_for"]["lock_type"]:
        text.append(f"{'等待锁:':<20}", style="bold")
        text.append(f"{explanation['waiting_for']['lock_type']}", style="red")
        text.append("\n")
        
        text.append(f"{'等待原因:':<20}", style="bold")
        text.append(f"{explanation['waiting_for']['reason'] or '-'}")
        text.append("\n")
    
    if explanation["blocked_by"]:
        text.append(f"{'被阻塞者数量:':<20}", style="bold")
        text.append(f"{len(explanation['blocked_by'])}", style="red")
    
    return text


if __name__ == "__main__":
    cli()
