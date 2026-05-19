#!/usr/bin/env python3
import click
from datetime import datetime
from storage import Database
from importer import DataImporter
from query import QueryEngine
from exporter import ReportExporter
from models import HiddenDanger, PhotoRecord, ReviewRecord, BadRecord

@click.group()
@click.pass_context
def cli(ctx):
    """项目安全员乱账治理工具 - 隐患闭环管理系统"""
    ctx.ensure_object(dict)
    ctx.obj['db'] = Database()
    ctx.obj['importer'] = DataImporter(ctx.obj['db'])
    ctx.obj['query'] = QueryEngine(ctx.obj['db'])
    ctx.obj['exporter'] = ReportExporter()

@cli.command()
@click.argument('csv_file', type=click.Path(exists=True))
@click.pass_context
def import_hazards(ctx, csv_file):
    """从CSV导入隐患记录"""
    db = ctx.obj['db']
    importer = ctx.obj['importer']
    
    click.echo(f"开始导入隐患记录: {csv_file}")
    result = importer.import_hazards_csv(csv_file)
    
    click.echo(f"\n导入完成:")
    click.echo(f"  成功: {result['success']} 条")
    click.echo(f"  失败: {result['failed']} 条")
    
    if result['failed'] > 0:
        click.echo(f"\n坏记录已保存，可使用 'bad-records' 命令查看")

@cli.command()
@click.argument('json_file', type=click.Path(exists=True))
@click.pass_context
def import_photos(ctx, json_file):
    """从JSON导入照片索引"""
    importer = ctx.obj['importer']
    
    click.echo(f"开始导入照片索引: {json_file}")
    result = importer.import_photos_json(json_file)
    
    click.echo(f"\n导入完成:")
    click.echo(f"  成功: {result['success']} 条")
    click.echo(f"  失败: {result['failed']} 条")

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.pass_context
def import_reviews(ctx, file_path):
    """导入复查记录 (支持CSV/JSON)"""
    importer = ctx.obj['importer']
    
    click.echo(f"开始导入复查记录: {file_path}")
    result = importer.import_reviews(file_path)
    
    click.echo(f"\n导入完成:")
    click.echo(f"  成功: {result['success']} 条")
    click.echo(f"  失败: {result['failed']} 条")

@cli.command()
@click.option('--person', '-p', help='按负责人筛选')
@click.option('--status', '-s', help='按状态筛选 (open/closed/pending)')
@click.option('--start-date', help='起始日期 (YYYY-MM-DD)')
@click.option('--end-date', help='结束日期 (YYYY-MM-DD)')
@click.option('--exception-type', '-e', help='按异常类型筛选')
@click.pass_context
def query(ctx, person, status, start_date, end_date, exception_type):
    """查询隐患记录"""
    query_engine = ctx.obj['query']
    
    filters = {}
    if person:
        filters['person_in_charge'] = person
    if status:
        filters['status'] = status
    if start_date:
        filters['start_date'] = start_date
    if end_date:
        filters['end_date'] = end_date
    if exception_type:
        filters['exception_type'] = exception_type
    
    results = query_engine.query_hazards(**filters)
    
    if not results:
        click.echo("未找到匹配的记录")
        return
    
    click.echo(f"\n找到 {len(results)} 条记录:")
    click.echo(query_engine.format_results(results))

@cli.command()
@click.option('--output', '-o', required=True, help='输出文件路径 (.csv 或 .xlsx)')
@click.option('--person', '-p', help='按负责人筛选')
@click.option('--status', '-s', help='按状态筛选')
@click.option('--start-date', help='起始日期')
@click.option('--end-date', help='结束日期')
@click.option('--exception-type', '-e', help='按异常类型筛选')
@click.pass_context
def export(ctx, output, person, status, start_date, end_date, exception_type):
    """导出查询结果为报告"""
    query_engine = ctx.obj['query']
    exporter = ctx.obj['exporter']
    
    filters = {}
    if person:
        filters['person_in_charge'] = person
    if status:
        filters['status'] = status
    if start_date:
        filters['start_date'] = start_date
    if end_date:
        filters['end_date'] = end_date
    if exception_type:
        filters['exception_type'] = exception_type
    
    results = query_engine.query_hazards(**filters)
    
    if not results:
        click.echo("未找到匹配的记录，无法导出")
        return
    
    exporter.export_report(results, output)
    click.echo(f"报告已导出到: {output}")

@cli.command()
@click.pass_context
def bad_records(ctx):
    """查看坏记录列表"""
    db = ctx.obj['db']
    records = db.get_all_bad_records()
    
    if not records:
        click.echo("没有坏记录")
        return
    
    click.echo(f"\n共有 {len(records)} 条坏记录:")
    for r in records:
        click.echo(f"\n[{r.id}] {r.source_type} - 行{r.line_number}")
        click.echo(f"  原因: {r.failure_reason}")
        click.echo(f"  建议: {r.suggestion}")
        click.echo(f"  原始数据: {r.raw_data[:100]}...")

@cli.command()
@click.pass_context
def summary(ctx):
    """查看数据汇总统计"""
    query_engine = ctx.obj['query']
    stats = query_engine.get_summary()
    
    click.echo("\n=== 数据汇总统计 ===")
    click.echo(f"隐患总数: {stats['total_hazards']}")
    click.echo(f"照片总数: {stats['total_photos']}")
    click.echo(f"复查记录总数: {stats['total_reviews']}")
    click.echo(f"坏记录数: {stats['total_bad_records']}")
    click.echo(f"\n按状态统计:")
    for status, count in stats['by_status'].items():
        click.echo(f"  {status}: {count}")
    click.echo(f"\n按负责人统计 (前5):")
    for person, count in list(stats['by_person'].items())[:5]:
        click.echo(f"  {person}: {count}")

if __name__ == '__main__':
    cli()
