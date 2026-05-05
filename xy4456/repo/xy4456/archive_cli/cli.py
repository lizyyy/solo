import os
import sys
from datetime import datetime, date
from pathlib import Path
from typing import Optional, List
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .database import Database
from .importer import DataImporter
from .checker import BusinessChecker
from .query import QueryService
from .exporter import Exporter
from .models import CheckStatus, BlockReason
from .exceptions import ArchiveCLIError


# 初始化Console
console = Console()

# 默认数据库路径
DEFAULT_DB_PATH = os.path.join(os.getcwd(), 'archive.db')


def get_db(db_path: Optional[str] = None) -> Database:
    """获取数据库实例"""
    path = db_path or DEFAULT_DB_PATH
    return Database(path)


@click.group()
@click.option('--db', 'db_path', type=click.Path(), help='数据库文件路径')
@click.version_option(version='0.1.0')
@click.pass_context
def cli(ctx, db_path):
    """
    档案馆缩微胶片管理命令行工具
    
    用于管理胶片卷目录、扫描仪维护记录、库房温湿度日志和预约单，
    提供借阅检查、数据导入导出等功能。
    """
    ctx.ensure_object(dict)
    ctx.obj['db_path'] = db_path


# ==================== 导入命令 ====================

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.argument('data_type', type=click.Choice([
    'film_rolls', 'scanners', 'maintenance_records',
    'temp_humidity_logs', 'reservations', 'notes'
]))
@click.option('--overwrite', is_flag=True, help='覆盖已存在的数据')
@click.pass_context
def import_data(ctx, file_path, data_type, overwrite):
    """
    导入数据文件
    
    FILE_PATH: 要导入的文件路径 (CSV或JSON格式)
    DATA_TYPE: 数据类型
    
    支持的数据类型:
    - film_rolls: 胶片卷目录
    - scanners: 扫描仪设备
    - maintenance_records: 维护记录
    - temp_humidity_logs: 温湿度日志
    - reservations: 预约单
    - notes: 备注
    
    示例:
        archive import film_rolls.csv film_rolls
        archive import reservations.json reservations
    """
    try:
        db = get_db(ctx.obj.get('db_path'))
        importer = DataImporter(db)
        
        with console.status(f"正在导入 {data_type}..."):
            stats = importer.import_file(file_path, data_type, overwrite)
        
        # 显示结果
        console.print(Panel.fit(
            f"[green]导入完成[/green]\n\n"
            f"数据类型: {data_type}\n"
            f"总记录数: {stats['total']}\n"
            f"成功导入: [green]{stats['imported']}[/green]\n"
            f"跳过: [yellow]{stats['skipped']}[/yellow]\n"
            f"错误: [red]{stats['errors']}[/red]",
            title="导入结果"
        ))
        
        if stats['errors'] > 0 and stats.get('error_details'):
            console.print("\n[red]错误详情:[/red]")
            for err in stats['error_details'][:5]:
                console.print(f"  - 索引 {err['index']}: {err['error']}")
            if len(stats['error_details']) > 5:
                console.print(f"  ... 还有 {len(stats['error_details']) - 5} 个错误")
                
    except ArchiveCLIError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]意外错误: {e}[/red]")
        sys.exit(1)


# ==================== 检查命令 ====================

@cli.command()
@click.argument('film_roll_ids', nargs=-1, required=True)
@click.option('--time', 'check_time', type=click.DateTime(), 
              help='检查时间 (格式: YYYY-MM-DD HH:MM:SS)')
