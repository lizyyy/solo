"""
命令行入口
"""
import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import (
    IOSelectorType, TriggerMode,
    ISelectorError, ConfigError, SimulationError
)
from .config_parser import ConfigParser
from .simulator import IOSimulator
from .analyzer import ResultAnalyzer
from .storage import SQLiteStorage
from .exporter import ReportExporter


console = Console()


@click.group()
@click.version_option(version="0.1.0", prog_name="ioselector")
@click.option("--cases-dir", "-C", 
              type=click.Path(exists=False, file_okay=False, dir_okay=True),
              help="配置文件目录 (默认: ./cases)")
@click.option("--db-path", "-D",
              type=click.Path(exists=False, file_okay=True, dir_okay=False),
              help="SQLite 数据库路径 (默认: ./ioselector.db)")
@click.pass_context
def cli(ctx, cases_dir, db_path):
    """
    IO Selector Simulator - 一个用于演示 select/poll/epoll 差异的命令行工具
    
    支持三种触发模式的对比、惊群效应演示、CPU 效率分析等。
    """
    ctx.ensure_object(dict)
    ctx.obj['cases_dir'] = cases_dir or os.path.join(os.getcwd(), "cases")
    ctx.obj['db_path'] = db_path


@cli.command()
@click.argument("case_name", required=False)
@click.option("--list", "-l", "list_cases", is_flag=True,
              help="列出所有可用的测试用例")
@click.option("--save", "-s", is_flag=True,
              help="保存运行结果到数据库")
@click.option("--show-events", "-e", is_flag=True,
              help="显示事件时间线")
@click.option("--max-events", "-n", type=int, default=50,
              help="最多显示的事件数量 (默认: 50)")
@click.pass_context
def simulate(ctx, case_name, list_cases, save, show_events, max_events):
    """
    运行模拟
    
    根据配置文件运行 IO 多路复用模拟，输出事件时间线和统计数据。
    
    示例:
        ioselector simulate epoll-lt-good
        ioselector simulate --list
        ioselector simulate select-bad -s -e
    """
    parser = ConfigParser(ctx.obj['cases_dir'])
    
    # 列出可用用例
    if list_cases:
        cases = parser.list_cases()
        if not cases:
            console.print("[yellow]没有找到可用的配置文件[/yellow]")
            console.print(f"请在 {ctx.obj['cases_dir']} 目录下创建 .yaml 配置文件")
            return
        
        table = Table(title="可用测试用例")
        table.add_column("文件名", style="cyan")
        table.add_column("名称", style="green")
        table.add_column("选择器", style="blue")
        table.add_column("触发模式", style="magenta")
        table.add_column("类型", style="yellow")
        table.add_column("描述", style="white")
        
        for case in cases:
            trigger_display = "LT" if case['trigger_mode'] == "lt" else "ET"
            type_display = "✅ 正常" if case['is_good_example'] else "❌ 坏样例"
            table.add_row(
                case['filename'],
                case['name'],
                case['selector_type'].upper(),
                trigger_display,
                type_display,
                case['description'][:40] + "..." if len(case['description']) > 40 else case['description']
            )
        
        console.print(table)
        return
    
    # 运行模拟
    if not case_name:
        console.print("[red]错误: 请指定测试用例名称[/red]")
        console.print("使用 --list 查看可用用例")
        sys.exit(1)
    
    try:
        # 解析配置
        console.print(f"[bold cyan]正在加载配置: {case_name}[/bold cyan]")
        config = parser.get_case(case_name)
        
        # 显示配置摘要
        console.print(Panel(
            f"""[bold]配置摘要[/bold]
用例名称: {config.name}
描述: {config.description or '无'}
选择器: {config.selector_type.value.upper()}
触发模式: {'水平触发 (LT)' if config.trigger_mode == TriggerMode.LEVEL_TRIGGERED else '边缘触发 (ET)'}
连接数: {len(config.connections)}
Worker 数: {len(config.workers)}
EPOLLEXCLUSIVE: {'启用' if config.epollexclusive else '未启用'}
模拟时长: {config.simulation_duration_ms} ms""",
            title="配置信息",
            expand=False
        ))
        
        # 运行模拟
        console.print(f"[bold cyan]正在运行模拟...[/bold cyan]")
        simulator = IOSimulator(config)
        result = simulator.run()
        
        # 显示结果摘要
        console.print(Panel(
            _format_result_summary(result),
            title="模拟结果",
            expand=False
        ))
        
        # 显示事件时间线
        if show_events and result.events:
            console.print(f"\n[bold magenta]事件时间线 (前 {min(max_events, len(result.events))} 条):[/bold magenta]")
            table = Table(show_header=True, header_style="bold blue")
            table.add_column("时间(ms)", style="cyan", width=10)
            table.add_column("类型", style="green", width=8)
            table.add_column("FD", style="yellow", width=6)
            table.add_column("Worker", style="magenta", width=8)
            table.add_column("详情", style="white")
            
            for event in result.events[:max_events]:
                worker = str(event.worker_id) if event.worker_id is not None else "-"
                table.add_row(
                    str(event.timestamp_ms),
                    event.event_type.value,
                    str(event.fd),
                    worker,
                    event.details
                )
            
            console.print(table)
        
        # 保存到数据库
        if save:
            storage = SQLiteStorage(ctx.obj['db_path'])
            run_id = storage.save_run(result)
            console.print(f"[green]✓ 结果已保存到数据库，记录 ID: {run_id}[/green]")
        
        # 运行分析
        console.print(f"\n[bold cyan]正在分析结果...[/bold cyan]")
        analyzer = ResultAnalyzer()
        analysis = analyzer.analyze(result)
        
        console.print(Panel(
            f"""[bold]CPU 效率评分: {analysis.cpu_efficiency_score:.1f}/100[/bold]

[bold]漏读风险:[/bold]
{analysis.missed_read_risk}

[bold]惊群效应:[/bold]
{analysis.thundering_herd_analysis}

[bold]总体评价:[/bold]
{analysis.summary}""",
            title="分析结果",
            expand=False
        ))
        
        # 显示评级颜色
        rating_color = {
            "good": "green",
            "warning": "yellow",
            "danger": "red"
        }.get(analysis.overall_rating, "white")
        
        rating_text = {
            "good": "✅ 良好",
            "warning": "⚠️ 警告",
            "danger": "❌ 危险"
        }.get(analysis.overall_rating, "未知")
        
        console.print(f"\n[bold {rating_color}]总体评级: {rating_text}[/bold {rating_color}]")
        
    except ConfigError as e:
        console.print(f"[red]配置错误: {e}[/red]")
        sys.exit(1)
    except SimulationError as e:
        console.print(f"[red]模拟错误: {e}[/red]")
        sys.exit(1)
    except ISelectorError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]意外错误: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument("run_id", type=int, required=False)
