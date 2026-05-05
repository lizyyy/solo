import click
from datetime import datetime, date
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .database import Database, ObservationPlan
from .importer import Importer
from .scanner import ConflictScanner
from .exporter import Exporter

console = Console()


def get_db(db_path: str = "observatory.db") -> Database:
    return Database(db_path)


@click.group()
@click.option('--db', default='observatory.db', help='数据库文件路径')
@click.pass_context
def cli(ctx, db):
    """小型天文台志愿者观测计划检查工具"""
    ctx.ensure_object(dict)
    ctx.obj['db_path'] = db


@cli.command()
@click.option('--maintenance', '-m', type=click.Path(exists=True), help='维护表JSON文件路径')
@click.option('--targets', '-t', type=click.Path(exists=True), help='目标清单JSON文件路径')
@click.option('--weather', '-w', type=click.Path(exists=True), help='天气预报JSON文件路径')
@click.option('--dark-frames', '-d', type=click.Path(exists=True), help='暗帧目录路径')
@click.pass_context
def import_data(ctx, maintenance, targets, weather, dark_frames):
    """导入数据文件"""
    db = get_db(ctx.obj['db_path'])
    importer = Importer(db)
    
    imported = []
    
    if maintenance:
        count = importer.import_maintenance_schedule(maintenance)
        imported.append(f"维护表: {count} 条")
        console.print(f"[green]✓[/green] 已导入维护表: {count} 条记录")
    
    if targets:
        count = importer.import_target_list(targets)
        imported.append(f"目标清单: {count} 条")
        console.print(f"[green]✓[/green] 已导入目标清单: {count} 个目标")
    
    if weather:
        count = importer.import_weather_forecast(weather)
        imported.append(f"天气预报: {count} 条")
        console.print(f"[green]✓[/green] 已导入天气预报: {count} 条记录")
    
    if dark_frames:
        count, errors = importer.import_dark_frames_from_directory(dark_frames)
        imported.append(f"暗帧类型: {count} 种")
        console.print(f"[green]✓[/green] 已扫描暗帧目录: {count} 种配置")
        for error in errors:
            console.print(f"[yellow]⚠[/yellow] {error}")
    
    if not imported:
        console.print("[yellow]警告: 没有指定任何导入文件[/yellow]")
        console.print("使用 --maintenance, --targets, --weather, 或 --dark-frames 选项")
    else:
        console.print(f"\n[green]导入完成[/green]: {', '.join(imported)}")