@click.option('--reader', help='读者姓名 (用于预约冲突检查)')
@click.pass_context
def check(ctx, film_roll_ids, check_time, reader):
    """
    检查胶片卷是否可以借阅
    
    FILM_ROLL_IDS: 一个或多个胶片卷ID
    
    检查内容:
    1. 霉斑风险 - 库房温湿度是否超过安全阈值
    2. 扫描仪兼容性 - 是否有支持该胶片格式的扫描仪
    3. 维护过期 - 扫描仪是否按时维护
    4. 预约冲突 - 指定时间是否有其他预约
    
    示例:
        archive check FR001
        archive check FR001 FR002 FR003 --time "2026-05-10 14:00:00" --reader "张三"
    """
    try:
        db = get_db(ctx.obj.get('db_path'))
        checker = BusinessChecker(db)
        
        if check_time is None:
            check_time = datetime.now()
        
        # 批量检查
        with console.status("正在执行检查..."):
            results = checker.check_multiple_film_rolls(
                list(film_roll_ids), check_time, reader
            )
        
        # 显示结果
        console.print(f"\n[bold]检查时间: {check_time.strftime('%Y-%m-%d %H:%M:%S')}[/bold]\n")
        
        for result in results:
            status_color = "green" if result.status == CheckStatus.AVAILABLE else "red"
            status_text = "✅ 可借阅" if result.status == CheckStatus.AVAILABLE else "❌ 已拦截"
            
            console.print(Panel(
                f"状态: [{status_color}]{status_text}[/{status_color}]\n"
                f"胶片卷ID: {result.film_roll_id}",
                title=f"检查结果 - {result.film_roll_id}"
            ))
            
            if result.block_reasons:
                console.print("[red]拦截原因:[/red]")
                for reason in result.block_reasons:
                    reason_desc = checker.get_block_reason_description(reason)
                    console.print(f"  - ❌ {reason_desc}")
                
                # 显示详细信息
                if result.details:
                    console.print("\n[yellow]详细信息:[/yellow]")
                    for key, value in result.details.items():
                        if key == 'mold_risk':
                            console.print(f"  [cyan]霉斑风险:[/cyan]")
                            if value.get('high_risk_periods'):
                                for period in value['high_risk_periods']:
                                    console.print(f"    - 高风险时段: {period['start']} 至 {period['end']}")
                                    console.print(f"      持续时间: {period['duration_hours']:.1f} 小时")
                        
                        elif key == 'scanner_compatibility':
                            console.print(f"  [cyan]扫描仪兼容性:[/cyan]")
                            for scanner in value.get('available_scanners', []):
                                if not scanner['compatible']:
                                    console.print(f"    - 扫描仪 {scanner['name']} ({scanner['model']}):")
                                    for reason in scanner.get('reasons', []):
                                        console.print(f"      - {reason}")
                        
                        elif key == 'maintenance':
                            console.print(f"  [cyan]维护过期:[/cyan]")
                            for scanner in value.get('scanners', []):
                                if scanner.get('maintenance_expired'):
                                    console.print(f"    - 扫描仪 {scanner['name']}:")
                                    if scanner.get('last_maintenance'):
                                        console.print(f"      上次维护: {scanner['last_maintenance']}")
                                    if scanner.get('days_expired'):
                                        console.print(f"      已过期: {scanner['days_expired']} 天")
                        
                        elif key == 'reservation':
                            console.print(f"  [cyan]预约冲突:[/cyan]")
                            for res in value.get('conflicting_reservations', []):
                                console.print(f"    - 读者: {res['reader_name']}")
                                console.print(f"      时间: {res['start_time']} 至 {res['end_time']}")
                                if res.get('purpose'):
                                    console.print(f"      用途: {res['purpose']}")
            
            console.print()  # 空行分隔
            
    except ArchiveCLIError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]意外错误: {e}[/red]")
        sys.exit(1)


# ==================== 查询命令 ====================

@cli.group()
@click.pass_context
def query(ctx):
    """
    查询数据
    
    支持查询胶片卷、扫描仪、维护记录、温湿度日志和预约单。
    """
    pass


