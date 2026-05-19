import click
import json
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from typing import Optional

from .importer import DataImporter
from .exporter import DataExporter

console = Console()


@click.group()
@click.version_option(version="0.1.0", prog_name="homestay")
def cli():
    """民宿运营数据管理工具 - 管理房态、保洁记录、照片和客诉"""
    pass


@cli.group()
def import_data():
    """导入数据"""
    pass


@import_data.command("room-status")
@click.argument('file_path', type=click.Path(exists=True))
def import_room_status(file_path):
    """导入房态CSV文件"""
    importer = DataImporter()
    try:
        result = importer.import_room_status_csv(file_path)
        console.print(Panel.fit(f"[green]导入完成[/green]\n总计: {result['total']}\n成功: {result['success']}\n失败: {result['failed']}", 
                               title="房态导入结果"))
        
        if result['errors']:
            console.print("\n[red]错误详情:[/red]")
            for err in result['errors'][:5]:
                console.print(f"  {err['position']}: {err['error']}")
                console.print(f"    建议: {err['suggestion']}")
            if len(result['errors']) > 5:
                console.print(f"  ...还有 {len(result['errors']) - 5} 条错误，请使用 homestay query errors 查看全部")
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")
    finally:
        importer.close()


@import_data.command("cleaning")
@click.argument('file_path', type=click.Path(exists=True))
def import_cleaning(file_path):
    """导入保洁记录JSON文件"""
    importer = DataImporter()
    try:
        result = importer.import_cleaning_json(file_path)
        console.print(Panel.fit(f"[green]导入完成[/green]\n总计: {result['total']}\n成功: {result['success']}\n失败: {result['failed']}", 
                               title="保洁记录导入结果"))
        
        if result['errors']:
            console.print("\n[red]错误详情:[/red]")
            for err in result['errors'][:5]:
                console.print(f"  {err['position']}: {err['error']}")
                console.print(f"    建议: {err['suggestion']}")
            if len(result['errors']) > 5:
                console.print(f"  ...还有 {len(result['errors']) - 5} 条错误，请使用 homestay query errors 查看全部")
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")
    finally:
        importer.close()


@import_data.command("photos")
@click.argument('file_path', type=click.Path(exists=True))
def import_photos(file_path):
    """导入照片清单文件（JSON或纯文本）"""
    importer = DataImporter()
    try:
        result = importer.import_photo_list(file_path)
        console.print(Panel.fit(f"[green]导入完成[/green]\n总计: {result['total']}\n成功: {result['success']}\n失败: {result['failed']}", 
                               title="照片清单导入结果"))
        
        if result['errors']:
            console.print("\n[red]错误详情:[/red]")
            for err in result['errors'][:5]:
                console.print(f"  {err['position']}: {err['error']}")
                console.print(f"    建议: {err['suggestion']}")
            if len(result['errors']) > 5:
                console.print(f"  ...还有 {len(result['errors']) - 5} 条错误")
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")
    finally:
        importer.close()


@cli.group()
def query():
    """查询数据"""
    pass


@query.command("rooms")
@click.option('--room-number', '-r', help='房号筛选')
@click.option('--status', '-s', help='状态筛选')
@click.option('--json-output', is_flag=True, help='以JSON格式输出')
def query_rooms(room_number, status, json_output):
    """查询房间信息"""
    exporter = DataExporter()
    try:
        rooms = exporter.get_rooms(room_number, status)
        
        if json_output:
            console.print(json.dumps(rooms, ensure_ascii=False, indent=2, default=str))
            return
        
        if not rooms:
            console.print("[yellow]未找到符合条件的房间[/yellow]")
            return
        
        table = Table(title="房间列表")
        table.add_column("ID", style="cyan")
        table.add_column("房号", style="green")
        table.add_column("房间名", style="magenta")
        table.add_column("楼层", style="yellow")
        table.add_column("房型", style="blue")
        table.add_column("状态", style="red")
        
        for room in rooms:
            table.add_row(
                str(room.get('id')),
                room.get('room_number', ''),
                room.get('room_name', ''),
                str(room.get('floor', '')),
                room.get('room_type', ''),
                room.get('status', '')
            )
        
        console.print(table)
    finally:
        exporter.close()