@click.option("--list", "-l", "list_runs", is_flag=True,
              help="列出历史运行记录")
@click.option("--case", "-c", "case_name",
              help="按用例名称筛选")
@click.option("--limit", "-n", type=int, default=20,
              help="显示记录数量 (默认: 20)")
@click.option("--stats", "-s", is_flag=True,
              help="显示统计汇总")
@click.pass_context
def analyze(ctx, run_id, list_runs, case_name, limit, stats):
    """
    分析历史运行记录
    
    查询和分析保存到数据库中的历史模拟结果。
    
    示例:
        ioselector analyze --list
        ioselector analyze --case epoll-lt-good
        ioselector analyze 1 --stats
    """
    storage = SQLiteStorage(ctx.obj['db_path'])
    
    # 显示统计汇总
    if stats:
        if run_id:
            # 显示单个运行的详细统计
            run = storage.get_run(run_id)
            if not run:
                console.print(f"[red]找不到运行记录 ID: {run_id}[/red]")
                sys.exit(1)
            
            events = storage.get_run_events(run_id)
            
            console.print(Panel(
                _format_run_details(run, events),
                title=f"运行记录 #{run_id}",
                expand=False
            ))
        else:
            # 显示全局统计
            stats_data = storage.get_statistics(case_name)
            
            console.print(Panel(
                f"""[bold]总运行次数:[/bold] {stats_data.get('total_runs', 0)}

[bold]平均指标:[/bold]
  平均唤醒次数: {stats_data.get('avg_wakeups', 0):.1f}
  平均无效唤醒: {stats_data.get('avg_unnecessary_wakeups', 0):.1f}
  平均 CPU 空转: {stats_data.get('avg_cpu_spins', 0):.1f}
  平均 fd 扫描: {stats_data.get('avg_fd_scans', 0):.1f}
  平均惊群事件: {stats_data.get('avg_herd_count', 0):.1f}""",
                title="统计汇总",
                expand=False
            ))
            
            # 按配置分组统计
            by_config = stats_data.get('by_config', [])
            if by_config:
                table = Table(title="按配置分组统计")
                table.add_column("选择器", style="cyan")
                table.add_column("触发模式", style="magenta")
                table.add_column("运行次数", style="green")
                table.add_column("平均唤醒", style="yellow")
                table.add_column("平均无效唤醒", style="red")
                table.add_column("平均惊群", style="blue")
                
                for cfg in by_config:
                    trigger = "LT" if cfg['trigger_mode'] == "lt" else "ET"
                    table.add_row(
                        cfg['selector_type'].upper(),
                        trigger,
                        str(cfg['run_count']),
                        f"{cfg['avg_wakeups']:.1f}",
                        f"{cfg['avg_unnecessary_wakeups']:.1f}",
                        f"{cfg['avg_herd_count']:.1f}"
                    )
                
                console.print(table)
        return
    
    # 列出运行记录
    if list_runs or not run_id:
        runs = storage.list_runs(case_name, limit)
        
        if not runs:
            console.print("[yellow]没有找到历史运行记录[/yellow]")
            return
        
        table = Table(title="历史运行记录")
        table.add_column("ID", style="cyan")
        table.add_column("用例", style="green")
        table.add_column("选择器", style="blue")
        table.add_column("触发", style="magenta")
        table.add_column("唤醒", style="yellow")
        table.add_column("无效唤醒", style="red")
        table.add_column("惊群", style="cyan")
        table.add_column("漏读", style="bold red")
        table.add_column("时间", style="white")
        
        for run in runs:
            trigger = "LT" if run['trigger_mode'] == "lt" else "ET"
            total_wakeups = run.get('total_wakeups', 0)
            unnecessary = run.get('unnecessary_wakeups', 0)
            herd_count = run.get('thundering_herd_count', 0)
            missed = run.get('missed_reads', 0)
            
            missed_style = "bold red" if missed > 0 else "green"
            
            table.add_row(
                str(run['id']),
                run['case_name'],
                run['selector_type'].upper(),
                trigger,
                str(total_wakeups),
                str(unnecessary),
                str(herd_count),
                f"[{missed_style}]{missed}[/{missed_style}]",
                run['start_time'][:19]
            )
        
        console.print(table)
        return
    
    # 显示单个运行详情
    run = storage.get_run(run_id)
    if not run:
        console.print(f"[red]找不到运行记录 ID: {run_id}[/red]")
        sys.exit(1)
    
    events = storage.get_run_events(run_id)
    
    console.print(Panel(
        _format_run_details(run, events),
        title=f"运行记录 #{run_id}",
        expand=False
    ))


