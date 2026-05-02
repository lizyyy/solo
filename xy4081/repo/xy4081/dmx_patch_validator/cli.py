import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .models import Severity, ActionType
from .config import ConfigManager
from .parser import CSVParser
from .validator import Validator
from .planner import AddressPlanner
from .history import HistoryManager
from .exporter import Exporter


console = Console()


@click.group()
@click.version_option(version="1.0.0", prog_name="dmx-validator")
@click.pass_context
def main(ctx):
    """DMX 地址补丁校验员 - 小剧场灯光师必备工具
    
    用于巡演换场时校验 DMX Patch 表，避免通道重叠、模式错误等问题。
    """
    ctx.ensure_object(dict)
    ctx.obj['config_manager'] = ConfigManager()


@main.command()
@click.option('--name', '-n', default="DMX Patch Project", help='项目名称')
@click.option('--universes', '-u', default=1, type=int, help='宇宙数量')
@click.pass_context
def init(ctx, name, universes):
    """初始化新项目
    
    在当前目录创建 .dmx-patch 项目目录。
    """
    cm: ConfigManager = ctx.obj['config_manager']
    
    if cm.is_initialized():
        console.print(f"[yellow]项目已存在于: {cm.get_project_path()}[/yellow]")
        return
    
    try:
        project = cm.init_project(project_name=name, universe_count=universes)
        console.print(f"[green]✓ 项目初始化成功: {project.config.project_name}[/green]")
        console.print(f"  项目目录: {cm.get_project_path()}")
        console.print(f"  配置宇宙数: {project.config.universe_count}")
    except Exception as e:
        console.print(f"[red]✗ 初始化失败: {e}[/red]")
        sys.exit(1)


@main.command('import-fixtures')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--replace', '-r', is_flag=True, help='替换现有灯具清单')
@click.pass_context
def import_fixtures(ctx, file_path, replace):
    """导入灯具清单 CSV
    
    FILE_PATH: CSV 文件路径
    
    支持的列名（中英文均可）:
    - id, 编号, 灯具ID
    - name, 名称
    - manufacturer, 制造商, 品牌
    - model, 型号
    - mode, 模式
    - position, 位置, 吊杆
    - universe, 宇宙, 宇宙号
    - start_address, 起始地址, 地址
    - channel_count, 通道数
    """
    cm: ConfigManager = ctx.obj['config_manager']
    
    if not cm.is_initialized():
        console.print("[red]错误: 未找到项目，请先运行 'init' 命令[/red]")
        sys.exit(1)
    
    try:
        project = cm.load_project()
        parser = CSVParser(cm)
        fixtures = parser.parse_fixtures(file_path)
        
        if replace:
            project.fixtures = fixtures
        else:
            existing_ids = {f.id for f in project.fixtures}
            for f in fixtures:
                if f.id in existing_ids:
                    console.print(f"[yellow]⚠  跳过重复ID: {f.id}[/yellow]")
                else:
                    project.fixtures.append(f)
        
        cm.save_project(project)
        
        hm = HistoryManager(cm)
        hm.record_import("灯具清单", file_path, len(fixtures))
        
        console.print(f"[green]✓ 成功导入 {len(fixtures)} 个灯具[/green]")
        console.print(f"  当前灯具总数: {len(project.fixtures)}")
    except Exception as e:
        console.print(f"[red]✗ 导入失败: {e}[/red]")
        sys.exit(1)


@main.command('import-patch')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--replace', '-r', is_flag=True, help='替换现有Patch表')
@click.pass_context
def import_patch(ctx, file_path, replace):
    """导入控台 Patch 表 CSV
    
    FILE_PATH: CSV 文件路径
    
    支持的列名（中英文均可）:
    - id, 编号
    - universe, 宇宙, 宇宙号
    - start_address, 起始地址, 地址
    - fixture_id, 灯具ID
    - fixture_name, 灯具名称
    - mode, 模式
    - channel_count, 通道数
    - position, 位置, 吊杆
    """
    cm: ConfigManager = ctx.obj['config_manager']
    
    if not cm.is_initialized():
        console.print("[red]错误: 未找到项目，请先运行 'init' 命令[/red]")
        sys.exit(1)
    
    try:
        project = cm.load_project()
        parser = CSVParser(cm)
        entries = parser.parse_patch(file_path)
        
        if replace:
            project.patch_entries = entries
        else:
            existing_ids = {p.id for p in project.patch_entries}
            for p in entries:
                if p.id in existing_ids:
                    console.print(f"[yellow]⚠  跳过重复ID: {p.id}[/yellow]")
                else:
                    project.patch_entries.append(p)
        
        cm.save_project(project)
        
        hm = HistoryManager(cm)
        hm.record_import("Patch表", file_path, len(entries))
        
        console.print(f"[green]✓ 成功导入 {len(entries)} 个Patch条目[/green]")
        console.print(f"  当前Patch总数: {len(project.patch_entries)}")
    except Exception as e:
        console.print(f"[red]✗ 导入失败: {e}[/red]")
        sys.exit(1)