@query.command("cleaning")
@click.option('--room-number', '-r', help='房号筛选')
@click.option('--start-date', help='开始日期 (YYYY-MM-DD)')
@click.option('--end-date', help='结束日期 (YYYY-MM-DD)')
@click.option('--has-complaint', is_flag=True, help='只显示有客诉的记录')
@click.option('--json-output', is_flag=True, help='以JSON格式输出')
def query_cleaning(room_number, start_date, end_date, has_complaint, json_output):
    """查询保洁记录"""
    exporter = DataExporter()
    try:
        records = exporter.get_cleaning_records(room_number, start_date, end_date, 
                                               has_complaint if has_complaint else None)
        
        if json_output:
            console.print(json.dumps(records, ensure_ascii=False, indent=2, default=str))
            return
        
        if not records:
            console.print("[yellow]未找到符合条件的保洁记录[/yellow]")
            return
        
        table = Table(title="保洁记录列表")
        table.add_column("ID", style="cyan")
        table.add_column("保洁日期", style="green")
        table.add_column("保洁员", style="magenta")
        table.add_column("质量评分", style="yellow")
        table.add_column("客诉", style="red")
        table.add_column("返工次数", style="blue")
        
        for rec in records[:20]:
            table.add_row(
                str(rec.get('id')),
                str(rec.get('cleaning_date', '')),
                rec.get('cleaner_name', ''),
                str(rec.get('quality_score', '')),
                '是' if rec.get('has_complaint') else '否',
                str(rec.get('rework_count', 0))
            )
        
        console.print(table)
        if len(records) > 20:
            console.print(f"\n[yellow]仅显示前20条，共{len(records)}条记录[/yellow]")
    finally:
        exporter.close()


@query.command("photos")
@click.option('--room-number', '-r', help='房号筛选')
@click.option('--approved', is_flag=True, help='只显示已审核的照片')
@click.option('--json-output', is_flag=True, help='以JSON格式输出')
def query_photos(room_number, approved, json_output):
    """查询照片"""
    exporter = DataExporter()
    try:
        photos = exporter.get_photos(room_number, approved if approved else None)
        
        if json_output:
            console.print(json.dumps(photos, ensure_ascii=False, indent=2, default=str))
            return
        
        if not photos:
            console.print("[yellow]未找到符合条件的照片[/yellow]")
            return
        
        table = Table(title="照片列表")
        table.add_column("ID", style="cyan")
        table.add_column("文件名", style="green")
        table.add_column("类型", style="magenta")
        table.add_column("已审核", style="yellow")
        table.add_column("创建时间", style="blue")
        
        for photo in photos[:20]:
            table.add_row(
                str(photo.get('id')),
                photo.get('file_name', ''),
                photo.get('photo_type', ''),
                '是' if photo.get('is_approved') else '否',
                str(photo.get('created_at', ''))
            )
        
        console.print(table)
        if len(photos) > 20:
            console.print(f"\n[yellow]仅显示前20条，共{len(photos)}条记录[/yellow]")
    finally:
        exporter.close()


@query.command("import-history")
@click.option('--type', '-t', 'import_type', help='导入类型筛选')
@click.option('--json-output', is_flag=True, help='以JSON格式输出')
def query_import_history(import_type, json_output):
    """查询导入历史"""
    exporter = DataExporter()
    try:
        records = exporter.get_import_history(import_type)
        
        if json_output:
            console.print(json.dumps(records, ensure_ascii=False, indent=2, default=str))
            return
        
        if not records:
            console.print("[yellow]未找到导入记录[/yellow]")
            return
        
        table = Table(title="导入历史")
        table.add_column("ID", style="cyan")
        table.add_column("文件名", style="green")
        table.add_column("类型", style="magenta")
        table.add_column("总计", style="yellow")
        table.add_column("成功", style="green")
        table.add_column("失败", style="red")
        table.add_column("导入时间", style="blue")
        
        for rec in records:
            table.add_row(
                str(rec.get('id')),
                rec.get('file_name', ''),
                rec.get('file_type', ''),
                str(rec.get('total_records', 0)),
                str(rec.get('success_count', 0)),
                str(rec.get('failed_count', 0)),
                str(rec.get('imported_at', ''))
            )
        
        console.print(table)
    finally:
        exporter.close()


@query.command("errors")
@click.option('--import-id', '-i', type=int, help='导入ID筛选')
@click.option('--unresolved', is_flag=True, help='只显示未解决的错误')
@click.option('--json-output', is_flag=True, help='以JSON格式输出')
def query_errors(import_id, unresolved, json_output):
    """查询错误记录"""
    exporter = DataExporter()
    try:
        is_resolved = False if unresolved else None
        errors = exporter.get_error_records(import_id, is_resolved)
        
        if json_output:
            console.print(json.dumps(errors, ensure_ascii=False, indent=2, default=str))
            return
        
        if not errors:
            console.print("[yellow]未找到错误记录[/yellow]")
            return
        
        table = Table(title="错误记录")
        table.add_column("ID", style="cyan")
        table.add_column("位置", style="green")
        table.add_column("错误类型", style="magenta")
        table.add_column("错误信息", style="red", overflow="fold")
        table.add_column("建议", style="yellow", overflow="fold")
        table.add_column("已解决", style="blue")
        
        for err in errors[:10]:
            table.add_row(
                str(err.get('id')),
                err.get('original_position', ''),
                err.get('error_type', ''),
                err.get('error_message', ''),
                err.get('suggestion', ''),
                '是' if err.get('is_resolved') else '否'
            )
        
        console.print(table)
        if len(errors) > 10:
            console.print(f"\n[yellow]仅显示前10条，共{len(errors)}条记录[/yellow]")
    finally:
        exporter.close()


