import click
from tabulate import tabulate
from src.database import get_session, init_db
from src.billing import (
    get_duplicate_records,
    check_area_unit_conflicts,
    check_unconfirmed_finalized,
    check_subsidy_exceeds_fee
)
from src.models import WorkRecord


@click.group()
def check_cmd():
    """异常检查命令"""
    pass


@check_cmd.command('all')
def check_all():
    """运行所有异常检查"""
    init_db()
    session = get_session()
    
    try:
        click.echo('=' * 60)
        click.echo('运行所有异常检查')
        click.echo('=' * 60)
        
        check_duplicates(session)
        click.echo()
        check_units(session)
        click.echo()
        check_unconfirmed(session)
        click.echo()
        check_subsidy(session)
        
    finally:
        session.close()


@check_cmd.command('duplicates')
def check_duplicates_cmd():
    """检查重复上报记录"""
    init_db()
    session = get_session()
    try:
        check_duplicates(session)
    finally:
        session.close()


def check_duplicates(session):
    click.echo('【检查1】同一地块重复上报')
    click.echo('-' * 60)
    
    records = get_duplicate_records(session)
    
    if not records:
        click.echo('✅ 没有发现重复上报记录')
        return
    
    table_data = []
    for record in records:
        table_data.append([
            record.id,
            record.farmer.name if record.farmer else '未知',
            record.plot.plot_name if record.plot else '未知',
            record.work_type.name if record.work_type else '未知',
            record.work_date,
            record.area,
            record.area_unit,
            '是' if record.is_confirmed else '否',
            '是' if record.is_finalized else '否'
        ])
    
    headers = ['记录ID', '农户', '地块', '作业类型', '作业日期', '面积', '单位', '已确认', '已结算']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
    click.echo(f'⚠️  发现 {len(records)} 条可能重复的记录')


@check_cmd.command('units')
def check_units_cmd():
    """检查面积单位混乱"""
    init_db()
    session = get_session()
    try:
        check_units(session)
    finally:
        session.close()


def check_units(session):
    click.echo('【检查2】面积单位混乱')
    click.echo('-' * 60)
    
    conflicts = check_area_unit_conflicts(session)
    
    if not conflicts:
        click.echo('✅ 没有发现单位不一致的情况')
        return
    
    table_data = []
    for c in conflicts:
        table_data.append([
            c['record_id'],
            c['farmer_name'],
            c['plot_name'],
            f"{c['plot_area']} {c['plot_unit']}",
            f"{c['record_area']} {c['record_unit']}"
        ])
    
    headers = ['记录ID', '农户', '地块', '地块登记', '作业记录']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
    click.echo(f'⚠️  发现 {len(conflicts)} 处单位不一致')


@check_cmd.command('unconfirmed')
def check_unconfirmed_cmd():
    """检查未确认就结算的记录"""
    init_db()
    session = get_session()
    try:
        check_unconfirmed(session)
    finally:
        session.close()


def check_unconfirmed(session):
    click.echo('【检查3】未确认就结算')
    click.echo('-' * 60)
    
    records = check_unconfirmed_finalized(session)
    
    if not records:
        click.echo('✅ 没有发现未确认就结算的记录')
        return
    
    table_data = []
    for record in records:
        table_data.append([
            record.id,
            record.farmer.name if record.farmer else '未知',
            record.plot.plot_name if record.plot else '未知',
            record.work_type.name if record.work_type else '未知',
            record.work_date,
            record.finalized_by,
            record.finalized_at
        ])
    
    headers = ['记录ID', '农户', '地块', '作业类型', '作业日期', '结算人', '结算时间']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
    click.echo(f'⚠️  发现 {len(records)} 条未确认就结算的记录')


@check_cmd.command('subsidy')
def check_subsidy_cmd():
    """检查油补大于作业费"""
    init_db()
    session = get_session()
    try:
        check_subsidy(session)
    finally:
        session.close()


def check_subsidy(session):
    click.echo('【检查4】油补大于作业费')
    click.echo('-' * 60)
    
    issues = check_subsidy_exceeds_fee(session)
    
    if not issues:
        click.echo('✅ 没有发现油补大于作业费的情况')
        return
    
    table_data = []
    for issue in issues:
        table_data.append([
            issue['record_id'],
            issue['farmer_name'],
            f"¥{issue['work_fee']:.2f}",
            f"¥{issue['oil_subsidy']:.2f}",
            f"¥{issue['oil_subsidy'] - issue['work_fee']:.2f}"
        ])
    
    headers = ['记录ID', '农户', '作业费', '油补', '超出金额']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
    click.echo(f'⚠️  发现 {len(issues)} 条油补大于作业费的记录')