@main.command()
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
@click.pass_context
def check(ctx, verbose):
    """校验 Patch 表
    
    检查以下问题:
    - 地址重叠
    - 地址越界
    - 宇宙容量超限
    - 灯具模式错误
    - 灯具与Patch表不一致
    """
    cm: ConfigManager = ctx.obj['config_manager']
    
    if not cm.is_initialized():
        console.print("[red]错误: 未找到项目，请先运行 'init' 命令[/red]")
        sys.exit(1)
    
    try:
        project = cm.load_project()
        
        if not project.fixtures and not project.patch_entries:
            console.print("[yellow]⚠  没有灯具或Patch数据，请先使用 import-fixtures 或 import-patch[/yellow]")
            return
        
        validator = Validator(project.fixture_libraries)
        result = validator.validate(
            project.fixtures,
            project.patch_entries,
            project.config.universe_count
        )
        
        hm = HistoryManager(cm)
        hm.record_check(
            result.total_issues,
            result.critical_count,
            result.warning_count
        )
        
        summary_table = Table(title="校验结果摘要")
        summary_table.add_column("类别", style="cyan")
        summary_table.add_column("数量", justify="right")
        
        summary_table.add_row("严重错误", f"[red]{result.critical_count}[/red]")
        summary_table.add_row("警告", f"[yellow]{result.warning_count}[/yellow]")
        summary_table.add_row("信息", f"[blue]{result.info_count}[/blue]")
        summary_table.add_row("总计", f"[bold]{result.total_issues}[/bold]")
        
        console.print(summary_table)
        
        if result.issues:
            console.print("\n[bold]详细问题列表:[/bold]")
            
            for issue in sorted(result.issues, key=lambda x: (
                0 if x.severity == Severity.CRITICAL else 
                1 if x.severity == Severity.WARNING else 2
            )):
                severity_style = {
                    Severity.CRITICAL: "red",
                    Severity.WARNING: "yellow",
                    Severity.INFO: "blue"
                }.get(issue.severity, "white")
                
                severity_label = {
                    Severity.CRITICAL: "严重",
                    Severity.WARNING: "警告",
                    Severity.INFO: "信息"
                }.get(issue.severity, "未知")
                
                panel_content = [
                    f"[{issue.category}] {issue.message}",
                ]
                if verbose:
                    if issue.affected_items:
                        panel_content.append(f"受影响: {', '.join(issue.affected_items)}")
                    if issue.suggestion:
                        panel_content.append(f"建议: {issue.suggestion}")
                
                console.print(Panel(
                    "\n".join(panel_content),
                    title=f"[{severity_style}]{severity_label}[/{severity_style}]",
                    border_style=severity_style
                ))
        
        if result.critical_count > 0:
            console.print(f"\n[red]✗ 发现 {result.critical_count} 个严重问题，请修复[/red]")
            sys.exit(2)
        elif result.warning_count > 0:
            console.print(f"\n[yellow]⚠  发现 {result.warning_count} 个警告，建议检查[/yellow]")
        else:
            console.print(f"\n[green]✓ 校验通过，未发现问题[/green]")
            
    except Exception as e:
        console.print(f"[red]✗ 校验失败: {e}[/red]")
        sys.exit(1)


@main.command()
@click.option('--mode', '-m', type=click.Choice(['rearrange', 'optimize']), default='rearrange',
              help='规划模式: rearrange(冲突重排) 或 optimize(布局优化)')
@click.option('--by-position/--no-by-position', default=True, 
              help='按位置分组（默认启用）')
