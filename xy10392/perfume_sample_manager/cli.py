import click
import json
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .storage import DataStorage
from .logic import SampleManager

console = Console()


def get_manager():
    storage = DataStorage()
    return SampleManager(storage)


@click.group()
def cli():
    """跨店调香样品管理 CLI"""
    pass


@cli.group()
def batch():
    """样品批次管理"""
    pass


@batch.command('create')
@click.option('--id', 'batch_id', required=True, help='批次ID')
@click.option('--name', required=True, help='香型名称')
@click.option('--quantity', type=int, required=True, help='总数量')
@click.option('--date', required=True, help='生产日期 (YYYY-MM-DD)')
@click.option('--notes', default=None, help='备注')
def create_batch(batch_id, name, quantity, date, notes):
    """创建新的样品批次"""
    try:
        manager = get_manager()
        batch = manager.create_batch(batch_id, name, quantity, date, notes)
        console.print(f'[green]✓ 批次创建成功:[/green] {batch.batch_id} - {batch.fragrance_name}')
    except Exception as e:
        console.print(f'[red]✗ 错误:[/red] {e}')


@batch.command('list')
def list_batches():
    """列出所有批次"""
    manager = get_manager()
    batches = manager.storage.get_batches()
    
    if not batches:
        console.print('[yellow]暂无批次记录[/yellow]')
        return
        
    table = Table(title='样品批次列表')
    table.add_column('批次ID', style='cyan')
    table.add_column('香型名称', style='green')
    table.add_column('总数量', style='yellow')
    table.add_column('生产日期', style='blue')
    table.add_column('剩余量', style='magenta')
    table.add_column('备注')
    
    for batch in batches:
        remaining = manager.calculate_remaining_quantity(batch.batch_id)
        table.add_row(
            batch.batch_id,
            batch.fragrance_name,
            str(batch.total_quantity),
            batch.production_date,
            str(remaining),
            batch.notes or '-'
        )
    
    console.print(table)


@cli.group()
def shipment():
    """发样管理"""
    pass


@shipment.command('send')
@click.option('--id', 'shipment_id', required=True, help='发样记录ID')
@click.option('--batch', 'batch_id', required=True, help='批次ID')
@click.option('--store', required=True, help='门店名称')
@click.option('--quantity', type=int, required=True, help='发样数量')
@click.option('--date', required=True, help='发样日期 (YYYY-MM-DD)')
@click.option('--responsible', default=None, help='负责人')
@click.option('--notes', default=None, help='备注')
def send_shipment(shipment_id, batch_id, store, quantity, date, responsible, notes):
    """发样到门店"""
    try:
        manager = get_manager()
        shipment = manager.ship(shipment_id, batch_id, store, quantity, date, responsible, notes)
        console.print(f'[green]✓ 发样成功:[/green] {shipment.shipment_id} -> {shipment.store_name} ({shipment.quantity}个)')
    except Exception as e:
        console.print(f'[red]✗ 错误:[/red] {e}')


@shipment.command('list')
def list_shipments():
    """列出所有发样记录"""
    manager = get_manager()
    shipments = manager.storage.get_shipments()
    
    if not shipments:
        console.print('[yellow]暂无发样记录[/yellow]')
        return
        
    table = Table(title='发样记录列表')
    table.add_column('发样ID', style='cyan')
    table.add_column('批次ID', style='green')
    table.add_column('门店', style='yellow')
    table.add_column('数量', style='magenta')
    table.add_column('发样日期', style='blue')
    table.add_column('负责人')
    table.add_column('状态', style='bold')
    
    for shipment in shipments:
        status = manager.get_shipment_status(shipment.shipment_id)
        status_color = 'green' if status.status == '已回收' else 'yellow' if status.status == '已反馈' else 'blue'
        table.add_row(
            shipment.shipment_id,
            shipment.batch_id,
            shipment.store_name,
            str(shipment.quantity),
            shipment.shipment_date,
            shipment.responsible_person or '-',
            Text(status.status, style=status_color)
        )
    
    console.print(table)


@cli.group()
def feedback():
    """试香反馈管理"""
    pass


