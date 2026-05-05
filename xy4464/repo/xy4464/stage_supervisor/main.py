import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .database import DatabaseManager
from .parsers import ProjectParser
from .scanner import IssueScanner
from .exporters import ExporterFactory
from .models import IssueSeverity, IssueType


console = Console()


def get_db() -> DatabaseManager:
    db_path = os.environ.get('STAGE_SUPERVISOR_DB', None)
    return DatabaseManager(db_path)


def format_severity(severity: str) -> Text:
    colors = {
        'critical': 'bright_red',
        'high': 'bright_yellow',
        'medium': 'yellow',
        'low': 'green'
    }
    icons = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'low': '🟢'
    }
    color = colors.get(severity, 'white')
    icon = icons.get(severity, '⚪')
    return Text(f"{icon} {severity.upper()}", style=color)


def format_issue_type(issue_type: str) -> str:
    texts = {
        'cue_missing': 'Cue编号缺失',
        'light_scene_not_found': '灯光场景不存在',
        'audio_file_broken': '音频文件断链',
        'actor_change_time_insufficient': '演员换场时间不足'
    }
    return texts.get(issue_type, issue_type)


@click.group()
@click.version_option(version='1.0.0')
def main():
    """舞台监督自动化工具 - 用于检查演出前的各种问题"""
    pass


@main.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--min-change-time', '-t', type=int, default=120,
              help='演员最小换场时间（秒），默认120秒')
@click.option('--no-save', is_flag=True, help='不保存到数据库')
def scan(directory, min_change_time, no_save):
    """扫描项目目录，检测潜在问题

    DIRECTORY: 项目目录路径，应包含以下文件：
    - cue_list.csv: 导演 Cue 单
    - lighting_scenes.json: 灯光台导出数据
    - audio_files.csv: 音频文件清单
    - actor_schedule.csv: 演员上下场表
    """
    console.print(Panel.fit(
        "[bold blue]舞台监督自动化工具[/bold blue]\n"
        f"扫描目录: {directory}",
        title="开始扫描"
    ))

    valid, errors, found_files = ProjectParser.scan_directory(directory)

    if not valid:
        for error in errors:
            console.print(f"[red]✗ {error}[/red]")
        console.print("\n请确保项目目录包含以下必要文件：")
        for filename in ProjectParser.REQUIRED_FILES:
            status = "✓" if filename in found_files else "✗"
            color = "green" if filename in found_files else "red"
            console.print(f"[{color}]{status}[/{color}] {filename}")
        sys.exit(1)

    console.print("[green]✓ 所有必要文件已找到[/green]")

    console.print("\n[yellow]正在解析项目数据...[/yellow]")
    project = ProjectParser.parse_project(directory)

    console.print(f"  解析到 {len(project.cues)} 个 Cue")
    console.print(f"  解析到 {len(project.light_scenes)} 个灯光场景")
    console.print(f"  解析到 {len(project.audio_files)} 个音频文件")
    console.print(f"  解析到 {len(project.actor_schedules)} 条演员场次")

    console.print(f"\n[yellow]正在扫描问题（最小换场时间: {min_change_time}秒）...[/yellow]")
    scanner = IssueScanner(min_actor_change_seconds=min_change_time)
    scanner.scan_and_update_project(project)

    summary = scanner.get_scan_summary(project)

    total = summary['total_issues']
    unresolved = summary['unresolved']
    critical = summary['by_severity'].get('critical', 0)
    high = summary['by_severity'].get('high', 0)

    console.print(f"\n[bold]扫描完成![/bold]")

    if total == 0:
        console.print("[green]✓ 未发现任何问题[/green]")
    else:
        table = Table(title="问题统计")
        table.add_column("类型", style="cyan")
        table.add_column("数量", justify="right", style="magenta")

        table.add_row("总问题数", str(total))
        table.add_row("未解决", str(unresolved))
        table.add_row("🔴 严重", str(critical))
        table.add_row("🟠 高", str(high))

        console.print(table)

        if project.issues:
            console.print("\n[bold]问题详情:[/bold]")

            issues_table = Table(show_header=True, header_style="bold magenta")
            issues_table.add_column("ID", style="dim", width=12)
            issues_table.add_column("严重程度", width=15)
            issues_table.add_column("类型", width=20)
            issues_table.add_column("标题", width=50)

            for issue in project.issues:
                severity_text = format_severity(issue.severity.value)
                issues_table.add_row(
                    issue.issue_id,
                    severity_text,
                    format_issue_type(issue.issue_type.value),
                    issue.title[:47] + "..." if len(issue.title) > 50 else issue.title
                )

            console.print(issues_table)

    if not no_save:
        db = get_db()
        if db.save_project(project):
            console.print(f"\n[green]✓ 项目数据已保存到数据库[/green]")
            console.print(f"  项目ID: {project.project_id}")
        else:
            console.print(f"\n[red]✗ 保存到数据库失败[/red]")