@query.command('film-rolls')
@click.option('--keyword', help='关键词搜索 (标题或描述)')
@click.option('--format', 'film_format', help='胶片格式')
@click.option('--location', help='存储位置')
@click.pass_context
def query_film_rolls(ctx, keyword, film_format, location):
    """查询胶片卷"""
    try:
        db = get_db(ctx.obj.get('db_path'))
        query_service = QueryService(db)
        
        with console.status("正在查询..."):
            results = query_service.search_film_rolls(
                keyword=keyword, format=film_format, location=location
            )
        
        if not results:
            console.print("[yellow]未找到匹配的胶片卷[/yellow]")
            return
        
        # 创建表格
        table = Table(title="胶片卷列表")
        table.add_column("ID", style="cyan")
        table.add_column("标题", style="green")
        table.add_column("格式")
        table.add_column("位置")
        table.add_column("更新时间")
        
        for fr in results:
            table.add_row(
                fr.id,
                fr.title,
                fr.format or "-",
                fr.location or "-",
                fr.updated_at.strftime('%Y-%m-%d %H:%M')
            )
        
        console.print(table)
        console.print(f"\n共找到 [green]{len(results)}[/green] 条记录")
        
    except ArchiveCLIError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)


@query.command('scanners')
@click.option('--status', type=click.Choice(['active', 'maintenance', 'retired']),
              help='按状态过滤')
@click.option('--format', help='按支持的格式过滤')
@click.pass_context
def query_scanners(ctx, status, format):
    """查询扫描仪"""
    try:
        db = get_db(ctx.obj.get('db_path'))
        query_service = QueryService(db)
        
        with console.status("正在查询..."):
            if format:
                results = query_service.get_scanners_by_format(format)
            else:
                results = query_service.get_all_scanners(status)
        
        if not results:
            console.print("[yellow]未找到匹配的扫描仪[/yellow]")
            return
        
        table = Table(title="扫描仪列表")
        table.add_column("ID", style="cyan")
        table.add_column("名称", style="green")
        table.add_column("型号")
        table.add_column("支持格式")
        table.add_column("状态")
        
        for s in results:
            status_style = "green" if s.status == "active" else "yellow"
            table.add_row(
                s.id,
                s.name,
                s.model,
                ", ".join(s.supported_formats) if s.supported_formats else "-",
                f"[{status_style}]{s.status}[/{status_style}]"
            )
        
        console.print(table)
        console.print(f"\n共找到 [green]{len(results)}[/green] 台扫描仪")
        
    except ArchiveCLIError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)


@query.command('reservations')
@click.option('--film-roll-id', help='胶片卷ID')
@click.option('--reader', help='读者姓名')
@click.option('--status', default='active', 
              type=click.Choice(['active', 'cancelled', 'completed']),
              help='状态 (默认: active)')
@click.pass_context
def query_reservations(ctx, film_roll_id, reader, status):
    """查询预约单"""
    try:
        db = get_db(ctx.obj.get('db_path'))
        query_service = QueryService(db)
        
        with console.status("正在查询..."):
            results = query_service.get_reservations(
                film_roll_id=film_roll_id,
                reader_name=reader,
                status=status
            )
        
        if not results:
            console.print("[yellow]未找到匹配的预约单[/yellow]")
            return
        
        table = Table(title="预约单列表")
        table.add_column("ID", style="cyan")
        table.add_column("胶片卷ID")
        table.add_column("读者", style="green")
        table.add_column("开始时间")
        table.add_column("结束时间")
        table.add_column("状态")
        
        for r in results:
            table.add_row(
                r.id,
                r.film_roll_id,
                r.reader_name,
                r.start_time.strftime('%Y-%m-%d %H:%M'),
                r.end_time.strftime('%Y-%m-%d %H:%M'),
                r.status
            )
        
        console.print(table)
        console.print(f"\n共找到 [green]{len(results)}[/green] 条预约单")
        
    except ArchiveCLIError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)