@query.command("operation-history")
@click.option('--type', '-t', 'operation_type', help='操作类型筛选')
@click.option('--limit', '-l', type=int, default=50, help='显示条数')
@click.option('--json-output', is_flag=True, help='以JSON格式输出')
def query_operation_history(operation_type, limit, json_output):
    """查询操作历史"""
    exporter = DataExporter()
    try:
        records = exporter.get_operation_history(operation_type, limit)
        
        if json_output:
            console.print(json.dumps(records, ensure_ascii=False, indent=2, default=str))
            return
        
        if not records:
            console.print("[yellow]未找到操作记录[/yellow]")
            return
        
        table = Table(title="操作历史")
        table.add_column("ID", style="cyan")
        table.add_column("操作类型", style="green")
        table.add_column("详情", style="magenta", overflow="fold")
        table.add_column("影响记录数", style="yellow")
        table.add_column("时间", style="blue")
        
        for rec in records:
            table.add_row(
                str(rec.get('id')),
                rec.get('operation_type', ''),
                rec.get('operation_details', ''),
                str(rec.get('affected_records', 0)),
                str(rec.get('created_at', ''))
            )
        
        console.print(table)
    finally:
        exporter.close()


@cli.command("resolve-error")
@click.argument('error_id', type=int)
def resolve_error(error_id):
    """标记错误为已解决"""
    exporter = DataExporter()
    try:
        success = exporter.resolve_error(error_id)
        if success:
            console.print(f"[green]错误记录 {error_id} 已标记为已解决[/green]")
        else:
            console.print(f"[red]未找到错误记录 {error_id}[/red]")
    finally:
        exporter.close()


@cli.group()
def export_data():
    """导出数据"""
    pass


@export_data.command("cleaning")
@click.argument('output_path', type=click.Path())
@click.option('--format', '-f', 'export_format', default='csv', type=click.Choice(['csv', 'json']),
              help='导出格式 (csv/json)')
@click.option('--room-number', '-r', help='房号筛选')
@click.option('--start-date', help='开始日期 (YYYY-MM-DD)')
@click.option('--end-date', help='结束日期 (YYYY-MM-DD)')
def export_cleaning(output_path, export_format, room_number, start_date, end_date):
    """导出保洁记录"""
    exporter = DataExporter()
    try:
        records = exporter.get_cleaning_records(room_number, start_date, end_date)
        
        if export_format == 'csv':
            success = exporter.export_to_csv(records, output_path)
        else:
            success = exporter.export_to_json(records, output_path)
        
        if success:
            console.print(f"[green]成功导出 {len(records)} 条记录到 {output_path}[/green]")
        else:
            console.print("[yellow]没有数据可导出[/yellow]")
    finally:
        exporter.close()


@export_data.command("errors")
@click.argument('output_path', type=click.Path())
@click.option('--format', '-f', 'export_format', default='csv', type=click.Choice(['csv', 'json']),
              help='导出格式 (csv/json)')
@click.option('--import-id', '-i', type=int, help='导入ID筛选')
@click.option('--unresolved', is_flag=True, help='只导出未解决的错误')
def export_errors(output_path, export_format, import_id, unresolved):
    """导出错误记录"""
    exporter = DataExporter()
    try:
        is_resolved = False if unresolved else None
        errors = exporter.get_error_records(import_id, is_resolved)
        
        if export_format == 'csv':
            success = exporter.export_to_csv(errors, output_path)
        else:
            success = exporter.export_to_json(errors, output_path)
        
        if success:
            console.print(f"[green]成功导出 {len(errors)} 条记录到 {output_path}[/green]")
        else:
            console.print("[yellow]没有数据可导出[/yellow]")
    finally:
        exporter.close()


@cli.command("stats")
def show_statistics():
    """显示统计信息"""
    exporter = DataExporter()
    try:
        stats = exporter.get_statistics()
        
        table = Table(title="系统统计信息")
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="green")
        
        table.add_row("房间总数", str(stats['total_rooms']))
        table.add_row("保洁记录总数", str(stats['total_cleaning_records']))
        table.add_row("照片总数", str(stats['total_photos']))
        table.add_row("未解决错误", str(stats['unresolved_errors']))
        table.add_row("客诉记录数", str(stats['complaint_count']))
        table.add_row("返工记录数", str(stats['rework_count']))
        table.add_row("平均质量评分", str(stats['average_quality_score']) or 'N/A')
        
        console.print(table)
    finally:
        exporter.close()


def main():
    cli()


if __name__ == "__main__":
    main()
