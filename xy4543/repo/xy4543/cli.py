#!/usr/bin/env python3
"""
剧场音频检查工具 - 命令行入口
用于每日检查开场铃、巡演提示音、疏散广播和扬声器分区
"""

import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

# 将项目目录添加到路径
project_dir = Path(__file__).parent
sys.path.insert(0, str(project_dir))

from theater_audio_checker import TheaterAudioChecker, __version__
from theater_audio_checker.models import CheckSeverity, CheckStatus

console = Console()


@click.group()
@click.version_option(__version__, '-v', '--version')
def cli():
    """剧场音频检查工具 - 用于每日检查音频系统配置"""
    pass


@cli.command()
@click.option('--audio', '-a', 'audio_path', type=click.Path(exists=True),
              help='音频清单JSON文件路径')
@click.option('--schedule', '-s', 'schedule_path', type=click.Path(exists=True),
              help='分区播放计划JSON文件路径')
@click.option('--device', '-d', 'device_path', type=click.Path(exists=True),
              help='设备在线日志JSON文件路径')
@click.option('--notes', '-n', 'notes_path', type=click.Path(exists=True),
              help='人工备注JSON文件路径')
@click.option('--output', '-o', 'output_dir', type=click.Path(), default='./output',
              help='输出目录 (默认: ./output)')
@click.option('--date', '-t', 'target_date', type=str,
              help='目标检查日期 (YYYY-MM-DD, 默认: 今天)')
@click.option('--no-report', is_flag=True, default=False,
              help='不生成报告文件，仅显示检查结果')
def check(audio_path: Optional[str], schedule_path: Optional[str], 
          device_path: Optional[str], notes_path: Optional[str],
          output_dir: str, target_date: Optional[str], no_report: bool):
    """执行完整检查流程"""
    
    console.print(Panel.fit(
        "[bold cyan]剧场音频检查工具[/bold cyan]\n"
        f"版本: {__version__}",
        border_style="cyan"
    ))
    
    checker = TheaterAudioChecker()
    
    try:
        with console.status("[bold green]正在加载数据..."):
            checker.load_data(
                audio_path=audio_path,
                schedule_path=schedule_path,
                device_path=device_path,
                notes_path=notes_path
            )
        console.print("[green]✓[/green] 数据加载完成")
        
        with console.status("[bold green]正在执行检查..."):
            check_result = checker.run_checks(target_date=target_date)
        console.print("[green]✓[/green] 检查完成\n")
        
        _display_check_summary(check_result)
        
        if check_result.issues:
            console.print("\n[bold yellow]📋 发现的问题:[/bold yellow]")
            _display_issues(check_result.issues)
        
        if not no_report:
            with console.status("[bold green]正在生成报告..."):
                result = checker.run_full_check(
                    audio_path=audio_path,
                    schedule_path=schedule_path,
                    device_path=device_path,
                    notes_path=notes_path,
                    output_dir=output_dir,
                    target_date=target_date
                )
            console.print("\n[green]✓[/green] 报告已生成:")
            console.print(f"  - Markdown交班单: {result['markdown_path']}")
            console.print(f"  - JSON明细: {result['json_path']}")
        
        if check_result.is_all_clear:
            console.print("\n[bold green]✅ 所有检查通过！[/bold green]")
            sys.exit(0)
        else:
            console.print(f"\n[bold red]❌ 发现 {check_result.fail_count} 个严重问题需要处理[/bold red]")
            sys.exit(1)
            
    except Exception as e:
        console.print(f"\n[bold red]错误:[/bold red] {e}")
        sys.exit(2)


@cli.command()
@click.option('--type', '-t', 'item_type', type=str, required=True,
              help='项目类型: audio, schedule, device, issue')
@click.option('--id', '-i', 'item_id', type=str, required=True,
              help='关联项目ID')
@click.option('--reviewer', '-r', type=str, required=True,
              help='复核人姓名')
@click.option('--status', '-s', type=click.Choice(['pass', 'fail', 'manual_review']),
              required=True, help='复核状态')
@click.option('--comment', '-c', type=str, required=True,
              help='复核意见')
@click.option('--save', '-o', 'save_path', type=click.Path(),
              help='保存到指定文件')
def add_note(item_type: str, item_id: str, reviewer: str, 
             status: str, comment: str, save_path: Optional[str]):
    """添加复核备注"""
    
    checker = TheaterAudioChecker()
    note = checker.add_review_note(
        item_type=item_type,
        item_id=item_id,
        reviewer=reviewer,
        status=status,
        comment=comment,
        save_path=save_path
    )
    
    console.print(Panel.fit(
        "[bold green]✓ 复核备注已添加[/bold green]\n\n"
        f"备注ID: {note.note_id}\n"
        f"项目类型: {item_type}\n"
        f"项目ID: {item_id}\n"
        f"复核人: {reviewer}\n"
        f"状态: {status}\n"
        f"意见: {comment}",
        border_style="green"
    ))
    
    if save_path:
        console.print(f"\n已保存到: {save_path}")


@cli.command()
@click.option('--output', '-o', 'output_dir', type=click.Path(), default='./output',
              help='输出目录')
@click.option('--date', '-t', 'target_date', type=str,
              help='目标日期')