@cli.command()
@click.argument("run_id", type=int, required=False)
@click.option("--case", "-c", "case_name",
              help="从配置文件运行并导出")
@click.option("--format", "-f", "fmt",
              type=click.Choice(['markdown', 'md', 'json']),
              default="markdown",
              help="输出格式 (markdown 或 json，默认: markdown)")
@click.option("--output", "-o", "output_file",
              type=click.Path(file_okay=True, dir_okay=False),
              help="输出文件路径")
@click.option("--no-events", is_flag=True,
              help="不包含事件时间线")
@click.option("--max-events", "-n", type=int, default=100,
              help="最多显示的事件数量 (默认: 100)")
@click.pass_context
def export(ctx, run_id, case_name, fmt, output_file, no_events, max_events):
    """
    导出报告
    
    将模拟结果导出为 Markdown 或 JSON 格式的报告。
    
    示例:
        ioselector export 1 -f md -o report.md
        ioselector export --case epoll-lt-good -f json
        ioselector export 1 --no-events -o summary.md
    """
    include_events = not no_events
    
    # 从配置运行并导出
    if case_name:
        parser = ConfigParser(ctx.obj['cases_dir'])
        try:
            config = parser.get_case(case_name)
            simulator = IOSimulator(config)
            result = simulator.run()
            
            # 分析
            analyzer = ResultAnalyzer()
            analysis = analyzer.analyze(result)
            
        except ConfigError as e:
            console.print(f"[red]配置错误: {e}[/red]")
            sys.exit(1)
        except Exception as e:
            console.print(f"[red]错误: {e}[/red]")
            sys.exit(1)
    
    # 从数据库读取
    elif run_id:
        storage = SQLiteStorage(ctx.obj['db_path'])
        run = storage.get_run(run_id)
        
        if not run:
            console.print(f"[red]找不到运行记录 ID: {run_id}[/red]")
            sys.exit(1)
        
        # 注意：从数据库读取时，无法获取完整的 SimulationResult 对象
        # 这里需要特殊处理
        console.print("[yellow]警告: 从数据库导出的报告可能不包含完整的分析数据[/yellow]")
        console.print("[yellow]建议使用 --case 参数从配置文件运行并导出[/yellow]")
        sys.exit(1)
    
    else:
        console.print("[red]错误: 请指定 --case 或 run_id[/red]")
        sys.exit(1)
    
    # 导出
    exporter = ReportExporter()
    
    if fmt in ['markdown', 'md']:
        content = exporter.export_markdown(
            result, analysis, include_events, max_events
        )
    else:
        content = exporter.export_json(
            result, analysis, include_events
        )
    
    # 输出
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(content)
        console.print(f"[green]✓ 报告已保存到: {output_file}[/green]")
    else:
        console.print(content)


