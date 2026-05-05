"""
播客质量检查工具 - 命令行入口
"""

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from podcast_checker.config import Config
from podcast_checker.scanner import FileScanner
from podcast_checker.checker import RuleChecker
from podcast_checker.history import HistoryManager
from podcast_checker.reporter import ReportGenerator
from podcast_checker.models import CheckResult, IssueSeverity

console = Console()


def load_config(config_path: Optional[str] = None) -> Config:
    """加载配置文件"""
    try:
        return Config(config_path)
    except FileNotFoundError as e:
        console.print(f"[red]错误: {e}[/red]")
        console.print("[yellow]提示: 请在当前目录创建 config.yaml 配置文件[/yellow]")
        sys.exit(1)


def format_duration(seconds: float) -> str:
    """格式化时长显示"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours}时{minutes}分{secs}秒"
    else:
        return f"{minutes}分{secs}秒"


def display_check_result(result: CheckResult, detailed: bool = False) -> None:
    """显示检查结果"""
    status_color = "green" if result.passed else "red"
    status_icon = "✅" if result.passed else "❌"
    
    console.print(Panel.fit(
        f"[bold]EP{result.episode_number} 检查结果[/bold]\n"
        f"状态: [{status_color}]{status_icon} {'通过' if result.passed else '存在问题'}[/{status_color}]\n"
        f"错误: {result.error_count} | 警告: {result.warning_count}\n"
        f"检查时间: {result.check_time.strftime('%Y-%m-%d %H:%M:%S')}",
        title="检查结果"
    ))
    
    if result.files.audio_duration:
        audio_info = (
            f"音频时长: {format_duration(result.files.audio_duration)}"
        )
        if result.files.audio_bitrate:
            audio_info += f" | 比特率: {result.files.audio_bitrate} kbps"
        console.print(f"[cyan]{audio_info}[/cyan]")
        console.print()
    
    if result.issues:
        errors = [i for i in result.issues if i.severity == IssueSeverity.ERROR]
        warnings = [i for i in result.issues if i.severity == IssueSeverity.WARNING]
        infos = [i for i in result.issues if i.severity == IssueSeverity.INFO]
        
        if errors:
            console.print("[bold red]❌ 错误（必须修复）:[/bold red]")
            for issue in errors:
                console.print(f"  - {issue.message}")
                if issue.file_path:
                    console.print(f"    文件: {issue.file_path}")
                if detailed and issue.suggestion:
                    console.print(f"    [yellow]💡 建议: {issue.suggestion}[/yellow]")
            console.print()
        
        if warnings:
            console.print("[bold yellow]⚠️ 警告（建议修复）:[/bold yellow]")
            for issue in warnings:
                console.print(f"  - {issue.message}")
                if issue.file_path:
                    console.print(f"    文件: {issue.file_path}")
                if detailed and issue.suggestion:
                    console.print(f"    [cyan]💡 建议: {issue.suggestion}[/cyan]")
            console.print()
        
        if infos and detailed:
            console.print("[bold blue]ℹ️ 提示:[/bold blue]")
            for issue in infos:
                console.print(f"  - {issue.message}")
                if issue.suggestion:
                    console.print(f"    💡 建议: {issue.suggestion}")
            console.print()
    else:
        console.print("[green]🎉 太棒了！没有发现任何问题。[/green]")
        console.print()


@click.group()
@click.version_option(version="1.0.0")
@click.option('--config', '-c', type=click.Path(exists=True), help='配置文件路径')
@click.pass_context
def cli(ctx, config):
    """播客质量检查工具 - 用于检查播客节目文件的完整性和合规性"""
    ctx.ensure_object(dict)
    ctx.obj['config_path'] = config


@cli.command()
@click.argument('folder', type=click.Path(exists=True), default='.')
@click.option('--episode', '-e', help='指定要检查的期数（如：001），不指定则检查所有')
@click.option('--detailed', '-d', is_flag=True, help='显示详细信息和建议')
@click.option('--save', '-s', is_flag=True, help='保存检查结果到历史记录')
@click.option('--report', '-r', is_flag=True, help='生成Markdown报告')
@click.pass_context
def check(ctx, folder, episode, detailed, save, report):
    """检查节目文件夹中的文件
    
    FOLDER: 节目文件夹路径，默认为当前目录
    """
    config = load_config(ctx.obj.get('config_path'))
    scanner = FileScanner(config)
    checker = RuleChecker(config)
    history_manager = HistoryManager(config) if save else None
    reporter = ReportGenerator(config) if report else None
    
    console.print(Panel.fit(
        "[bold]播客质量检查工具[/bold]\n"
        f"扫描目录: {folder}",
        title="开始检查"
    ))
    console.print()
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        scan_task = progress.add_task("扫描文件...", total=None)
        episodes = scanner.scan_folder(folder)
        progress.remove_task(scan_task)
    
    if not episodes:
        console.print("[yellow]未在目录中识别到任何节目文件。[/yellow]")
        console.print("[yellow]请确保文件名符合配置中定义的命名规则（如：EP001_xxx.mp3）。[/yellow]")
        return
    
    if episode:
        episodes = [e for e in episodes if e.episode_number == episode]
        if not episodes:
            console.print(f"[red]未找到指定期数: EP{episode}[/red]")
            return
    
    console.print(f"[cyan]识别到 {len(episodes)} 期节目[/cyan]")
    console.print()
    
    results: List[CheckResult] = []
    for episode_files in episodes:
        console.print(f"[bold]正在检查 EP{episode_files.episode_number}...[/bold]")
        
        result = checker.check(episode_files)
        results.append(result)
        
        display_check_result(result, detailed)
        
        if save and history_manager:
            history_manager.save_check_result(result)
            console.print(f"[green]✓ 检查结果已保存到历史记录[/green]")
            console.print()
    
    if report and reporter:
        if len(results) == 1:
            report_file = reporter.generate_report(results[0])
        else:
            report_file = reporter.generate_batch_report(results)
        console.print(f"[green]✓ 报告已生成: {report_file}[/green]")
    
    if len(results) > 1:
        total_errors = sum(r.error_count for r in results)
        total_warnings = sum(r.warning_count for r in results)
        passed = sum(1 for r in results if r.passed)
        
        console.print(Panel.fit(
            f"[bold]批量检查汇总[/bold]\n"
            f"检查期数: {len(results)} | 通过: {passed} | 未通过: {len(results) - passed}\n"
            f"总错误: {total_errors} | 总警告: {total_warnings}",
            title="检查完成"
        ))


@cli.command('history')
@click.option('--episode', '-e', help='查看指定期数的历史记录')
@click.option('--list', '-l', 'list_all', is_flag=True, help='列出所有有期数的历史记录')
@click.option('--recheck', '-r', help='重新检查指定期数的最新历史记录')
@click.pass_context
def show_history(ctx, episode, list_all, recheck):
    """查看检查历史记录"""
    config = load_config(ctx.obj.get('config_path'))
    history_manager = HistoryManager(config)
    
    if list_all:
        episodes = history_manager.list_all_episodes()
        if not episodes:
            console.print("[yellow]暂无任何检查历史记录。[/yellow]")
            return
        
        console.print("[bold]有检查历史的期数:[/bold]")
        for ep in episodes:
            histories = history_manager.get_episode_history(ep)
            if histories:
                latest = histories[0]
                status = "✅" if latest.passed else "❌"
                console.print(
                    f"  EP{ep}: {status} 检查 {len(histories)} 次, "
                    f"最新: {latest.check_time.strftime('%Y-%m-%d %H:%M')}, "
                    f"错误: {latest.error_count}, 警告: {latest.warning_count}"
                )
        return
    
    if recheck:
        result = history_manager.load_check_result(recheck)
        if not result:
            console.print(f"[red]未找到 EP{recheck} 的检查历史记录。[/red]")
            return
        
        console.print(f"[bold]重新检查 EP{recheck} 的最新记录...[/bold]")
        console.print()
        display_check_result(result, detailed=True)
        return
    
    if episode:
        histories = history_manager.get_episode_history(episode)
        if not histories:
            console.print(f"[yellow]EP{episode} 暂无检查历史记录。[/yellow]")
            return
        
        console.print(f"[bold]EP{episode} 的检查历史 (共 {len(histories)} 次):[/bold]")
        console.print()
        
        for i, history in enumerate(histories, 1):
            status = "✅ 通过" if history.passed else "❌ 未通过"
            console.print(f"[bold]第 {i} 次检查:[/bold] {status}")
            console.print(f"  时间: {history.check_time.strftime('%Y-%m-%d %H:%M:%S')}")
            console.print(f"  错误: {history.error_count} | 警告: {history.warning_count}")
            if history.issues_summary:
                console.print(f"  问题摘要:")
                for summary in history.issues_summary[:5]:
                    console.print(f"    - {summary}")
            console.print()
        return
    
    console.print("[yellow]请使用 --list 查看所有期数，或使用 --episode <期数> 查看指定期数的历史。[/yellow]")


@cli.command('report')
@click.argument('episode')
@click.option('--output', '-o', help='输出文件路径')
@click.pass_context
def generate_report(ctx, episode, output):
    """从历史记录生成Markdown报告
    
    EPISODE: 期数编号（如：001）
    """
    config = load_config(ctx.obj.get('config_path'))
    history_manager = HistoryManager(config)
    reporter = ReportGenerator(config)
    
    result = history_manager.load_check_result(episode)
    if not result:
        console.print(f"[red]未找到 EP{episode} 的检查历史记录。[/red]")
        return
    
    report_file = reporter.generate_report(result, output)
    console.print(f"[green]✓ 报告已生成: {report_file}[/green]")


@cli.command('config')
@click.option('--show', '-s', is_flag=True, help='显示当前配置')
@click.option('--init', '-i', is_flag=True, help='在当前目录初始化配置文件模板')
@click.pass_context
def manage_config(ctx, show, init):
    """管理配置文件"""
    if init:
        template_path = Path(__file__).parent / 'config.yaml'
        target_path = Path.cwd() / 'config.yaml'
        
        if target_path.exists():
            console.print(f"[yellow]配置文件已存在: {target_path}[/yellow]")
            return
        
        if template_path.exists():
            import shutil
            shutil.copy(template_path, target_path)
            console.print(f"[green]✓ 配置文件已创建: {target_path}[/green]")
            console.print("[cyan]请根据实际需求编辑配置文件。[/cyan]")
        else:
            console.print("[red]未找到配置模板文件。[/red]")
        return
    
    if show:
        config = load_config(ctx.obj.get('config_path'))
        
        table = Table(title="当前配置")
        table.add_column("配置项", style="cyan")
        table.add_column("值", style="green")
        
        show_info = config.show
        table.add_row("节目名称", show_info.get('name', '未设置'))
        table.add_row("主播", show_info.get('author', '未设置'))
        
        audio_config = config.audio_config
        table.add_row("音频最小时长", f"{audio_config.get('min_duration', 300)} 秒")
        table.add_row("音频最大时长", f"{audio_config.get('max_duration', 7200)} 秒")
        table.add_row("目标比特率", f"{audio_config.get('target_bitrate', 128)} kbps")
        
        subtitles_config = config.subtitles_config
        table.add_row("字幕时间轴偏差", f"{subtitles_config.get('max_timing_deviation', 5)} 秒")
        
        history_config = config.history_config
        table.add_row("历史记录路径", history_config.get('storage_path', './check_history'))
        table.add_row("报告输出路径", config.report_config.get('output_path', './reports'))
        
        console.print(table)
        return
    
    console.print("[yellow]请使用 --show 显示配置，或使用 --init 初始化配置文件。[/yellow]")


if __name__ == '__main__':
    cli()
