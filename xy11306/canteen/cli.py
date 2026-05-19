import click
from datetime import date, datetime
import json

from canteen.database import init_db, get_db
from canteen.services import (
    ElderlyImportService, MenuImportService, DailyMenuImportService,
    DeliveryImportService, ReviewService, ExportService
)
from canteen.exceptions import BatchOperationException


@click.group()
def cli():
    """社区食堂配餐管理系统"""
    pass


@cli.command()
def init():
    """初始化数据库"""
    init_db()
    click.echo("数据库初始化成功!")


@cli.group()
def import_data():
    """数据导入命令"""
    pass


@import_data.command()
@click.argument("file_path", type=click.Path(exists=True))
def elderly(file_path):
    """导入老人档案 CSV"""
    db = next(get_db())
    service = ElderlyImportService(db)
    
    click.echo(f"正在导入老人档案: {file_path}")
    result = service.import_from_csv(file_path)
    
    click.echo(f"\n导入完成!")
    click.echo(f"总记录数: {result.total_count}")
    click.echo(f"成功: {result.success_count}")
    click.echo(f"失败: {result.failed_count}")
    
    if result.failed_count > 0:
        click.echo("\n失败记录详情:")
        for detail in result.details:
            if detail.status == "failed":
                click.echo(f"  行 {detail.row_number}: {detail.error_message}")
                click.echo(f"    建议: {detail.fix_suggestion}")
    
    click.echo(f"\n导入记录ID: {result.import_record_id}")


@import_data.command()
@click.argument("file_path", type=click.Path(exists=True))
def menu(file_path):
    """导入菜单 JSON"""
    db = next(get_db())
    service = MenuImportService(db)
    
    click.echo(f"正在导入菜单: {file_path}")
    result = service.import_from_json(file_path)
    
    click.echo(f"\n导入完成!")
    click.echo(f"总记录数: {result.total_count}")
    click.echo(f"成功: {result.success_count}")
    click.echo(f"失败: {result.failed_count}")
    
    if result.failed_count > 0:
        click.echo("\n失败记录详情:")
        for detail in result.details:
            if detail.status == "failed":
                click.echo(f"  行 {detail.row_number}: {detail.error_message}")
                click.echo(f"    建议: {detail.fix_suggestion}")
    
    click.echo(f"\n导入记录ID: {result.import_record_id}")


@import_data.command()
@click.argument("file_path", type=click.Path(exists=True))
def daily_menu(file_path):
    """导入每日菜单 JSON"""
    db = next(get_db())
    service = DailyMenuImportService(db)
    
    click.echo(f"正在导入每日菜单: {file_path}")
    result = service.import_from_json(file_path)
    
    click.echo(f"\n导入完成!")
    click.echo(f"总记录数: {result.total_count}")
    click.echo(f"成功: {result.success_count}")
    click.echo(f"失败: {result.failed_count}")
    
    if result.failed_count > 0:
        click.echo("\n失败记录详情:")
        for detail in result.details:
            if detail.status == "failed":
                click.echo(f"  行 {detail.row_number}: {detail.error_message}")
                click.echo(f"    建议: {detail.fix_suggestion}")
    
    click.echo(f"\n导入记录ID: {result.import_record_id}")


@import_data.command()
@click.argument("file_path", type=click.Path(exists=True))
def delivery(file_path):
    """导入配送表 CSV"""
    db = next(get_db())
    service = DeliveryImportService(db)
    
    click.echo(f"正在导入配送表: {file_path}")
    result = service.import_from_csv(file_path)
    
    click.echo(f"\n导入完成!")
    click.echo(f"总记录数: {result.total_count}")
    click.echo(f"成功: {result.success_count}")
    click.echo(f"失败: {result.failed_count}")
    
    if result.failed_count > 0:
        click.echo("\n失败记录详情:")
        for detail in result.details:
            if detail.status == "failed":
                click.echo(f"  行 {detail.row_number}: {detail.error_message}")
                click.echo(f"    建议: {detail.fix_suggestion}")
    
    click.echo(f"\n导入记录ID: {result.import_record_id}")