@click.pass_context
def plan(ctx, mode, by_position):
    """生成重排规划
    
    根据当前状态生成可执行的地址重排建议。
    """
    cm: ConfigManager = ctx.obj['config_manager']
    
    if not cm.is_initialized():
        console.print("[red]错误: 未找到项目，请先运行 'init' 命令[/red]")
        sys.exit(1)
    
    try:
        project = cm.load_project()
        
        if not project.fixtures:
            console.print("[yellow]⚠  没有灯具数据，请先使用 import-fixtures[/yellow]")
            return
        
        planner = AddressPlanner()
        
        if mode == 'rearrange':
            result = planner.plan_rearrangement(
                project.fixtures,
                project.patch_entries,
                project.config.universe_count,
                prioritize_position=by_position
            )
        else:
            result = planner.plan_optimize_layout(
                project.fixtures,
                project.patch_entries,
                project.config.universe_count,
                group_by_position=by_position
            )
        
        hm = HistoryManager(cm)
        hm.record_plan(result.summary, len(result.actions))
        
        console.print(Panel(
            result.summary,
            title="规划摘要",
            border_style="cyan"
        ))
        
        if result.estimated_address_usage:
            usage_table = Table(title="预估地址使用情况")
            usage_table.add_column("宇宙", style="cyan")
            usage_table.add_column("已用通道", justify="right")
            usage_table.add_column("使用率", justify="right")
            
            for universe in sorted(result.estimated_address_usage.keys()):
                used = result.estimated_address_usage[universe]
                pct = used * 100 // 512
                style = "green" if pct < 70 else "yellow" if pct < 90 else "red"
                usage_table.add_row(
                    str(universe),
                    f"{used}/512",
                    f"[{style}]{pct}%[/{style}]"
                )
            
            console.print(usage_table)
        
        if result.actions:
            console.print("\n[bold]执行动作 (按优先级):[/bold]")
            for action in sorted(result.actions, key=lambda a: a.priority):
                action_style = {
                    ActionType.MOVE: "cyan",
                    ActionType.CHANGE_MODE: "yellow",
                    ActionType.ADD: "green",
                    ActionType.REMOVE: "red"
                }.get(action.action_type, "white")
                
                console.print(f"  [{action.priority}] [{action_style}]{action.description}[/{action_style}]")
        
        if result.warnings:
            console.print("\n[bold yellow]警告:[/bold yellow]")
            for warning in result.warnings:
                console.print(f"  ⚠  {warning}")
        
    except Exception as e:
        console.print(f"[red]✗ 规划失败: {e}[/red]")
        sys.exit(1)


@main.command()
@click.option('--dry-run', '-d', is_flag=True, help='模拟运行，不实际修改')
@click.option('--note', '-n', default="", help='变更备注')
@click.pass_context
def apply(ctx, dry_run, note):
    """应用规划变更
    
    写入本地变更历史（当前实现为记录操作）。
    """
    cm: ConfigManager = ctx.obj['config_manager']
    
    if not cm.is_initialized():
        console.print("[red]错误: 未找到项目，请先运行 'init' 命令[/red]")
        sys.exit(1)
    
    try:
        project = cm.load_project()
        
        if dry_run:
            console.print("[yellow]⚠  模拟运行模式，以下变更不会实际应用[/yellow]")
        
        hm = HistoryManager(cm)
        
        changes = [{
            "type": "apply",
            "dry_run": dry_run,
            "timestamp": project.config.modified_at.isoformat()
        }]
        
        record = hm.record_apply(0, changes, note)
        
        if dry_run:
            console.print(f"[green]✓ 模拟运行完成，变更已记录到历史: {record.id}[/green]")
        else:
            console.print(f"[green]✓ 变更已应用，记录ID: {record.id}[/green]")
            
        console.print(f"  提示: 目前 'apply' 命令主要用于记录操作历史")
        console.print(f"  实际的地址修改需要手动在控台中执行")
        
    except Exception as e:
        console.print(f"[red]✗ 应用失败: {e}[/red]")
        sys.exit(1)


@main.command()
@click.option('--format', '-f', type=click.Choice(['markdown', 'csv', 'all']), default='markdown',
              help='导出格式: markdown, csv, 或 all')
@click.option('--output', '-o', default='.', help='输出目录')
@click.option('--type', '-t', type=click.Choice(['checklist', 'patch', 'summary', 'all']), default='all',
              help='导出类型: checklist(检查单), patch(Patch表), summary(概览), all(全部)')
@click.pass_context
def export(ctx, format, output, type):
    """导出检查单和 Patch 表
    
    支持导出 Markdown 检查单和 CSV Patch 表。
    """
    cm: ConfigManager = ctx.obj['config_manager']
    
    if not cm.is_initialized():
        console.print("[red]错误: 未找到项目，请先运行 'init' 命令[/red]")
        sys.exit(1)
    
    try:
        project = cm.load_project()
        output_path = Path(output)
        output_path.mkdir(parents=True, exist_ok=True)
        
        hm = HistoryManager(cm)
        exported_files = []
        
        project_name = project.config.project_name.replace(' ', '_')
        
        if type in ['summary', 'all'] and format in ['markdown', 'all']:
            summary_file = output_path / f"{project_name}_summary.md"
            Exporter.export_project_summary_to_markdown(project, str(summary_file))
            exported_files.append(str(summary_file))
            console.print(f"[green]✓ 导出项目概览: {summary_file}[/green]")
        
        if type in ['checklist', 'all']:
            validator = Validator(project.fixture_libraries)
            result = validator.validate(
                project.fixtures,
                project.patch_entries,
                project.config.universe_count
            )
            
            if format in ['markdown', 'all']:
                check_file = output_path / f"{project_name}_checklist.md"
                Exporter.export_validation_to_markdown(
                    result, str(check_file), project.config.project_name
                )
                exported_files.append(str(check_file))
                console.print(f"[green]✓ 导出检查单 (Markdown): {check_file}[/green]")
        
        if type in ['patch', 'all']:
            if format in ['csv', 'all']:
                if project.fixtures:
                    fixtures_file = output_path / f"{project_name}_fixtures.csv"
                    Exporter.export_fixtures_to_csv(project.fixtures, str(fixtures_file))
                    exported_files.append(str(fixtures_file))
                    console.print(f"[green]✓ 导出灯具清单 (CSV): {fixtures_file}[/green]")
                
                if project.patch_entries:
                    patch_file = output_path / f"{project_name}_patch.csv"
                    Exporter.export_patch_to_csv(project.patch_entries, str(patch_file))
                    exported_files.append(str(patch_file))
                    console.print(f"[green]✓ 导出Patch表 (CSV): {patch_file}[/green]")
        
        if exported_files:
            hm.record_export("项目数据", output, None)
            console.print(f"\n[green]✓ 共导出 {len(exported_files)} 个文件[/green]")
        else:
            console.print("[yellow]⚠  没有数据可导出[/yellow]")
            
    except Exception as e:
        console.print(f"[red]✗ 导出失败: {e}[/red]")
        sys.exit(1)