@feedback.command('register')
@click.option('--id', 'feedback_id', required=True, help='反馈记录ID')
@click.option('--shipment', 'shipment_id', required=True, help='发样记录ID')
@click.option('--rating', type=int, required=True, help='评分 (1-5)')
@click.option('--comments', default=None, help='评论')
@click.option('--date', default=None, help='反馈日期 (YYYY-MM-DD)')
@click.option('--tester', default=None, help='试香师姓名')
def register_feedback(feedback_id, shipment_id, rating, comments, date, tester):
    """登记试香反馈"""
    try:
        manager = get_manager()
        fb = manager.register_feedback(feedback_id, shipment_id, rating, comments, date, tester)
        console.print(f'[green]✓ 反馈登记成功:[/green] {fb.feedback_id} - 评分 {fb.rating}/5')
    except Exception as e:
        console.print(f'[red]✗ 错误:[/red] {e}')


@feedback.command('list')
def list_feedbacks():
    """列出所有反馈记录"""
    manager = get_manager()
    feedbacks = manager.storage.get_feedbacks()
    
    if not feedbacks:
        console.print('[yellow]暂无反馈记录[/yellow]')
        return
        
    table = Table(title='试香反馈列表')
    table.add_column('反馈ID', style='cyan')
    table.add_column('发样ID', style='green')
    table.add_column('评分', style='yellow')
    table.add_column('试香师')
    table.add_column('反馈日期')
    table.add_column('评论')
    
    for fb in feedbacks:
        rating_color = 'green' if fb.rating >= 4 else 'yellow' if fb.rating >= 3 else 'red'
        table.add_row(
            fb.feedback_id,
            fb.shipment_id,
            Text(f'{fb.rating}/5', style=rating_color),
            fb.tester_name or '-',
            fb.feedback_date or '-',
            fb.comments or '-'
        )
    
    console.print(table)


@cli.group()
def recovery():
    """样品回收管理"""
    pass


@recovery.command('record')
@click.option('--id', 'recovery_id', required=True, help='回收记录ID')
@click.option('--shipment', 'shipment_id', required=True, help='发样记录ID')
@click.option('--recovered', type=int, required=True, help='回收数量')
@click.option('--date', required=True, help='回收日期 (YYYY-MM-DD)')
@click.option('--lost', type=int, default=0, help='丢失数量')
@click.option('--notes', default=None, help='备注')
def record_recovery(recovery_id, shipment_id, recovered, date, lost, notes):
    """登记样品回收"""
    try:
        manager = get_manager()
        rc = manager.recover(recovery_id, shipment_id, recovered, date, lost, notes)
        console.print(f'[green]✓ 回收登记成功:[/green] {rc.recovery_id} - 回收{rc.quantity_recovered}个, 丢失{rc.lost_quantity}个')
    except Exception as e:
        console.print(f'[red]✗ 错误:[/red] {e}')


@cli.group()
def compensation():
    """丢失赔付管理"""
    pass


@compensation.command('record')
@click.option('--id', 'compensation_id', required=True, help='赔付记录ID')
@click.option('--recovery', 'recovery_id', required=True, help='回收记录ID')
@click.option('--amount', type=float, required=True, help='赔付金额')
@click.option('--date', required=True, help='赔付日期 (YYYY-MM-DD)')
@click.option('--responsible', default=None, help='赔付负责人')
@click.option('--notes', default=None, help='备注')
def record_compensation(compensation_id, recovery_id, amount, date, responsible, notes):
    """登记丢失赔付"""
    try:
        manager = get_manager()
        cmp = manager.compensate(compensation_id, recovery_id, amount, date, responsible, notes)
        console.print(f'[green]✓ 赔付登记成功:[/green] {cmp.compensation_id} - 金额 ¥{cmp.amount:.2f}')
    except Exception as e:
        console.print(f'[red]✗ 错误:[/red] {e}')


@cli.command()
@click.argument('batch_id')
def remaining(batch_id):
    """计算批次剩余量"""
    try:
        manager = get_manager()
        remaining = manager.calculate_remaining_quantity(batch_id)
        batch = manager.storage.get_batch_by_id(batch_id)
        console.print(f'[cyan]批次:[/cyan] {batch.batch_id} - {batch.fragrance_name}')
        console.print(f'[green]总数量:[/green] {batch.total_quantity}')
        console.print(f'[yellow]已发样:[/yellow] {batch.total_quantity - remaining}')
        console.print(f'[magenta]剩余量:[/magenta] {remaining}')
    except Exception as e:
        console.print(f'[red]✗ 错误:[/red] {e}')