@main.command(name='list')
@click.option('--all', '-a', is_flag=True, help='显示所有项目（包括已删除的）')
def list_projects(all):
    """列出所有已扫描的项目"""
    db = get_db()
    projects = db.list_projects()

    if not projects:
        console.print("[yellow]尚未保存任何项目[/yellow]")
        console.print("使用 'stage-supervisor scan <directory>' 命令扫描项目")
        return

    table = Table(title="已保存的项目")
    table.add_column("项目ID", style="cyan")
    table.add_column("名称", style="magenta")
    table.add_column("路径", style="dim")
    table.add_column("创建时间", style="green")
    table.add_column("最后扫描", style="yellow")

    for proj in projects:
        table.add_row(
            proj['project_id'],
            proj['name'],
            proj['path'],
            proj['created_at'] or '-',
            proj['last_scan_at'] or '-'
        )

    console.print(table)


@main.command()
@click.argument('project_id', required=False)
@click.option('--resolved', '-r', is_flag=True, help='只显示已解决的问题')
@click.option('--unresolved', '-u', is_flag=True, help='只显示未解决的问题')
@click.option('--severity', '-s', type=click.Choice(['critical', 'high', 'medium', 'low']),
              help='按严重程度过滤')
def query(project_id, resolved, unresolved, severity):
    """查询问题

    如果不指定 PROJECT_ID，将显示所有项目的问题
    """
    db = get_db()

    filter_resolved = None
    if resolved:
        filter_resolved = True
    elif unresolved:
        filter_resolved = False

    issues = db.get_all_issues(
        project_id=project_id,
        resolved=filter_resolved
    )

    if severity:
        issues = [i for i in issues if i['severity'] == severity]

    if not issues:
        console.print("[yellow]未找到符合条件的问题[/yellow]")
        return

    console.print(f"[bold]找到 {len(issues)} 个问题[/bold]\n")

    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("ID", style="dim")
    table.add_column("严重程度")
    table.add_column("类型")
    table.add_column("标题")
    table.add_column("状态")
    table.add_column("创建时间")

    for issue in issues:
        severity_text = format_severity(issue['severity'])
        status = "[green]已解决[/green]" if issue['resolved'] else "[red]未解决[/red]"

        table.add_row(
            issue['issue_id'],
            severity_text,
            format_issue_type(issue['issue_type']),
            issue['title'][:40] + "..." if len(issue['title']) > 43 else issue['title'],
            status,
            issue['created_at'] or '-'
        )

    console.print(table)


@main.command()
@click.argument('issue_id')
@click.argument('note_text')
def note(issue_id, note_text):
    """为问题添加备注

    ISSUE_ID: 问题编号
    NOTE_TEXT: 备注内容
    """
    db = get_db()

    if db.update_issue_note(issue_id, note_text):
        console.print(f"[green]✓ 备注已添加到问题 {issue_id}[/green]")
    else:
        console.print(f"[red]✗ 未找到问题 {issue_id} 或添加备注失败[/red]")


