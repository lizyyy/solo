import click
from tabulate import tabulate
from src.database import get_session, init_db
from src.billing import (
    calculate_record_total,
    calculate_farmer_total,
    calculate_village_summary
)
from src.models import WorkRecord, Farmer


@click.group()
def calculate_cmd():
    """试算命令"""
    pass


@calculate_cmd.command('record')
@click.argument('record_id', type=int)
def calculate_record(record_id):
    """试算单条作业记录"""
    init_db()
    session = get_session()
    
    try:
        record = session.query(WorkRecord).filter(WorkRecord.id == record_id).first()
        if not record:
            click.echo(f'错误: 找不到记录 ID {record_id}')
            return
        
        fees = calculate_record_total(session, record)
        
        click.echo('=' * 50)
        click.echo('作业记录试算')
        click.echo('=' * 50)
        click.echo(f'记录ID: {record.id}')
        click.echo(f'农户: {record.farmer.name if record.farmer else "未知"}')
        click.echo(f'地块: {record.plot.plot_name if record.plot else "未知"}')
        click.echo(f'作业类型: {record.work_type.name if record.work_type else "未知"}')
        click.echo(f'作业日期: {record.work_date}')
        click.echo(f'面积: {record.area} {record.area_unit}')
        click.echo(f'单价: ¥{record.work_type.unit_price if record.work_type else 0}/{record.work_type.unit if record.work_type else "亩"}')
        click.echo('-' * 50)
        click.echo(f'作业费: ¥{fees["work_fee"]:.2f}')
        click.echo(f'油补: ¥{fees["oil_subsidy"]:.2f}')
        click.echo(f'实际应付: ¥{fees["actual_fee"]:.2f}')
        click.echo('-' * 50)
        click.echo(f'状态: 确认{"是" if record.is_confirmed else "否"} | 结算{"是" if record.is_finalized else "否"}')
        click.echo(f'来源: {record.source}')
        
    finally:
        session.close()


@calculate_cmd.command('farmer')
@click.argument('farmer_name')
@click.option('--include-unconfirmed', is_flag=True, help='包含未确认的记录')
def calculate_farmer(farmer_name, include_unconfirmed):
    """试算农户总费用"""
    init_db()
    session = get_session()
    
    try:
        farmer = session.query(Farmer).filter(Farmer.name == farmer_name).first()
        if not farmer:
            click.echo(f'错误: 找不到农户 "{farmer_name}"')
            return
        
        totals = calculate_farmer_total(session, farmer.id, include_confirmed_only=not include_unconfirmed)
        
        click.echo('=' * 50)
        click.echo(f'农户费用试算: {farmer.name}')
        click.echo('=' * 50)
        click.echo(f'村: {farmer.village or "未分配"}')
        click.echo(f'电话: {farmer.phone or "无"}')
        click.echo('-' * 50)
        click.echo(f'本期作业费: ¥{totals["work_fee"]:.2f}')
        click.echo(f'本期油补: ¥{totals["oil_subsidy"]:.2f}')
        click.echo(f'本期实际应付: ¥{totals["current_actual_fee"]:.2f}')
        click.echo('-' * 50)
        click.echo(f'历史欠款: ¥{totals["historical_debt"]:.2f}')
        click.echo('=' * 50)
        click.echo(f'累计应付款: ¥{totals["total_amount"]:.2f}')
        
        click.echo()
        click.echo('--- 明细 ---')
        records = session.query(WorkRecord).filter(
            WorkRecord.farmer_id == farmer.id
        ).all()
        
        table_data = []
        for record in records:
            fees = calculate_record_total(session, record)
            table_data.append([
                record.id,
                record.plot.plot_name if record.plot else '未知',
                record.work_type.name if record.work_type else '未知',
                record.work_date,
                f'{record.area}{record.area_unit}',
                f'¥{fees["work_fee"]:.2f}',
                f'¥{fees["oil_subsidy"]:.2f}',
                f'¥{fees["actual_fee"]:.2f}',
                '是' if record.is_confirmed else '否',
                '是' if record.is_finalized else '否'
            ])
        
        headers = ['ID', '地块', '作业类型', '日期', '面积', '作业费', '油补', '实付', '确认', '结算']
        click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
        
    finally:
        session.close()


@calculate_cmd.command('village')
@click.option('--village', help='指定村名（不指定则显示所有村）')
@click.option('--include-unfinalized', is_flag=True, help='包含未结算的记录')
def calculate_village(village, include_unfinalized):
    """试算村级汇总"""
    init_db()
    session = get_session()
    
    try:
        summary = calculate_village_summary(session, village, include_finalized_only=not include_unfinalized)
        
        if not summary:
            click.echo('没有数据')
            return
        
        click.echo('=' * 80)
        click.echo('村级汇总试算')
        click.echo('=' * 80)
        
        table_data = []
        grand_total = 0
        for stat in summary:
            table_data.append([
                stat['village'],
                stat['farmer_count'],
                stat['record_count'],
                f'¥{stat["work_fee"]:.2f}',
                f'¥{stat["oil_subsidy"]:.2f}',
                f'¥{stat["historical_debt"]:.2f}',
                f'¥{stat["total_amount"]:.2f}'
            ])
            grand_total += stat['total_amount']
        
        headers = ['村', '农户数', '记录数', '作业费', '油补', '历史欠款', '累计应付']
        click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
        click.echo('=' * 80)
        click.echo(f'总计: ¥{grand_total:.2f}')
        
    finally:
        session.close()


@calculate_cmd.command('all')
@click.option('--include-unconfirmed', is_flag=True, help='包含未确认的记录')
def calculate_all(include_unconfirmed):
    """试算所有农户"""
    init_db()
    session = get_session()
    
    try:
        farmers = session.query(Farmer).all()
        
        if not farmers:
            click.echo('没有农户数据')
            return
        
        click.echo('=' * 100)
        click.echo('所有农户费用试算')
        click.echo('=' * 100)
        
        table_data = []
        grand_total = 0
        for farmer in farmers:
            totals = calculate_farmer_total(session, farmer.id, include_confirmed_only=not include_unconfirmed)
            table_data.append([
                farmer.village or '未分配',
                farmer.name,
                f'¥{totals["work_fee"]:.2f}',
                f'¥{totals["oil_subsidy"]:.2f}',
                f'¥{totals["current_actual_fee"]:.2f}',
                f'¥{totals["historical_debt"]:.2f}',
                f'¥{totals["total_amount"]:.2f}'
            ])
            grand_total += totals['total_amount']
        
        headers = ['村', '农户', '作业费', '油补', '本期实付', '历史欠款', '累计应付']
        click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
        click.echo('=' * 100)
        click.echo(f'总计: ¥{grand_total:.2f}')
        
    finally:
        session.close()