@cli.group()
def review():
    """复核命令"""
    pass


@review.command()
@click.option("--date", "-d", default=None, help="配送日期 (YYYY-MM-DD)")
@click.option("--route", "-r", default=None, help="配送路线")
def list_pending(date, route):
    """列出待复核的配送记录"""
    db = next(get_db())
    service = ReviewService(db)
    
    delivery_date = date.fromisoformat(date) if date else None
    deliveries = service.get_pending_deliveries(delivery_date, route)
    
    if not deliveries:
        click.echo("没有待复核的配送记录")
        return
    
    click.echo(f"待复核配送记录 ({len(deliveries)}条):")
    for delivery in deliveries:
        warnings = service.check_dietary_rules(delivery.id)
        warning_str = f" [有{len(warnings)}条警告!]" if warnings else ""
        click.echo(f"  ID: {delivery.id} - {delivery.elderly.name} - {delivery.delivery_date} - {delivery.meal_type}{warning_str}")
        for w in warnings:
            click.echo(f"    ! {w['message']}")


@review.command()
@click.argument("delivery_id", type=int)
@click.option("--approve/--reject", default=True, help="通过或拒绝")
@click.option("--notes", "-n", default=None, help="复核备注")
@click.option("--reviewer", "-r", default=None, help="复核人")
def delivery(delivery_id, approve, notes, reviewer):
    """复核单条配送记录"""
    db = next(get_db())
    service = ReviewService(db)
    
    warnings = service.check_dietary_rules(delivery_id)
    if warnings:
        click.echo("警告:")
        for w in warnings:
            click.echo(f"  ! {w['message']}")
        if not click.confirm("确认继续复核?"):
            return
    
    service.review_delivery(delivery_id, approve, notes, reviewer)
    click.echo(f"配送记录 {delivery_id} 已{'通过' if approve else '拒绝'}!")


@review.command()
@click.argument("delivery_ids", nargs=-1, type=int)
@click.option("--approve/--reject", default=True, help="通过或拒绝")
@click.option("--notes", "-n", default=None, help="复核备注")
@click.option("--reviewer", "-r", default=None, help="复核人")
def batch(delivery_ids, approve, notes, reviewer):
    """批量复核配送记录"""
    db = next(get_db())
    service = ReviewService(db)
    
    if not delivery_ids:
        click.echo("请指定要复核的配送记录ID")
        return
    
    try:
        result = service.batch_review(list(delivery_ids), approve, notes, reviewer)
        click.echo(f"批量复核完成: {len(result['successful'])}条成功, {len(result['failed'])}条失败")
        if result['failed']:
            click.echo("失败记录:")
            for f in result['failed']:
                click.echo(f"  ID {f['id']}: {f['error']}")
    except BatchOperationException as e:
        click.echo(f"批量复核部分完成: {e.message}")


@cli.group()
def export_data():
    """数据导出命令"""
    pass


@export_data.command()
@click.argument("delivery_date", type=str)
@click.option("--route", "-r", default=None, help="配送路线")
@click.option("--output", "-o", default=None, help="输出文件路径")
def deliveries(delivery_date, route, output):
    """导出配送单"""
    db = next(get_db())
    service = ExportService(db)
    
    d = date.fromisoformat(delivery_date)
    results = service.export_deliveries(d, route, output)
    
    if output:
        click.echo(f"配送单已导出到: {output}")
    else:
        click.echo(json.dumps(results, ensure_ascii=False, indent=2, default=str))
    
    click.echo(f"\n共导出 {len(results)} 条配送记录")


@export_data.command()
@click.argument("import_record_id", type=int)
@click.option("--output", "-o", default=None, help="输出文件路径")
def failed_imports(import_record_id, output):
    """导出导入失败的记录"""
    db = next(get_db())
    service = ExportService(db)
    
    results = service.export_failed_imports(import_record_id, output)
    
    if output:
        click.echo(f"失败记录已导出到: {output}")
    else:
        click.echo(json.dumps(results, ensure_ascii=False, indent=2))
    
    click.echo(f"\n共导出 {len(results)} 条失败记录")


if __name__ == "__main__":
    cli()