@cli.command()
def report():
    """生成样品状态报告"""
    manager = get_manager()
    report_data = manager.generate_report()
    
    console.print(Panel.fit(
        Text('跨店调香样品管理报告', style='bold blue underline'),
        border_style='blue'
    ))
    
    stats_table = Table(title='总体统计')
    stats_table.add_column('指标', style='cyan')
    stats_table.add_column('数量', style='yellow', justify='right')
    stats_table.add_row('总批次', str(report_data.total_batches))
    stats_table.add_row('总发样', str(report_data.total_shipments))
    stats_table.add_row('在途', str(report_data.shipments_in_transit))
    stats_table.add_row('已反馈', str(report_data.shipments_with_feedback))
    stats_table.add_row('已回收', str(report_data.shipments_recovered))
    stats_table.add_row('丢失', str(report_data.shipments_lost))
    stats_table.add_row('已赔付', str(report_data.shipments_compensated))
    console.print(stats_table)
    
    if report_data.anomalies:
        anomaly_table = Table(title='异常记录', style='red')
        anomaly_table.add_column('发样ID', style='cyan')
        anomaly_table.add_column('批次ID', style='green')
        anomaly_table.add_column('香型', style='yellow')
        anomaly_table.add_column('门店', style='blue')
        anomaly_table.add_column('异常类型', style='red')
        anomaly_table.add_column('状态', style='magenta')
        
        for anomaly in report_data.anomalies:
            anomaly_table.add_row(
                anomaly['shipment_id'],
                anomaly['batch_id'],
                anomaly['fragrance'],
                anomaly['store'],
                ', '.join(anomaly['anomalies']),
                anomaly['status']
            )
        console.print(anomaly_table)
    else:
        console.print('[green]✓ 暂无异常记录[/green]')
    
    if report_data.fragrance_ratings:
        rating_table = Table(title='香型表现（值得继续调配参考）')
        rating_table.add_column('排名', style='yellow', justify='right')
        rating_table.add_column('香型名称', style='green')
        rating_table.add_column('平均评分', style='magenta')
        rating_table.add_column('反馈次数', style='cyan', justify='right')
        
        for i, rating in enumerate(report_data.fragrance_ratings, 1):
            recommendation = '✓ 推荐继续' if rating['avg_rating'] >= 4.0 else '⚠ 需关注' if rating['avg_rating'] >= 3.0 else '✗ 建议调整'
            rating_table.add_row(
                str(i),
                f"{rating['fragrance']} ({recommendation})",
                f"{rating['avg_rating']}/5",
                str(rating['feedback_count'])
            )
        console.print(rating_table)
    else:
        console.print('[yellow]暂无反馈评分数据[/yellow]')
    
    if report_data.outstanding_samples:
        outstanding_table = Table(title='在外样品（需跟进回收）')
        outstanding_table.add_column('发样ID', style='cyan')
        outstanding_table.add_column('批次ID', style='green')
        outstanding_table.add_column('香型', style='yellow')
        outstanding_table.add_column('门店', style='blue')
        outstanding_table.add_column('数量', style='magenta', justify='right')
        outstanding_table.add_column('发样日期', style='white')
        outstanding_table.add_column('状态', style='bold')
        outstanding_table.add_column('负责人')
        
        for sample in report_data.outstanding_samples:
            status_color = 'blue' if sample['status'] == '在途' else 'yellow'
            outstanding_table.add_row(
                sample['shipment_id'],
                sample['batch_id'],
                sample['fragrance'],
                sample['store'],
                str(sample['quantity']),
                sample['shipment_date'],
                Text(sample['status'], style=status_color),
                sample['responsible_person'] or '-'
            )
        console.print(outstanding_table)
    else:
        console.print('[green]✓ 所有样品均已回收[/green]')


@cli.command()
@click.option('--output', '-o', default='report.json', help='导出文件名')
def export(output):
    """导出报告为JSON"""
    try:
        manager = get_manager()
        report_data = manager.generate_report()
        
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(report_data.__dict__, f, ensure_ascii=False, indent=2, default=str)
        
        console.print(f'[green]✓ 报告已导出到:[/green] {output}')
    except Exception as e:
        console.print(f'[red]✗ 错误:[/red] {e}')


if __name__ == '__main__':
    cli()