@cli.command()
@click.option("--run-id", "-r", type=int,
              help="删除指定的运行记录")
@click.option("--all", "-a", "clear_all", is_flag=True,
              help="清空所有数据")
@click.option("--yes", "-y", is_flag=True,
              help="确认删除，不需要提示")
@click.pass_context
def clean(ctx, run_id, clear_all, yes):
    """
    清理数据库
    
    删除历史运行记录或清空所有数据。
    
    示例:
        ioselector clean --run-id 1
        ioselector clean --all --yes
    """
    storage = SQLiteStorage(ctx.obj['db_path'])
    
    if run_id:
        if not yes:
            confirm = click.confirm(f"确定要删除运行记录 #{run_id} 吗?")
            if not confirm:
                console.print("已取消")
                return
        
        if storage.delete_run(run_id):
            console.print(f"[green]✓ 已删除运行记录 #{run_id}[/green]")
        else:
            console.print(f"[red]找不到运行记录 #{run_id}[/red]")
    
    elif clear_all:
        if not yes:
            confirm = click.confirm("确定要清空所有数据吗? 这将删除所有历史记录!")
            if not confirm:
                console.print("已取消")
                return
        
        deleted = storage.clear_all()
        console.print(f"[green]✓ 已清空 {deleted} 条运行记录[/green]")
    
    else:
        console.print("[yellow]请指定 --run-id 或 --all[/yellow]")


def _format_result_summary(result):
    """格式化结果摘要"""
    lines = []
    
    # 唤醒统计
    lines.append(f"[bold]唤醒统计:[/bold]")
    lines.append(f"  总唤醒次数: {result.total_wakeups}")
    lines.append(f"  有效唤醒: {result.total_wakeups - result.unnecessary_wakeups}")
    if result.unnecessary_wakeups > 0:
        lines.append(f"  [red]无效唤醒: {result.unnecessary_wakeups}[/red]")
        ratio = (result.unnecessary_wakeups / result.total_wakeups) * 100
        lines.append(f"  [red]无效唤醒率: {ratio:.1f}%[/red]")
    lines.append("")
    
    # CPU 效率
    lines.append(f"[bold]CPU 效率:[/bold]")
    if result.cpu_spins > 0:
        lines.append(f"  [yellow]CPU 空转次数: {result.cpu_spins}[/yellow]")
    else:
        lines.append(f"  [green]CPU 空转次数: 0[/green]")
    
    if result.fd_scan_count > 0:
        lines.append(f"  [yellow]fd 扫描次数: {result.fd_scan_count}[/yellow]")
    else:
        lines.append(f"  [green]fd 扫描次数: 0[/green]")
    lines.append("")
    
    # 问题统计
    lines.append(f"[bold]问题统计:[/bold]")
    if result.missed_reads > 0:
        lines.append(f"  [bold red]漏读次数: {result.missed_reads} (严重问题!)[/bold red]")
    else:
        lines.append(f"  [green]漏读次数: 0[/green]")
    
    if result.thundering_herd_count > 0:
        lines.append(f"  [yellow]惊群事件: {result.thundering_herd_count}[/yellow]")
    else:
        lines.append(f"  [green]惊群事件: 0[/green]")
    
    return "\n".join(lines)


def _format_run_details(run, events):
    """格式化运行记录详情"""
    lines = []
    
    lines.append(f"[bold]用例:[/bold] {run['case_name']}")
    lines.append(f"[bold]选择器:[/bold] {run['selector_type'].upper()}")
    lines.append(f"[bold]触发模式:[/bold] {'LT' if run['trigger_mode'] == 'lt' else 'ET'}")
    lines.append(f"[bold]开始时间:[/bold] {run['start_time']}")
    if run['end_time']:
        lines.append(f"[bold]结束时间:[/bold] {run['end_time']}")
    lines.append("")
    
    lines.append(f"[bold]统计数据:[/bold]")
    lines.append(f"  总唤醒: {run.get('total_wakeups', 0)}")
    lines.append(f"  无效唤醒: {run.get('unnecessary_wakeups', 0)}")
    lines.append(f"  CPU 空转: {run.get('cpu_spins', 0)}")
    lines.append(f"  fd 扫描: {run.get('fd_scan_count', 0)}")
    lines.append(f"  漏读: {run.get('missed_reads', 0)}")
    lines.append(f"  惊群事件: {run.get('thundering_herd_count', 0)}")
    lines.append("")
    
    lines.append(f"[bold]事件数:[/bold] {len(events)}")
    
    if run.get('notes'):
        lines.append("")
        lines.append(f"[bold]备注:[/bold] {run['notes']}")
    
    return "\n".join(lines)


if __name__ == "__main__":
    cli()