@query.command('temp-humidity')
@click.option('--location', help='库房位置')
@click.option('--limit', type=int, default=20, help='返回记录数限制 (默认: 20)')
@click.option('--stats', is_flag=True, help='显示统计信息')
@click.pass_context
def query_temp_humidity(ctx, location, limit, stats):
    """查询温湿度日志"""
    try:
        db = get_db(ctx.obj.get('db_path'))
        query_service = QueryService(db)
        
        if stats:
            # 显示统计信息
            with console.status("正在计算统计..."):
                statistics = query_service.get_temp_humidity_statistics(location=location)
            
            if statistics['count'] == 0:
                console.print("[yellow]没有可用的温湿度数据[/yellow]")
                return
            
            console.print(Panel(
                f"记录总数: {statistics['count']}\n\n"
                f"[blue]温度[/blue]:\n"
                f"  最低: {statistics['temperature']['min']:.1f}°C\n"
                f"  最高: {statistics['temperature']['max']:.1f}°C\n"
                f"  平均: {statistics['temperature']['avg']:.1f}°C\n\n"
                f"[blue]湿度[/blue]:\n"
                f"  最低: {statistics['humidity']['min']:.1f}%\n"
                f"  最高: {statistics['humidity']['max']:.1f}%\n"
                f"  平均: {statistics['humidity']['avg']:.1f}%",
                title="温湿度统计"
            ))
        else:
            # 显示记录列表
            with console.status("正在查询..."):
                results = query_service.get_temp_humidity_logs(
                    location=location, limit=limit
                )
            
            if not results:
                console.print("[yellow]未找到温湿度日志[/yellow]")
                return
            
            table = Table(title="温湿度日志")
            table.add_column("时间", style="cyan")
            table.add_column("位置")
            table.add_column("温度 (°C)")
            table.add_column("湿度 (%)")
            
            for log in results:
                # 根据温湿度值设置颜色
                temp_color = "red" if log.temperature > 25 else "green"
                humid_color = "red" if log.humidity > 70 else "green"
                
                table.add_row(
                    log.timestamp.strftime('%Y-%m-%d %H:%M'),
                    log.location,
                    f"[{temp_color}]{log.temperature:.1f}[/{temp_color}]",
                    f"[{humid_color}]{log.humidity:.1f}[/{humid_color}]"
                )
            
            console.print(table)
            console.print(f"\n显示 [green]{len(results)}[/green] 条记录")
        
    except ArchiveCLIError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)


# ==================== 备注命令 ====================

@cli.command()
@click.argument('related_type', type=click.Choice([
    'film_roll', 'scanner', 'maintenance', 'reservation', 'check_result'
]))
@click.argument('related_id')
@click.argument('content')
@click.option('--created-by', help='创建人')
@click.pass_context
def note(ctx, related_type, related_id, content, created_by):
    """
    添加人工复核备注
    
    RELATED_TYPE: 关联类型 (film_roll, scanner, maintenance, reservation, check_result)
    RELATED_ID: 关联ID
    CONTENT: 备注内容
    
    示例:
        archive note film_roll FR001 "胶片卷有轻微划痕，需小心使用"
        archive note scanner S001 "扫描仪今日已清洁" --created-by "管理员"
    """
    from .models import Note
    import uuid
    
    try:
        db = get_db(ctx.obj.get('db_path'))
        
        note_obj = Note(
            id=str(uuid.uuid4()),
            related_type=related_type,
            related_id=related_id,
            content=content,
            created_by=created_by,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.insert_note(note_obj)
        
        console.print(Panel(
            f"[green]备注添加成功[/green]\n\n"
            f"关联类型: {related_type}\n"
            f"关联ID: {related_id}\n"
            f"内容: {content}\n"
            f"创建人: {created_by or '未指定'}",
            title="备注"
        ))
        
    except ArchiveCLIError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)


# ==================== 导出命令 ====================

@cli.group()
@click.pass_context
def export(ctx):
    """
    导出数据
    
    支持导出Markdown交接单和JSON审计包。
    """
    pass


@export.command('handover')
@click.argument('film_roll_id')
@click.argument('reader_name')
@click.option('--time', 'check_time', type=click.DateTime(),
              help='检查时间')
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
@click.option('--notes', help='交接备注')
@click.option('--created-by', help='创建人')
@click.pass_context
def export_handover(ctx, film_roll_id, reader_name, check_time, output, notes, created_by):
    """
    导出Markdown交接单
    
    FILM_ROLL_ID: 胶片卷ID
    READER_NAME: 读者姓名
    
    示例:
        archive export handover FR001 "张三"
        archive export handover FR001 "李四" --output handover_FR001.md
    """
    try:
        db = get_db(ctx.obj.get('db_path'))
        exporter = Exporter(db)
        
        with console.status("正在生成交接单..."):
            output_path = exporter.export_handover_form(
                film_roll_id=film_roll_id,
                reader_name=reader_name,
                check_time=check_time,
                output_path=output,
                notes=notes,
                created_by=created_by
            )
        
        console.print(Panel(
            f"[green]交接单生成成功[/green]\n\n"
            f"输出文件: [cyan]{output_path}[/cyan]",
            title="导出结果"
        ))
        
    except ArchiveCLIError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)


