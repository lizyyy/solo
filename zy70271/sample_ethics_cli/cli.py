"""命令行接口"""
import os
import click
from typing import Optional

from .database import Database
from .processor import DataProcessor
from .exporter import DataExporter


def get_db(db_path: Optional[str] = None) -> Database:
    return Database(db_path)


def print_result(result: dict, detail: bool = False):
    click.echo("=" * 60)
    click.echo(f"批次名称: {result['batch_name']}")
    click.echo(f"批次ID: {result['batch_id']}")
    click.echo("-" * 60)
    click.echo(f"总行数: {result['total_rows']}")
    click.echo(f"处理成功: {result['processed_rows']}")
    click.echo(f"跳过行数: {result['skipped_rows']}")
    click.echo(f"需要人工确认: {result['needs_manual_review']}")
    
    if result['skipped_records']:
        click.echo("-" * 60)
        click.echo("跳过的记录:")
        for i, rec in enumerate(result['skipped_records'], 1):
            click.echo(f"  [{i}] 类型: {rec['record_type']}")
            click.echo(f"       原因: {rec['reason']}")
            if detail:
                click.echo(f"       原始数据: {rec['original_data'][:100]}...")
    
    if result['manual_review_records']:
        click.echo("-" * 60)
        click.echo("需要人工确认的记录:")
        for i, rec in enumerate(result['manual_review_records'], 1):
            click.echo(f"  [{i}] 类型: {rec['record_type']}")
            click.echo(f"       问题: {rec['issue']}")
    
    click.echo("=" * 60)


@click.group()
@click.option('--db', 'db_path', default=None, help='数据库路径')
@click.pass_context
def main(ctx, db_path: Optional[str]):
    """科研样本伦理到期管理 CLI"""
    ctx.ensure_object(dict)
    ctx.obj['db_path'] = db_path


@main.group()
def import_data():
    """导入数据"""
    pass


@import_data.command("samples")
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--batch', 'batch_name', required=True, help='批次名称')
@click.option('--detail', is_flag=True, help='显示详细信息')
@click.pass_context
def import_samples(ctx, file_path: str, batch_name: str, detail: bool):
    """导入样本档案 (CSV/JSON)"""
    db = get_db(ctx.obj.get('db_path'))
    
    if db.batch_exists(batch_name):
        click.echo(f"批次 '{batch_name}' 已存在，跳过重复导入...")
        return
    
    processor = DataProcessor(db)
    result = processor.process_samples(file_path, batch_name)
    print_result(result, detail)


@import_data.command("ethics")
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--batch', 'batch_name', required=True, help='批次名称')
@click.option('--detail', is_flag=True, help='显示详细信息')
@click.pass_context
def import_ethics(ctx, file_path: str, batch_name: str, detail: bool):
    """导入伦理批件 (CSV/JSON)"""
    db = get_db(ctx.obj.get('db_path'))
    
    if db.batch_exists(batch_name):
        click.echo(f"批次 '{batch_name}' 已存在，跳过重复导入...")
        return
    
    processor = DataProcessor(db)
    result = processor.process_ethics(file_path, batch_name)
    print_result(result, detail)


@import_data.command("usage")
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--batch', 'batch_name', required=True, help='批次名称')
@click.option('--detail', is_flag=True, help='显示详细信息')
@click.pass_context
def import_usage(ctx, file_path: str, batch_name: str, detail: bool):
    """导入用途登记 (CSV/JSON)"""
    db = get_db(ctx.obj.get('db_path'))
    
    if db.batch_exists(batch_name):
        click.echo(f"批次 '{batch_name}' 已存在，跳过重复导入...")
        return
    
    processor = DataProcessor(db)
    result = processor.process_usage(file_path, batch_name)
    print_result(result, detail)


@import_data.command("results")
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--batch', 'batch_name', required=True, help='批次名称')
@click.option('--detail', is_flag=True, help='显示详细信息')
@click.pass_context
def import_results(ctx, file_path: str, batch_name: str, detail: bool):
    """导入结果数据 (CSV/JSON)"""
    db = get_db(ctx.obj.get('db_path'))
    
    if db.batch_exists(batch_name):
        click.echo(f"批次 '{batch_name}' 已存在，跳过重复导入...")
        return
    
    processor = DataProcessor(db)
    result = processor.process_results(file_path, batch_name)
    print_result(result, detail)


@main.group()
def check():
    """检查到期情况"""
    pass


@check.command("expiring")
@click.option('--days', 'days_threshold', default=30, help='到期天数阈值')
@click.option('--export', is_flag=True, help='导出报告')
@click.pass_context
def check_expiring(ctx, days_threshold: int, export: bool):
    """检查即将到期的伦理批件"""
    db = get_db(ctx.obj.get('db_path'))
    processor = DataProcessor(db)
    
    samples = processor.check_expiring_ethics(days_threshold)
    
    click.echo("=" * 60)
    click.echo(f"未来 {days_threshold} 天内伦理批件即将到期的样本")
    click.echo("-" * 60)
    
    if samples:
        for s in samples:
            click.echo(f"  样本编号: {s['sample_code']}")
            click.echo(f"  受试者ID: {s['subject_id']}")
            click.echo(f"  伦理批件: {s['approval_number']} - {s['title']}")
            click.echo(f"  到期日期: {s['expiry_date']}")
            click.echo("")
        
        click.echo(f"共 {len(samples)} 个样本需要关注")
    else:
        click.echo("没有即将到期的样本")
    
    if export and samples:
        exporter = DataExporter(db)
        files = exporter.export_expiring_report(days_threshold)
        click.echo("-" * 60)
        click.echo("报告已导出:")
        for name, path in files.items():
            click.echo(f"  {name}: {path}")
    
    click.echo("=" * 60)