@main.command('history')
@click.option('--limit', '-l', default=10, type=int, help='显示最近N条记录')
@click.option('--id', '-i', default=None, help='查看指定记录详情')
@click.pass_context
def show_history(ctx, limit, id):
    """查看操作历史"""
    cm: ConfigManager = ctx.obj['config_manager']
    
    if not cm.is_initialized():
        console.print("[red]错误: 未找到项目，请先运行 'init' 命令[/red]")
        sys.exit(1)
    
    try:
        hm = HistoryManager(cm)
        
        if id:
            record = hm.get_record(id)
            if record:
                console.print(Panel(
                    f"动作: {record.action}\n描述: {record.description}\n时间: {record.timestamp}",
                    title=f"历史记录: {id}",
                    border_style="cyan"
                ))
                if record.changes:
                    console.print("\n[bold]变更详情:[/bold]")
                    for change in record.changes:
                        console.print(f"  {change}")
            else:
                console.print(f"[yellow]未找到记录: {id}[/yellow]")
        else:
            records = hm.list_history(limit)
            if records:
                history_table = Table(title="操作历史")
                history_table.add_column("ID", style="cyan")
                history_table.add_column("动作", style="green")
                history_table.add_column("描述")
                history_table.add_column("时间")
                
                for record in records:
                    history_table.add_row(
                        record.id,
                        record.action.upper(),
                        record.description,
                        record.timestamp.strftime("%Y-%m-%d %H:%M")
                    )
                
                console.print(history_table)
            else:
                console.print("[yellow]暂无历史记录[/yellow]")
                
    except Exception as e:
        console.print(f"[red]✗ 读取历史失败: {e}[/red]")
        sys.exit(1)


@main.command('status')
@click.pass_context
def show_status(ctx):
    """显示当前项目状态"""
    cm: ConfigManager = ctx.obj['config_manager']
    
    if not cm.is_initialized():
        console.print("[yellow]项目未初始化[/yellow]")
        console.print("请运行 'dmx-validator init' 初始化项目")
        return
    
    try:
        project = cm.load_project()
        
        status_table = Table(title=f"项目状态: {project.config.project_name}")
        status_table.add_column("项目", style="cyan")
        status_table.add_column("值")
        
        status_table.add_row("项目名称", project.config.project_name)
        status_table.add_row("创建时间", project.config.created_at.strftime("%Y-%m-%d %H:%M"))
        status_table.add_row("最后修改", project.config.modified_at.strftime("%Y-%m-%d %H:%M"))
        status_table.add_row("配置宇宙数", str(project.config.universe_count))
        status_table.add_row("灯具数量", str(len(project.fixtures)))
        status_table.add_row("Patch条目", str(len(project.patch_entries)))
        
        console.print(status_table)
        
        if project.fixtures:
            fixtures_table = Table(title="灯具列表")
            fixtures_table.add_column("ID", style="cyan")
            fixtures_table.add_column("型号")
            fixtures_table.add_column("模式")
            fixtures_table.add_column("位置")
            fixtures_table.add_column("地址")
            
            for f in sorted(project.fixtures, key=lambda x: (x.universe, x.start_address)):
                fixtures_table.add_row(
                    f.id,
                    f"{f.manufacturer} {f.model}",
                    f.mode,
                    f.position or "-",
                    f"U{f.universe}@{f.start_address}"
                )
            
            console.print(fixtures_table)
        
    except Exception as e:
        console.print(f"[red]✗ 读取状态失败: {e}[/red]")
        sys.exit(1)


if __name__ == '__main__':
    main()