@main.command()
@click.argument('issue_id')
def resolve(issue_id):
    """标记问题为已解决

    ISSUE_ID: 问题编号
    """
    db = get_db()

    if db.resolve_issue(issue_id):
        console.print(f"[green]✓ 问题 {issue_id} 已标记为已解决[/green]")
    else:
        console.print(f"[red]✗ 未找到问题 {issue_id}[/red]")


@main.command()
@click.argument('format_type', type=click.Choice(['markdown', 'json', 'md']))
@click.argument('output_path', type=click.Path(writable=True))
@click.option('--project-id', '-p', help='指定要导出的项目ID')
@click.option('--minimal', '-m', is_flag=True, help='仅导出问题数据（JSON格式专用）')
def export(format_type, output_path, project_id, minimal):
    """导出项目数据

    FORMAT_TYPE: 导出格式 (markdown/md 或 json)
    OUTPUT_PATH: 输出文件路径
    """
    db = get_db()

    project = None
    if project_id:
        project = db.load_project(project_id)
        if not project:
            console.print(f"[red]✗ 未找到项目: {project_id}[/red]")
            sys.exit(1)
    else:
        projects = db.list_projects()
        if not projects:
            console.print("[red]✗ 没有已保存的项目可导出[/red]")
            sys.exit(1)

        latest_project_id = projects[0]['project_id']
        project = db.load_project(latest_project_id)
        console.print(f"[yellow]未指定项目ID，使用最新项目: {latest_project_id}[/yellow]")

    if not project:
        console.print("[red]✗ 加载项目失败[/red]")
        sys.exit(1)

    console.print(f"[bold]导出项目: {project.name}[/bold]")
    console.print(f"  格式: {format_type.upper()}")
    console.print(f"  输出: {output_path}")

    try:
        if format_type == 'json' and minimal:
            from .exporters import JSONExporter
            exporter = JSONExporter(include_all_data=False)
            success = exporter.export(project, output_path)
        else:
            success = ExporterFactory.export_project(project, format_type, output_path)

        if success:
            console.print(f"[green]✓ 导出成功[/green]")
        else:
            console.print(f"[red]✗ 导出失败[/red]")
            sys.exit(1)
    except Exception as e:
        console.print(f"[red]✗ 导出出错: {e}[/red]")
        sys.exit(1)


@main.command()
@click.argument('issue_id')
def show(issue_id):
    """显示问题的详细信息

    ISSUE_ID: 问题编号
    """
    db = get_db()
    issues = db.get_all_issues()

    issue = next((i for i in issues if i['issue_id'] == issue_id), None)

    if not issue:
        console.print(f"[red]✗ 未找到问题: {issue_id}[/red]")
        return

    console.print(Panel.fit(
        f"[bold]{issue['title']}[/bold]",
        title=f"问题详情: {issue_id}"
    ))

    table = Table(show_header=False, box=None)
    table.add_column("属性", style="cyan")
    table.add_column("值")

    table.add_row("类型", format_issue_type(issue['issue_type']))
    table.add_row("严重程度", format_severity(issue['severity']))
    table.add_row("状态", "[green]已解决[/green]" if issue['resolved'] else "[red]未解决[/red]")
    table.add_row("创建时间", issue['created_at'] or '-')

    if issue['related_cue_id']:
        table.add_row("关联 Cue", issue['related_cue_id'])
    if issue['related_actor']:
        table.add_row("关联演员", issue['related_actor'])
    if issue['related_file']:
        table.add_row("关联文件", issue['related_file'])
    if issue['time_code'] and issue['time_code'] != 'N/A':
        table.add_row("时间码", issue['time_code'])

    console.print(table)

    console.print(f"\n[bold]描述:[/bold]")
    console.print(Panel(issue['description'], box=None))

    if issue['notes']:
        console.print(f"\n[bold]备注:[/bold]")
        for i, note_text in enumerate(issue['notes'], 1):
            console.print(f"  {i}. {note_text}")


if __name__ == '__main__':
    main()
