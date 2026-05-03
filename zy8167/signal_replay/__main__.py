import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .parser import parse_all
from .timeline import generate_all_timelines
from .rules import run_all_checks
from .exporter import export_all


console = Console()


def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                    交通信号配时重放工具                         ║
║              Traffic Signal Timing Replay Tool                ║
╚══════════════════════════════════════════════════════════════╝
"""
    console.print(banner, style="cyan")


def run_command(
    intersections_path: str,
    phase_plans_path: str,
    detector_events_path: str,
    rules_path: str,
    output_dir: str,
    analysis_date: Optional[str] = None,
):
    console.print("[bold green]开始执行信号配时分析...[/bold green]")
    
    if analysis_date:
        try:
            date = datetime.fromisoformat(analysis_date)
        except ValueError:
            console.print(f"[bold red]错误: 无效的日期格式 '{analysis_date}'，请使用 ISO 格式 (YYYY-MM-DD)[/bold red]")
            sys.exit(1)
    else:
        date = datetime.now()
    
    console.print(f"[dim]分析日期: {date.date().isoformat()}[/dim]")
    console.print()
    
    console.print("[bold]第一步: 解析输入文件...[/bold]")
    try:
        intersections, phase_plans, detector_events, rules = parse_all(
            intersections_path,
            phase_plans_path,
            detector_events_path,
            rules_path,
        )
        console.print(f"  [green]✓[/green] 已加载 {len(intersections)} 个路口")
        total_plans = sum(len(plans) for plans in phase_plans.values())
        console.print(f"  [green]✓[/green] 已加载 {total_plans} 个配时计划")
        total_events = sum(len(events) for events in detector_events.values())
        console.print(f"  [green]✓[/green] 已加载 {total_events} 条检测器事件")
    except Exception as e:
        console.print(f"[bold red]解析文件时出错: {e}[/bold red]")
        sys.exit(1)
    
    console.print()
    console.print("[bold]第二步: 生成相位时间线...[/bold]")
    try:
        timelines = generate_all_timelines(intersections, phase_plans, date)
        total_events = sum(len(tl) for tl in timelines.values())
        console.print(f"  [green]✓[/green] 已生成 {len(timelines)} 个路口的时间线")
        console.print(f"  [green]✓[/green] 总事件数: {total_events}")
    except Exception as e:
        console.print(f"[bold red]生成时间线时出错: {e}[/bold red]")
        sys.exit(1)
    
    console.print()
    console.print("[bold]第三步: 运行规则检查...[/bold]")
    try:
        issues = run_all_checks(
            intersections,
            timelines,
            phase_plans,
            detector_events,
            rules,
        )
        high_count = sum(1 for i in issues if i.severity == "high")
        medium_count = sum(1 for i in issues if i.severity == "medium")
        info_count = sum(1 for i in issues if i.severity == "info")
        
        console.print(f"  [green]✓[/green] 检测完成:")
        console.print(f"    [red]高优先级: {high_count} 个[/red]")
        console.print(f"    [yellow]中优先级: {medium_count} 个[/yellow]")
        console.print(f"    [blue]信息提示: {info_count} 个[/blue]")
    except Exception as e:
        console.print(f"[bold red]运行规则检查时出错: {e}[/bold red]")
        sys.exit(1)
    
    console.print()
    console.print("[bold]第四步: 导出分析结果...[/bold]")
    try:
        output_files = export_all(
            issues,
            intersections,
            phase_plans,
            timelines,
            rules,
            date,
            output_dir,
        )
        console.print(f"  [green]✓[/green] 问题清单: {output_files['issues_csv']}")
        console.print(f"  [green]✓[/green] 分析报告: {output_files['signal_report_md']}")
        console.print(f"  [green]✓[/green] 时间线可视化: {output_files['timeline_html']}")
    except Exception as e:
        console.print(f"[bold red]导出结果时出错: {e}[/bold red]")
        sys.exit(1)
    
    console.print()
    console.print(Panel.fit(
        "[bold green]分析完成![/bold green]\n"
        f"共检测到 [bold]{len(issues)}[/bold] 个问题\n"
        f"结果已导出到: {output_dir}",
        title="完成",
    ))


def main():
    parser = argparse.ArgumentParser(
        prog="signal_replay",
        description="交通信号配时重放和分析工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python -m signal_replay run --intersections intersections.csv \\
                               --phase-plans phase_plan.json \\
                               --detector-events detector_events.jsonl \\
                               --rules rules.yaml \\
                               --output ./output

  python -m signal_replay run -i intersections.csv -p phase_plan.json \\
                               -d detector_events.jsonl -r rules.yaml \\
                               -o ./output --date 2026-05-03
        """,
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    run_parser = subparsers.add_parser("run", help="运行信号配时分析")
    run_parser.add_argument(
        "-i", "--intersections",
        required=True,
        help="路口信息 CSV 文件路径",
        metavar="FILE",
    )
    run_parser.add_argument(
        "-p", "--phase-plans",
        required=True,
        help="相位配时计划 JSON 文件路径",
        metavar="FILE",
    )
    run_parser.add_argument(
        "-d", "--detector-events",
        required=True,
        help="检测器事件 JSONL 文件路径",
        metavar="FILE",
    )
    run_parser.add_argument(
        "-r", "--rules",
        required=True,
        help="规则配置 YAML 文件路径",
        metavar="FILE",
    )
    run_parser.add_argument(
        "-o", "--output",
        required=True,
        help="输出目录路径",
        metavar="DIR",
    )
    run_parser.add_argument(
        "--date",
        help="分析日期 (ISO 格式: YYYY-MM-DD)，默认为今天",
        metavar="DATE",
    )
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(0)
    
    if args.command == "run":
        print_banner()
        run_command(
            intersections_path=args.intersections,
            phase_plans_path=args.phase_plans,
            detector_events_path=args.detector_events,
            rules_path=args.rules,
            output_dir=args.output,
            analysis_date=args.date,
        )


if __name__ == "__main__":
    main()