@cli.command()
@click.option('--time', '-t', help='观测时间 (格式: YYYY-MM-DD HH:MM:SS)')
@click.option('--clear', is_flag=True, help='清除之前的扫描结果')
@click.pass_context
def scan(ctx, time, clear):
    """扫描所有观测计划，检测冲突"""
    db = get_db(ctx.obj['db_path'])
    
    if clear:
        db.clear_scan_results()
        console.print("[green]✓[/green] 已清除之前的扫描结果")
    
    if time:
        try:
            observation_time = datetime.strptime(time, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                observation_time = datetime.strptime(time, "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                console.print(f"[red]错误[/red]: 无法解析时间格式: {time}")
                console.print("请使用格式: YYYY-MM-DD HH:MM:SS 或 YYYY-MM-DDTHH:MM:SS")
                return
    else:
        observation_time = datetime.now()
    
    scanner = ConflictScanner(db)
    
    console.print(f"扫描时间: {observation_time.strftime('%Y-%m-%d %H:%M:%S')}")
    console.print("正在扫描目标...\n")
    
    reports = scanner.scan_all_targets(observation_time)
    
    ok_count = sum(1 for r in reports if r.is_ok)
    issue_count = len(reports) - ok_count
    
    table = Table(title="扫描结果")
    table.add_column("目标名称", style="cyan")
    table.add_column("状态", style="green")
    table.add_column("月角距", style="magenta")
    table.add_column("云量", style="blue")
    table.add_column("暗帧", style="yellow")
    table.add_column("问题数", style="red")
    
    for report in reports:
        status = "[green]✓ 正常[/green]" if report.is_ok else "[red]✗ 有问题[/red]"
        moon_angle = f"{report.estimated_moon_angle:.1f}°" if report.estimated_moon_angle else "-"
        cloud_cover = f"{report.estimated_cloud_cover*100:.0f}%" if report.estimated_cloud_cover else "-"
        dark_frame = "[green]✓[/green]" if report.has_dark_frame else "[red]✗[/red]"
        issue_count_str = str(len(report.conflicts)) if report.conflicts else "0"
        
        table.add_row(
            report.target_name,
            status,
            moon_angle,
            cloud_cover,
            dark_frame,
            issue_count_str
        )
    
    console.print(table)
    
    console.print(f"\n[green]正常目标: {ok_count}[/green] | [red]有问题目标: {issue_count}[/red]")
    
    if issue_count > 0:
        console.print("\n详细问题:")
        for report in reports:
            if report.conflicts:
                console.print(f"\n[cyan]{report.target_name}[/cyan]:")
                for conflict in report.conflicts:
                    severity_color = {
                        'high': 'red',
                        'medium': 'yellow',
                        'low': 'blue'
                    }.get(conflict['severity'], 'white')
                    console.print(f"  [{severity_color}]●[/{severity_color}] {conflict['details']}")


@cli.command(name='list')
@click.option('--type', '-t', type=click.Choice(['targets', 'maintenance', 'weather', 'dark', 'scans', 'plans']), 
              default='targets', help='列出的数据类型')
@click.pass_context
def list_data(ctx, type):
    """列出数据库中的数据"""
    db = get_db(ctx.obj['db_path'])
    
    if type == 'targets':
        targets = db.get_all_targets()
        if not targets:
            console.print("[yellow]没有目标数据[/yellow]")
            return
        
        table = Table(title="观测目标")
        table.add_column("ID", style="dim")
        table.add_column("名称", style="cyan")
        table.add_column("RA", style="magenta")
        table.add_column("Dec", style="magenta")
        table.add_column("优先级", style="yellow")
        table.add_column("最小月角距", style="blue")
        table.add_column("最大云量", style="blue")
        
        for target in targets:
            table.add_row(
                str(target.id),
                target.target_name,
                f"{target.ra:.2f}h",
                f"{target.dec:.2f}°",
                str(target.priority),
                f"{target.min_moon_angle}°",
                f"{target.max_cloud_cover*100:.0f}%"
            )
        console.print(table)
    
    elif type == 'maintenance':
        from datetime import datetime
        now = datetime.now()
        maintenances = db.get_maintenance_by_time_range(now, now)
        if not maintenances:
            console.print("[yellow]没有进行中的维护[/yellow]")
            return
        
        table = Table(title="维护计划")
        table.add_column("ID", style="dim")
        table.add_column("望远镜", style="cyan")
        table.add_column("开始时间", style="green")
        table.add_column("结束时间", style="red")
        table.add_column("描述", style="yellow")
        
        for m in maintenances:
            table.add_row(
                str(m.id),
                m.telescope_id,
                m.start_time.strftime("%Y-%m-%d %H:%M"),
                m.end_time.strftime("%Y-%m-%d %H:%M"),
                m.description
            )
        console.print(table)
    
    elif type == 'dark':
        dark_frames = db.get_all_dark_frames()
        if not dark_frames:
            console.print("[yellow]没有暗帧数据[/yellow]")
            return
        
        table = Table(title="可用暗帧")
        table.add_column("曝光(s)", style="cyan")
        table.add_column("Binning", style="magenta")
        table.add_column("增益", style="yellow")
        table.add_column("数量", style="green")
        
        for dark in dark_frames:
            table.add_row(
                str(dark.exposure),
                f"{dark.binning}x",
                str(dark.gain),
                str(dark.count)
            )
        console.print(table)
    
    elif type == 'scans':
        scan_results = db.get_all_scan_results()
        if not scan_results:
            console.print("[yellow]没有扫描结果[/yellow]")
            return
        
        table = Table(title="扫描问题")
        table.add_column("目标", style="cyan")
        table.add_column("问题类型", style="magenta")
        table.add_column("严重程度", style="yellow")
        table.add_column("详情", style="green")
        table.add_column("扫描时间", style="dim")
        
        for result in scan_results:
            severity_color = {
                'high': '[red]高[/red]',
                'medium': '[yellow]中[/yellow]',
                'low': '[blue]低[/blue]'
            }.get(result['severity'], result['severity'])
            
            conflict_name = {
                'maintenance_conflict': '维护冲突',
                'moon_angle_too_small': '月亮角距过小',
                'cloud_cover_exceeded': '云量超限',
                'missing_dark_frame': '缺少暗帧'
            }.get(result['conflict_type'], result['conflict_type'])
            
            scan_time = result['scan_time'].strftime("%H:%M:%S") if result.get('scan_time') else '-'
            
            table.add_row(
                result['target_name'],
                conflict_name,
                severity_color,
                result['conflict_details'][:50] + ('...' if len(result['conflict_details']) > 50 else ''),
                scan_time
            )
        console.print(table)
    
    elif type == 'plans':
        today = date.today()
        plans = db.get_plans_by_date(today)
        if not plans:
            console.print("[yellow]没有今天的观测计划[/yellow]")
            return
        
        table = Table(title="今日观测计划")
        table.add_column("ID", style="dim")
        table.add_column("目标", style="cyan")
        table.add_column("预定时间", style="magenta")
        table.add_column("优先级", style="yellow")
        table.add_column("状态", style="green")
        table.add_column("备注", style="blue")
        
        for plan in plans:
            status_emoji = {
                'pending': '⏳',
                'approved': '✅',
                'rejected': '❌',
                'completed': '✔️'
            }.get(plan['status'], '⏳')
            
            scheduled_time = plan['scheduled_time'].strftime('%H:%M') if plan['scheduled_time'] else '-'
            notes = (plan.get('notes', '') or '-')[:30]
            
            table.add_row(
                str(plan['id']),
                plan['target_name'],
                scheduled_time,
                str(plan['priority']),
                f"{status_emoji} {plan['status']}",
                notes
            )
        console.print(table)
    
    elif type == 'weather':
        console.print("[yellow]天气数据请通过查询接口获取[/yellow]")


@cli.command()
@click.argument('plan_id', type=int)
@click.option('--notes', '-n', required=True, help='备注内容')
@click.pass_context
def add_note(ctx, plan_id, notes):
    """为观测计划添加备注"""
    db = get_db(ctx.obj['db_path'])
    
    plan = db.get_plan_by_id(plan_id)
    if not plan:
        console.print(f"[red]错误[/red]: 找不到ID为 {plan_id} 的观测计划")
        return
    
    db.update_plan_notes(plan_id, notes)
    console.print(f"[green]✓[/green] 已为计划 {plan_id} ({plan['target_name']}) 添加备注")
    console.print(f"备注: {notes}")


@cli.command()
@click.argument('plan_id', type=int)
@click.option('--status', '-s', required=True, 
              type=click.Choice(['pending', 'approved', 'rejected', 'completed']),
              help='新状态')
@click.pass_context
def update_status(ctx, plan_id, status):
    """更新观测计划状态"""
    db = get_db(ctx.obj['db_path'])
    
    plan = db.get_plan_by_id(plan_id)
    if not plan:
        console.print(f"[red]错误[/red]: 找不到ID为 {plan_id} 的观测计划")
        return
    
    db.update_plan_status(plan_id, status)
    console.print(f"[green]✓[/green] 已将计划 {plan_id} ({plan['target_name']}) 状态更新为: {status}")


@cli.command()
@click.option('--target-id', '-t', type=int, required=True, help='目标ID')
@click.option('--time', '-s', required=True, help='预定时间 (格式: YYYY-MM-DD HH:MM:SS)')
@click.option('--status', default='pending', 
              type=click.Choice(['pending', 'approved', 'rejected', 'completed']),
              help='计划状态')
@click.option('--notes', '-n', help='备注')
@click.pass_context
def add_plan(ctx, target_id, time, status, notes):
    """添加新的观测计划"""
    db = get_db(ctx.obj['db_path'])
    
    target = db.get_target_by_id(target_id)
    if not target:
        console.print(f"[red]错误[/red]: 找不到ID为 {target_id} 的目标")
        return
    
    try:
        scheduled_time = datetime.strptime(time, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        try:
            scheduled_time = datetime.strptime(time, "%Y-%m-%dT%H:%M:%S")
        except ValueError:
            console.print(f"[red]错误[/red]: 无法解析时间格式: {time}")
            return
    
    plan = ObservationPlan(
        id=None,
        target_id=target_id,
        scheduled_time=scheduled_time,
        status=status,
        notes=notes
    )
    
    plan_id = db.add_plan(plan)
    console.print(f"[green]✓[/green] 已创建观测计划:")
    console.print(f"  计划ID: {plan_id}")
    console.print(f"  目标: {target.target_name}")
    console.print(f"  时间: {scheduled_time.strftime('%Y-%m-%d %H:%M:%S')}")
    console.print(f"  状态: {status}")


@cli.command()
@click.option('--output', '-o', required=True, help='输出文件路径')
@click.option('--format', '-f', type=click.Choice(['markdown', 'json']), default='markdown',
              help='输出格式')
@click.option('--date', '-d', help='观测日期 (格式: YYYY-MM-DD)，默认为今天')
@click.option('--title', default='观测交接单', help='Markdown文档标题')
@click.pass_context
def export(ctx, output, format, date, title):
    """导出观测交接单或审计包"""
    db = get_db(ctx.obj['db_path'])
    
    if date:
        try:
            observation_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            console.print(f"[red]错误[/red]: 无法解析日期格式: {date}")
            return
    else:
        observation_date = date.today()
    
    exporter = Exporter(db)
    
    if format == 'markdown':
        content = exporter.export_markdown_handover(
            output_path=output,
            observation_date=observation_date,
            title=title
        )
        console.print(f"[green]✓[/green] 已导出 Markdown 交接单: {output}")
    else:
        content = exporter.export_json_audit(
            output_path=output,
            observation_date=observation_date
        )
        console.print(f"[green]✓[/green] 已导出 JSON 审计包: {output}")


@cli.command()
@click.pass_context
def status(ctx):
    """显示当前系统状态概览"""
    db = get_db(ctx.obj['db_path'])
    scanner = ConflictScanner(db)
    
    targets = db.get_all_targets()
    dark_frames = db.get_all_dark_frames()
    scan_summary = scanner.get_scan_summary()
    
    console.print(Panel.fit(
        f"[bold cyan]天文台观测工具状态[/bold cyan]\n\n"
        f"目标总数: [green]{len(targets)}[/green]\n"
        f"暗帧配置: [yellow]{len(dark_frames)}[/yellow] 种\n"
        f"可观测目标: [green]{scan_summary['targets_ok']}[/green]\n"
        f"有问题目标: [red]{scan_summary['targets_with_issues']}[/red]",
        title="系统状态"
    ))


if __name__ == '__main__':
    cli()
