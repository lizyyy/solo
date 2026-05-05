import click
from pathlib import Path
from datetime import date, datetime
from typing import Optional
import json

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from ..storage.project_storage import ProjectStorage, ProjectData
from ..importers import (
    ShotListImporter, WardrobeImporter, ActorImporter,
    CallSheetImporter, ReshootImporter
)
from ..checkers import CheckEngine
from ..query import QueryEngine
from ..exporters import MarkdownExporter, JsonExporter
from ..models.override import OverrideNote, OverrideType, OverrideStatus
from ..models.check_result import IssueType, IssueSeverity, IssueStatus


console = Console()


@click.group()
@click.option('--project', '-p', type=click.Path(exists=False, file_okay=False), 
              default='.', help='项目目录路径')
@click.pass_context
def main(ctx, project):
    """剧组场记连戏检查工具 - 管理镜头、服装道具、演员、通告单和补拍需求"""
    ctx.ensure_object(dict)
    project_path = Path(project).resolve()
    ctx.obj['project_path'] = project_path
    ctx.obj['storage'] = ProjectStorage(project_path)


@main.command()
@click.option('--name', '-n', default='', help='项目名称')
@click.pass_context
def init(ctx, name):
    """初始化新项目"""
    storage = ctx.obj['storage']
    project_path = ctx.obj['project_path']
    
    data = storage.load_project()
    if name:
        data.project_name = name
    
    storage.save_project(data)
    
    console.print(Panel.fit(
        f"[green]项目初始化成功！[/green]\n"
        f"项目目录: {project_path}\n"
        f"项目名称: {name or '未命名'}",
        title="连戏检查工具"
    ))


@main.group()
def import_data():
    """导入各种数据文件"""
    pass


