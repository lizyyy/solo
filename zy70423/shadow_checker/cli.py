import click
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shadow_checker.models.database import init_db, get_db, BatchInfo
from shadow_checker.utils.validator import Validator
from shadow_checker.utils.data_loader import DataLoader
from shadow_checker.utils.exporter import Exporter


@click.group()
def cli():
    init_db()
    pass


@cli.command()
@click.argument('cloud_file', type=click.Path(exists=True))
@click.argument('purchase_file', type=click.Path(exists=True))
@click.option('--batch-id', help='批次ID，默认自动生成')
@click.option('--output-dir', default='./outputs', help='输出目录')
def check(cloud_file, purchase_file, batch_id, output_dir):
    if not batch_id:
        batch_id = f'BATCH{datetime.now().strftime("%Y%m%d%H%M%S")}'
    
    click.echo(f'开始影子库校验，批次ID: {batch_id}')
    
    db = next(get_db())
    
    loader = DataLoader(db)
    cloud_orders = loader.load_cloud_resource_orders(cloud_file, batch_id)
    click.echo(f'已加载离线云资源申请单: {len(cloud_orders)} 条')
    
    purchase_inquiries = loader.load_purchase_inquiries(purchase_file, batch_id)
    click.echo(f'已加载采购询价单: {len(purchase_inquiries)} 条')
    
    validator = Validator(db, batch_id)
    
    duplicate_result = validator.check_duplicate_batch(cloud_file, purchase_file)
    if duplicate_result['is_duplicate']:
        click.echo(f'警告: 检测到重复提交！前一批次ID: {duplicate_result["previous_batch_id"]}')
        click.echo(f'重复说明: {duplicate_result["message"]}')
        click.echo('是否继续? (y/n): ', nl=False)
        choice = input().strip().lower()
        if choice != 'y':
            click.echo('已取消校验')
            return
    
    click.echo('开始校验云资源申请单...')
    cloud_results = validator.validate_cloud_orders(cloud_orders)
    click.echo(f'云资源申请单校验完成: 通过 {cloud_results["passed"]}, 失败 {cloud_results["failed"]}')
    
    click.echo('开始校验采购询价单...')
    purchase_results = validator.validate_purchase_inquiries(purchase_inquiries)
    click.echo(f'采购询价单校验完成: 通过 {purchase_results["passed"]}, 失败 {purchase_results["failed"]}')
    
    total_passed = cloud_results["passed"] + purchase_results["passed"]
    total_failed = cloud_results["failed"] + purchase_results["failed"]
    
    batch_info = BatchInfo(
        batch_id=batch_id,
        total_records=len(cloud_orders) + len(purchase_inquiries),
        passed_count=total_passed,
        failed_count=total_failed,
        status='completed',
        data_hash=validator.calculate_data_hash(cloud_file, purchase_file),
        previous_batch_id=duplicate_result.get('previous_batch_id') if duplicate_result['is_duplicate'] else None
    )
    db.add(batch_info)
    db.commit()
    
    os.makedirs(output_dir, exist_ok=True)
    exporter = Exporter(db, output_dir)
    
    report_path = exporter.export_validation_report(batch_id)
    click.echo(f'校验报告已导出: {report_path}')
    
    failed_path = exporter.export_failed_records(batch_id)
    click.echo(f'失败记录已导出: {failed_path}')
    
    cloud_detail_path = exporter.export_cloud_orders_detail(batch_id)
    click.echo(f'云资源申请单明细已导出: {cloud_detail_path}')
    
    purchase_detail_path = exporter.export_purchase_inquiries_detail(batch_id)
    click.echo(f'采购询价单明细已导出: {purchase_detail_path}')
    
    click.echo('校验完成！')
    click.echo(f'总计: 通过 {total_passed}, 失败 {total_failed}')


@cli.command()
@click.argument('batch_id')
@click.option('--output-dir', default='./outputs', help='输出目录')
def export(batch_id, output_dir):
    db = next(get_db())
    exporter = Exporter(db, output_dir)
    
    os.makedirs(output_dir, exist_ok=True)
    
    report_path = exporter.export_validation_report(batch_id)
    click.echo(f'校验报告已导出: {report_path}')
    
    failed_path = exporter.export_failed_records(batch_id)
    click.echo(f'失败记录已导出: {failed_path}')
    
    cloud_detail_path = exporter.export_cloud_orders_detail(batch_id)
    click.echo(f'云资源申请单明细已导出: {cloud_detail_path}')
    
    purchase_detail_path = exporter.export_purchase_inquiries_detail(batch_id)
    click.echo(f'采购询价单明细已导出: {purchase_detail_path}')


@cli.command()
@click.option('--limit', default=10, help='显示最近N条记录')
def list(limit):
    db = next(get_db())
    batches = db.query(BatchInfo).order_by(BatchInfo.submit_time.desc()).limit(limit).all()
    
    click.echo(f'最近 {len(batches)} 个批次:')
    click.echo('-' * 100)
    for batch in batches:
        status = '已完成' if batch.status == 'completed' else batch.status
        click.echo(f'批次ID: {batch.batch_id}')
        click.echo(f'提交时间: {batch.submit_time.strftime("%Y-%m-%d %H:%M:%S")}')
        click.echo(f'总计: {batch.total_records}, 通过: {batch.passed_count}, 失败: {batch.failed_count}')
        if batch.previous_batch_id:
            click.echo(f'重复提交自: {batch.previous_batch_id}')
        click.echo('-' * 100)


@cli.command()
def generate_demo():
    from shadow_checker.utils.data_generator import generate_demo_data
    generate_demo_data()
    click.echo('演示数据已生成在 data/ 目录下')


if __name__ == '__main__':
    cli()