@export.command('audit')
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
@click.option('--start-time', type=click.DateTime(), help='开始时间')
@click.option('--end-time', type=click.DateTime(), help='结束时间')
@click.pass_context
def export_audit(ctx, output, start_time, end_time):
    """
    导出JSON审计包
    
    包含所有数据和统计信息，用于审计和备份。
    
    示例:
        archive export audit
        archive export audit --output audit_20260505.json
        archive export audit --start-time "2026-01-01" --end-time "2026-05-05"
    """
    try:
        db = get_db(ctx.obj.get('db_path'))
        exporter = Exporter(db)
        
        with console.status("正在生成审计包..."):
            output_path = exporter.export_audit_package(
                output_path=output,
                start_time=start_time,
                end_time=end_time
            )
        
        console.print(Panel(
            f"[green]审计包生成成功[/green]\n\n"
            f"输出文件: [cyan]{output_path}[/cyan]",
            title="导出结果"
        ))
        
    except ArchiveCLIError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)


# ==================== 状态命令 ====================

@cli.command()
@click.pass_context
def status(ctx):
    """
    显示系统状态概览
    
    显示胶片卷、扫描仪的可用性统计信息。
    """
    try:
        db = get_db(ctx.obj.get('db_path'))
        query_service = QueryService(db)
        
        with console.status("正在获取状态..."):
            summary = query_service.get_availability_summary()
        
        film_rolls = summary['film_rolls']
        scanners = summary['scanners']
        
        # 创建状态面板
        console.print(f"\n[bold]系统状态概览[/bold] - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        # 胶片卷统计
        film_table = Table(title="胶片卷状态")
        film_table.add_column("状态", style="bold")
        film_table.add_column("数量")
        film_table.add_column("占比")
        
        total = film_rolls['total']
        if total > 0:
            available_pct = (film_rolls['available'] / total) * 100
            blocked_pct = (film_rolls['blocked'] / total) * 100
        else:
            available_pct = 0
            blocked_pct = 0
        
        film_table.add_row(
            "[green]可借阅[/green]",
            str(film_rolls['available']),
            f"{available_pct:.1f}%"
        )
        film_table.add_row(
            "[red]已拦截[/red]",
            str(film_rolls['blocked']),
            f"{blocked_pct:.1f}%"
        )
        film_table.add_row(
            "[bold]总计[/bold]",
            str(total),
            "100.0%"
        )
        
        console.print(film_table)
        
        # 拦截原因统计
        if film_rolls['blocked_reasons']:
            console.print("\n[yellow]拦截原因分布:[/yellow]")
            reasons = film_rolls['blocked_reasons']
            if reasons['mold_risk'] > 0:
                console.print(f"  - 霉斑风险: {reasons['mold_risk']}")
            if reasons['scanner_incompatible'] > 0:
                console.print(f"  - 扫描仪不兼容: {reasons['scanner_incompatible']}")
            if reasons['maintenance_expired'] > 0:
                console.print(f"  - 维护过期: {reasons['maintenance_expired']}")
            if reasons['reservation_conflict'] > 0:
                console.print(f"  - 预约冲突: {reasons['reservation_conflict']}")
        
        # 扫描仪统计
        console.print(f"\n[blue]扫描仪状态:[/blue]")
        console.print(f"  总数: {scanners['total']}")
        console.print(f"  活跃: [green]{scanners['active']}[/green]")
        if scanners['maintenance_expired'] > 0:
            console.print(f"  维护过期: [red]{scanners['maintenance_expired']}[/red]")
        
        console.print()
        
    except ArchiveCLIError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)


if __name__ == '__main__':
    cli()