@check.command("expired")
@click.option('--export', is_flag=True, help='导出报告')
@click.pass_context
def check_expired(ctx, export: bool):
    """检查已过期的伦理批件"""
    db = get_db(ctx.obj.get('db_path'))
    processor = DataProcessor(db)
    
    samples = processor.check_expired_ethics()
    
    click.echo("=" * 60)
    click.echo("伦理批件已过期的样本")
    click.echo("-" * 60)
    
    if samples:
        for s in samples:
            click.echo(f"  样本编号: {s['sample_code']}")
            click.echo(f"  受试者ID: {s['subject_id']}")
            click.echo(f"  伦理批件: {s['approval_number']} - {s['title']}")
            click.echo(f"  到期日期: {s['expiry_date']}")
            click.echo("")
        
        click.echo(f"共 {len(samples)} 个样本的伦理批件已过期")
    else:
        click.echo("没有已过期的样本")
    
    if export and samples:
        exporter = DataExporter(db)
        files = exporter.export_expiring_report(0)
        click.echo("-" * 60)
        click.echo("报告已导出:")
        for name, path in files.items():
            click.echo(f"  {name}: {path}")
    
    click.echo("=" * 60)


@main.command("status")
@click.option('--export', is_flag=True, help='导出报告')
@click.pass_context
def status(ctx, export: bool):
    """显示系统状态"""
    db = get_db(ctx.obj.get('db_path'))
    exporter = DataExporter(db)
    report = exporter.generate_status_report()
    
    click.echo("=" * 60)
    click.echo(f"系统状态报告 - {report['report_date']}")
    click.echo("-" * 60)
    stats = report['statistics']
    click.echo(f"  样本总数: {stats['total_samples']}")
    click.echo(f"  伦理批件总数: {stats['total_approvals']}")
    click.echo(f"  有效批件: {stats['active_approvals']}")
    click.echo(f"  已过期批件: {stats['expired_approvals']}")
    click.echo(f"  30天内到期批件: {stats['expiring_soon']}")
    click.echo(f"  用途登记数: {stats['total_usages']}")
    click.echo(f"  结果记录数: {stats['total_results']}")
    
    if report['expiring_approvals']:
        click.echo("-" * 60)
        click.echo("即将到期的伦理批件:")
        for a in report['expiring_approvals']:
            click.echo(f"  [剩余 {a['days_until']} 天] {a['approval_number']} - {a['title']} (到期: {a['expiry_date']})")
    
    if report['expired_approvals']:
        click.echo("-" * 60)
        click.echo("已过期的伦理批件:")
        for a in report['expired_approvals']:
            click.echo(f"  [已过期 {a['days_expired']} 天] {a['approval_number']} - {a['title']} (到期: {a['expiry_date']})")
    
    if export:
        files = exporter.export_status_report()
        click.echo("-" * 60)
        click.echo("报告已导出:")
        for name, path in files.items():
            click.echo(f"  {name}: {path}")
    
    click.echo("=" * 60)


@main.group()
def export():
    """导出数据"""
    pass


@export.command("all")
@click.option('--output-dir', 'output_dir', default='output', help='输出目录')
@click.pass_context
def export_all(ctx, output_dir: str):
    """导出所有数据"""
    db = get_db(ctx.obj.get('db_path'))
    exporter = DataExporter(db)
    files = exporter.export_all(output_dir)
    
    click.echo("=" * 60)
    click.echo("数据导出完成:")
    for name, path in files.items():
        click.echo(f"  {name}: {path}")
    click.echo("=" * 60)


@export.command("batch")
@click.argument('batch_name')
@click.option('--output-dir', 'output_dir', default='output', help='输出目录')
@click.pass_context
def export_batch(ctx, batch_name: str, output_dir: str):
    """导出批次处理摘要"""
    db = get_db(ctx.obj.get('db_path'))
    exporter = DataExporter(db)
    
    try:
        file_path = exporter.export_batch_summary(batch_name, output_dir)
        click.echo("=" * 60)
        click.echo(f"批次 '{batch_name}' 摘要已导出: {file_path}")
        click.echo("=" * 60)
    except ValueError as e:
        click.echo(f"错误: {e}")


@export.command("report")
@click.option('--output-dir', 'output_dir', default='output', help='输出目录')
@click.pass_context
def export_report(ctx, output_dir: str):
    """导出状态报告"""
    db = get_db(ctx.obj.get('db_path'))
    exporter = DataExporter(db)
    files = exporter.export_status_report(output_dir)
    
    click.echo("=" * 60)
    click.echo("状态报告已导出:")
    for name, path in files.items():
        click.echo(f"  {name}: {path}")
    click.echo("=" * 60)


if __name__ == '__main__':
    main()