@click.argument('data_dir', type=click.Path(exists=True))
def auto(data_dir: str, output_dir: str, target_date: Optional[str]):
    """
    自动检查模式 - 从指定目录自动查找数据文件
    
    数据目录中应包含:
    - audio_manifest.json 或 audio*.json
    - zone_schedule.json 或 schedule*.json
    - device_log.json 或 device*.json
    - review_notes.json 或 notes*.json (可选)
    """
    
    data_path = Path(data_dir)
    
    audio_path = None
    schedule_path = None
    device_path = None
    notes_path = None
    
    for f in data_path.glob("*.json"):
        fname = f.name.lower()
        if "audio" in fname or "manifest" in fname:
            if audio_path is None or "audio_manifest" in fname:
                audio_path = str(f)
        elif "schedule" in fname or "zone" in fname:
            if schedule_path is None:
                schedule_path = str(f)
        elif "device" in fname or "log" in fname:
            if device_path is None:
                device_path = str(f)
        elif "note" in fname or "review" in fname:
            if notes_path is None:
                notes_path = str(f)
    
    console.print(Panel.fit(
        "[bold cyan]自动检查模式[/bold cyan]",
        border_style="cyan"
    ))
    
    console.print("\n检测到的数据文件:")
    if audio_path:
        console.print(f"  [green]✓[/green] 音频清单: {Path(audio_path).name}")
    if schedule_path:
        console.print(f"  [green]✓[/green] 播放计划: {Path(schedule_path).name}")
    if device_path:
        console.print(f"  [green]✓[/green] 设备日志: {Path(device_path).name}")
    if notes_path:
        console.print(f"  [green]✓[/green] 复核备注: {Path(notes_path).name}")
    
    console.print("")
    
    checker = TheaterAudioChecker()
    
    try:
        result = checker.run_full_check(
            audio_path=audio_path,
            schedule_path=schedule_path,
            device_path=device_path,
            notes_path=notes_path,
            output_dir=output_dir,
            target_date=target_date
        )
        
        check_result = result['check_result']
        _display_check_summary(check_result)
        
        if check_result.issues:
            console.print("\n[bold yellow]📋 发现的问题:[/bold yellow]")
            _display_issues(check_result.issues)
        
        console.print("\n[bold green]✅ 自动检查完成[/bold green]")
        console.print(f"报告输出目录: {result['output_dir']}")
        
        if check_result.is_all_clear:
            sys.exit(0)
        else:
            console.print(f"\n[bold red]❌ 发现 {check_result.fail_count} 个严重问题需要处理[/bold red]")
            sys.exit(1)
        
    except Exception as e:
        console.print(f"\n[bold red]错误:[/bold red] {e}")
        sys.exit(2)


def _display_check_summary(check_result):
    """显示检查摘要"""
    table = Table(title="检查汇总", show_header=True, header_style="bold magenta")
    table.add_column("统计项", style="cyan")
    table.add_column("数量", justify="right")
    table.add_column("状态", justify="center")
    
    status_ok = "[green]✓[/green]"
    status_fail = "[red]✗[/red]"
    
    table.add_row("总音频项目", str(check_result.total_audio_items), "")
    table.add_row("总播放计划", str(check_result.total_schedules), "")
    table.add_row("总设备数", str(check_result.total_devices), "")
    table.add_row("━" * 20, "━" * 10, "━" * 8)
    table.add_row("通过检查", str(check_result.pass_count), status_ok)
    table.add_row("严重错误", str(check_result.fail_count), 
                  status_fail if check_result.fail_count > 0 else status_ok)
    table.add_row("警告", str(check_result.warning_count),
                  "[yellow]![/yellow]" if check_result.warning_count > 0 else status_ok)
    
    console.print(table)


def _display_issues(issues):
    """显示问题列表"""
    from collections import defaultdict
    
    issues_by_severity = defaultdict(list)
    for issue in issues:
        issues_by_severity[issue.severity].append(issue)
    
    severity_order = [CheckSeverity.CRITICAL, CheckSeverity.WARNING, CheckSeverity.INFO]
    severity_names = {
        CheckSeverity.CRITICAL: ("🔴", "严重错误", "bold red"),
        CheckSeverity.WARNING: ("🟡", "警告", "bold yellow"),
        CheckSeverity.INFO: ("🔵", "信息", "bold blue")
    }
    
    for severity in severity_order:
        if severity in issues_by_severity:
            sev_issues = issues_by_severity[severity]
            icon, name, style = severity_names[severity]
            
            table = Table(title=f"{icon} {name} ({len(sev_issues)})", 
                         show_header=True, header_style=style)
            table.add_column("#", style="dim", width=3)
            table.add_column("检查类型", style="cyan")
            table.add_column("问题描述")
            table.add_column("受影响项目", style="magenta")
            
            for idx, issue in enumerate(sev_issues, 1):
                check_name = {
                    "loudness_check": "响度",
                    "time_conflict_check": "时段冲突",
                    "emergency_broadcast_check": "应急广播",
                    "missing_file_check": "文件缺失",
                    "duplicate_file_check": "重复文件",
                    "device_status_check": "设备状态",
                    "audio_reference_check": "音频引用"
                }.get(issue.check_type, issue.check_type)
                
                affected = issue.affected_item_name or issue.affected_item or "-"
                table.add_row(str(idx), check_name, issue.message, affected)
            
            console.print(table)


if __name__ == '__main__':
    cli()