@import_data.command('shots')
@click.argument('file', type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_shots(ctx, file):
    """导入镜头清单 CSV/JSON 文件"""
    storage = ctx.obj['storage']
    file_path = Path(file)
    
    data = storage.load_project()
    
    importer = ShotListImporter()
    importer.set_existing_shots({s.shot_id: s for s in data.shot_list.shots})
    
    result = importer.import_from_file(file_path)
    
    if result.success and result.data:
        for shot in result.data.shots:
            existing = data.shot_list.get_by_shot_id(shot.shot_id)
            if existing:
                idx = data.shot_list.shots.index(existing)
                data.shot_list.shots[idx] = shot
            else:
                data.shot_list.shots.append(shot)
        
        storage.save_project(data)
        
        console.print(f"[green]成功导入 {len(result.data.shots)} 个镜头[/green]")
        if result.warnings:
            for warning in result.warnings:
                console.print(f"[yellow]警告: {warning}[/yellow]")
    else:
        for error in result.errors:
            console.print(f"[red]错误: {error}[/red]")


@import_data.command('wardrobe')
@click.argument('file', type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_wardrobe(ctx, file):
    """导入服装道具标注 JSON 文件"""
    storage = ctx.obj['storage']
    file_path = Path(file)
    
    data = storage.load_project()
    
    importer = WardrobeImporter()
    importer.set_existing_data(
        wardrobe=data.wardrobe_items,
        props=data.prop_items,
        annotations=data.wardrobe_annotations
    )
    
    result = importer.import_from_file(file_path)
    
    if result.success and result.data:
        wardrobe_list, props_list, annotations_list = result.data
        
        for item in wardrobe_list:
            data.wardrobe_items[item.item_id] = item
        
        for item in props_list:
            data.prop_items[item.item_id] = item
        
        for ann in annotations_list:
            existing = next((a for a in data.wardrobe_annotations if a.annotation_id == ann.annotation_id), None)
            if existing:
                idx = data.wardrobe_annotations.index(existing)
                data.wardrobe_annotations[idx] = ann
            else:
                data.wardrobe_annotations.append(ann)
        
        storage.save_project(data)
        
        console.print(
            f"[green]成功导入: {len(wardrobe_list)} 件服装, "
            f"{len(props_list)} 件道具, "
            f"{len(annotations_list)} 个标注[/green]"
        )
    else:
        for error in result.errors:
            console.print(f"[red]错误: {error}[/red]")


@import_data.command('actors')
@click.argument('file', type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_actors(ctx, file):
    """导入演员妆发备注 CSV/JSON 文件"""
    storage = ctx.obj['storage']
    file_path = Path(file)
    
    data = storage.load_project()
    
    importer = ActorImporter()
    importer.set_existing_data(
        actors=data.actors,
        notes=data.actor_notes
    )
    
    result = importer.import_from_file(file_path)
    
    if result.success and result.data:
        actors_list, notes_list = result.data
        
        for actor in actors_list:
            data.actors[actor.actor_id] = actor
        
        for note in notes_list:
            existing = next((n for n in data.actor_notes if n.note_id == note.note_id), None)
            if existing:
                idx = data.actor_notes.index(existing)
                data.actor_notes[idx] = note
            else:
                data.actor_notes.append(note)
        
        storage.save_project(data)
        
        console.print(
            f"[green]成功导入: {len(actors_list)} 位演员信息, "
            f"{len(notes_list)} 条妆发备注[/green]"
        )
    else:
        for error in result.errors:
            console.print(f"[red]错误: {error}[/red]")


@import_data.command('callsheet')
@click.argument('file', type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_callsheet(ctx, file):
    """导入次日通告单 CSV/JSON 文件"""
    storage = ctx.obj['storage']
    file_path = Path(file)
    
    data = storage.load_project()
    
    importer = CallSheetImporter()
    importer.set_existing_call_sheets(data.call_sheets)
    
    result = importer.import_from_file(file_path)
    
    if result.success and result.data:
        call_sheet = result.data
        data.call_sheets[call_sheet.call_sheet_id] = call_sheet
        storage.save_project(data)
        
        console.print(
            f"[green]成功导入通告单: {call_sheet.call_sheet_id}[/green]\n"
            f"  日期: {call_sheet.date}\n"
            f"  场景数: {len(call_sheet.scenes_to_shoot)}\n"
            f"  演员数: {len(call_sheet.get_actor_entries())}"
        )
    else:
        for error in result.errors:
            console.print(f"[red]错误: {error}[/red]")


@import_data.command('reshoots')
@click.argument('file', type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_reshoots(ctx, file):
    """导入补拍需求 CSV/JSON 文件"""
    storage = ctx.obj['storage']
    file_path = Path(file)
    
    data = storage.load_project()
    
    importer = ReshootImporter()
    importer.set_existing_reshoots({r.reshoot_id: r for r in data.reshoots})
    
    result = importer.import_from_file(file_path)
    
    if result.success and result.data:
        for reshoot in result.data:
            existing = next((r for r in data.reshoots if r.reshoot_id == reshoot.reshoot_id), None)
            if existing:
                idx = data.reshoots.index(existing)
                data.reshoots[idx] = reshoot
            else:
                data.reshoots.append(reshoot)
        
        storage.save_project(data)
        
        console.print(f"[green]成功导入 {len(result.data)} 条补拍需求[/green]")
    else:
        for error in result.errors:
            console.print(f"[red]错误: {error}[/red]")


@main.command()
@click.pass_context
def check(ctx):
    """运行连戏检查"""
    storage = ctx.obj['storage']
    data = storage.load_project()
    
    engine = CheckEngine()
    
    with console.status("[bold green]正在执行连戏检查...[/bold green]"):
        result = engine.run_checks(
            shot_list=data.shot_list,
            wardrobe_items=data.wardrobe_items,
            prop_items=data.prop_items,
            wardrobe_annotations=data.wardrobe_annotations,
            actors=data.actors,
            actor_notes=data.actor_notes,
            call_sheets=data.call_sheets,
            reshoots=data.reshoots,
            overrides=data.overrides
        )
    
    data.check_results.append(result)
    storage.save_project(data)
    
    summary = result.summary
    
    console.print(Panel.fit(
        f"[bold]检查完成！[/bold]\n\n"
        f"总问题数: {summary['total_issues']}\n\n"
        f"[bold]按类型分布:[/bold]\n" + 
        "\n".join([f"  {k}: {v}" for k, v in summary.get('by_type', {}).items()]) + "\n\n"
        f"[bold]按严重程度:[/bold]\n" +
        "\n".join([f"  {k}: {v}" for k, v in summary.get('by_severity', {}).items()]) + "\n\n"
        f"[bold]按状态:[/bold]\n" +
        "\n".join([f"  {k}: {v}" for k, v in summary.get('by_status', {}).items()]),
        title="检查结果摘要"
    ))
    
    if summary.get('critical_issues'):
        console.print("\n[bold red]🔴 严重问题:[/bold red]")
        for issue in summary['critical_issues']:
            console.print(f"  - {issue['title']} (场景 {issue['scene_number']})")
    
    if summary.get('high_issues'):
        console.print("\n[bold orange]🟠 高优先级问题:[/bold orange]")
        for issue in summary['high_issues']:
            console.print(f"  - {issue['title']} (场景 {issue['scene_number']})")


@main.group()
def query():
    """查询项目数据"""
    pass


@query.command('stats')
@click.pass_context
def query_stats(ctx):
    """查询项目统计信息"""
    storage = ctx.obj['storage']
    data = storage.load_project()
    
    query_engine = QueryEngine(data)
    stats = query_engine.get_project_statistics()
    
    table = Table(title="项目统计")
    table.add_column("类别", style="cyan")
    table.add_column("数值", style="green")
    
    table.add_row("总镜头数", str(stats['total_shots']))
    table.add_row("演员数", str(stats['total_actors']))
    table.add_row("服装数", str(stats['total_wardrobe_items']))
    table.add_row("道具数", str(stats['total_props']))
    table.add_row("通告单数", str(stats['total_call_sheets']))
    table.add_row("补拍需求", str(stats['total_reshoots']))
    table.add_row("问题总数", str(stats['total_issues']))
    table.add_row("人工改判", str(stats['total_overrides']))
    
    console.print(table)


@query.command('shots')
@click.option('--scene', '-s', default=None, help='按场景号筛选')
@click.option('--status', default=None, help='按状态筛选')
@click.pass_context
def query_shots(ctx, scene, status):
    """查询镜头信息"""
    storage = ctx.obj['storage']
    data = storage.load_project()
    
    query_engine = QueryEngine(data)
    
    status_enum = None
    if status:
        from ..models.shot import ShotStatus
        try:
            status_enum = ShotStatus(status.lower())
        except ValueError:
            console.print(f"[red]无效的状态值: {status}[/red]")
            return
    
    result = query_engine.query_shots(
        scene_number=scene,
        status=status_enum
    )
    
    if not result.data:
        console.print("[yellow]未找到匹配的镜头[/yellow]")
        return
    
    table = Table(title=f"镜头列表 (共 {result.total_count} 个)")
    table.add_column("镜头ID", style="cyan")
    table.add_column("场景", style="magenta")
    table.add_column("镜头号", style="green")
    table.add_column("描述", style="white")
    table.add_column("状态", style="yellow")
    
    for shot in result.data:
        table.add_row(
            shot.shot_id,
            shot.scene_number,
            shot.shot_number,
            shot.description[:50] + "..." if len(shot.description) > 50 else shot.description,
            shot.status.value
        )
    
    console.print(table)


@query.command('issues')
@click.option('--severity', default=None, help='按严重程度筛选 (critical/high/medium/low)')
@click.option('--status', default=None, help='按状态筛选 (open/in_progress/resolved/dismissed)')
@click.option('--scene', '-s', default=None, help='按场景号筛选')
@click.pass_context
def query_issues(ctx, severity, status, scene):
    """查询问题信息"""
    storage = ctx.obj['storage']
    data = storage.load_project()
    
    query_engine = QueryEngine(data)
    
    severity_enum = None
    if severity:
        try:
            severity_enum = IssueSeverity(severity.lower())
        except ValueError:
            console.print(f"[red]无效的严重程度: {severity}[/red]")
            return
    
    status_enum = None
    if status:
        try:
            status_enum = IssueStatus(status.lower())
        except ValueError:
            console.print(f"[red]无效的状态值: {status}[/red]")
            return
    
    result = query_engine.query_issues(
        severity=severity_enum,
        status=status_enum,
        scene_number=scene
    )
    
    if not result.data:
        console.print("[yellow]未找到匹配的问题[/yellow]")
        return
    
    for issue in result.data:
        severity_color = {
            'critical': 'bold red',
            'high': 'bold orange',
            'medium': 'bold yellow',
            'low': 'bold green'
        }.get(issue.severity.value, 'white')
        
        console.print(Panel(
            f"[{severity_color}]{issue.title}[/{severity_color}]\n\n"
            f"类型: {issue.issue_type.value}\n"
            f"严重程度: {issue.severity.value}\n"
            f"状态: {issue.status.value}\n"
            f"场景: {issue.scene_number or 'N/A'}\n"
            f"镜头: {issue.shot_number or 'N/A'}\n\n"
            f"描述: {issue.description}",
            title=f"问题 ID: {issue.issue_id}"
        ))


@main.group()
def override():
    """管理人工改判备注"""
    pass


@override.command('add')
@click.argument('issue_id')
@click.option('--type', '-t', required=True, 
              type=click.Choice(['dismiss', 'confirm', 'note', 'correct']),
              help='改判类型')
@click.option('--reason', '-r', required=True, help='改判原因')
@click.option('--title', default='', help='改判标题')
@click.pass_context
def add_override(ctx, issue_id, type, reason, title):
    """添加人工改判备注"""
    storage = ctx.obj['storage']
    data = storage.load_project()
    
    type_map = {
        'dismiss': OverrideType.DISMISS_ISSUE,
        'confirm': OverrideType.CONFIRM_ISSUE,
        'note': OverrideType.ADD_NOTE,
        'correct': OverrideType.CORRECT_DATA
    }
    
    import uuid
    override = OverrideNote(
        override_id=f"override_{uuid.uuid4().hex[:8]}",
        related_issue_id=issue_id,
        override_type=type_map[type],
        title=title or f"{type} 问题 {issue_id}",
        reason=reason,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    data.overrides.add_override(override)
    storage.save_project(data)
    
    console.print(f"[green]成功添加改判备注: {override.override_id}[/green]")


@override.command('list')
@click.option('--active-only', is_flag=True, help='只显示活跃的改判')
@click.option('--issue', default=None, help='按问题ID筛选')
@click.pass_context
def list_overrides(ctx, active_only, issue):
    """列出人工改判备注"""
    storage = ctx.obj['storage']
    data = storage.load_project()
    
    query_engine = QueryEngine(data)
    result = query_engine.query_overrides(
        related_issue_id=issue,
        active_only=active_only
    )
    
    if not result.data:
        console.print("[yellow]未找到改判备注[/yellow]")
        return
    
    table = Table(title=f"改判备注列表 (共 {result.total_count} 条)")
    table.add_column("改判ID", style="cyan")
    table.add_column("问题ID", style="magenta")
    table.add_column("类型", style="green")
    table.add_column("状态", style="yellow")
    table.add_column("标题", style="white")
    
    for override in result.data:
        table.add_row(
            override.override_id,
            override.related_issue_id,
            override.override_type.value,
            override.status.value,
            override.title[:40] + "..." if len(override.title) > 40 else override.title
        )
    
    console.print(table)


@main.group()
def export():
    """导出数据"""
    pass


@export.command('markdown')
@click.argument('output', type=click.Path(dir_okay=False))
@click.option('--scene', '-s', default=None, help='指定场景导出')
@click.option('--no-issues', is_flag=True, help='不包含问题')
@click.option('--no-reshoots', is_flag=True, help='不包含补拍需求')
@click.pass_context
def export_markdown(ctx, output, scene, no_issues, no_reshoots):
    """导出 Markdown 连戏报告"""
    storage = ctx.obj['storage']
    data = storage.load_project()
    
    exporter = MarkdownExporter(data)
    output_path = Path(output)
    
    with console.status("[bold green]正在生成 Markdown 报告...[/bold green]"):
        exporter.export_continuity_report(
            output_path=output_path,
            scene_number=scene,
            include_issues=not no_issues,
            include_reshoots=not no_reshoots
        )
    
    console.print(f"[green]成功导出 Markdown 报告: {output_path}[/green]")


@export.command('json')
@click.argument('output', type=click.Path(dir_okay=False))
@click.option('--no-full-data', is_flag=True, help='不包含完整数据')
@click.option('--no-issues', is_flag=True, help='不包含问题')
@click.option('--no-overrides', is_flag=True, help='不包含改判备注')
@click.pass_context
def export_json(ctx, output, no_full_data, no_issues, no_overrides):
    """导出 JSON 审计报告"""
    storage = ctx.obj['storage']
    data = storage.load_project()
    
    exporter = JsonExporter(data)
    output_path = Path(output)
    
    with console.status("[bold green]正在生成 JSON 审计报告...[/bold green]"):
        exporter.export_audit_report(
            output_path=output_path,
            include_full_data=not no_full_data,
            include_issues=not no_issues,
            include_overrides=not no_overrides
        )
    
    console.print(f"[green]成功导出 JSON 审计报告: {output_path}[/green]")


@export.command('scene')
@click.argument('scene_number')
@click.argument('output', type=click.Path(dir_okay=False))
@click.pass_context
def export_scene(ctx, scene_number, output):
    """导出单个场景的 JSON 审计"""
    storage = ctx.obj['storage']
    data = storage.load_project()
    
    exporter = JsonExporter(data)
    output_path = Path(output)
    
    with console.status("[bold green]正在生成场景审计报告...[/bold green]"):
        exporter.export_scene_audit(
            output_path=output_path,
            scene_number=scene_number
        )
    
    console.print(f"[green]成功导出场景 {scene_number} 审计报告: {output_path}[/green]")


if __name__ == '__main__':
    main()
