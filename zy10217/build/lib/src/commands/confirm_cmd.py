import click
from datetime import datetime
from tabulate import tabulate
from src.database import get_session, init_db, log_audit
from src.billing import calculate_record_total
from src.models import WorkRecord, Farmer


@click.group()
def confirm_cmd():
    """确认/撤销命令"""
    pass


@confirm_cmd.command('record')
@click.argument('record_id', type=int)
@click.option('--operator', default='admin', help='确认人')
def confirm_record(record_id, operator):
    """确认单条作业记录（机手确认）"""
    init_db()
    session = get_session()
    
    try:
        record = session.query(WorkRecord).filter(WorkRecord.id == record_id).first()
        if not record:
            click.echo(f'错误: 找不到记录 ID {record_id}')
            return
        
        if record.is_confirmed:
            click.echo(f'记录 {record_id} 已经确认过了')
            return
        
        record.is_confirmed = True
        record.confirmed_by = operator
        record.confirmed_at = datetime.now()
        
        log_audit(session, 'CONFIRM', 'work_records', record.id, 
                  f'机手确认', operator)
        
        session.commit()
        
        fees = calculate_record_total(session, record)
        click.echo(f'✅ 记录 {record_id} 已确认')
        click.echo(f'   农户: {record.farmer.name if record.farmer else "未知"}')
        click.echo(f'   作业: {record.work_type.name if record.work_type else "未知"}')
        click.echo(f'   面积: {record.area} {record.area_unit}')
        click.echo(f'   作业费: ¥{fees["work_fee"]:.2f}')
        click.echo(f'   油补: ¥{fees["oil_subsidy"]:.2f}')
        click.echo(f'   实际应付: ¥{fees["actual_fee"]:.2f}')
        
    finally:
        session.close()


@confirm_cmd.command('unconfirm')
@click.argument('record_id', type=int)
@click.option('--operator', default='admin', help='操作人')
@click.option('--reason', help='撤销原因')
def unconfirm_record(record_id, operator, reason):
    """撤销确认"""
    init_db()
    session = get_session()
    
    try:
        record = session.query(WorkRecord).filter(WorkRecord.id == record_id).first()
        if not record:
            click.echo(f'错误: 找不到记录 ID {record_id}')
            return
        
        if record.is_finalized:
            click.echo(f'错误: 记录 {record_id} 已结算，请先撤销结算')
            return
        
        if not record.is_confirmed:
            click.echo(f'记录 {record_id} 还未确认')
            return
        
        record.is_confirmed = False
        record.confirmed_by = None
        record.confirmed_at = None
        
        log_audit(session, 'UNCONFIRM', 'work_records', record.id, 
                  f'撤销确认: 原因={reason}', operator)
        
        session.commit()
        click.echo(f'✅ 记录 {record_id} 确认已撤销')
        
    finally:
        session.close()


@confirm_cmd.command('finalize')
@click.option('--record-id', type=int, help='单条记录ID')
@click.option('--farmer', help='农户姓名（结算该农户所有已确认记录）')
@click.option('--village', help='村名（结算该村所有已确认记录）')
@click.option('--all', 'all_records', is_flag=True, help='结算所有已确认记录')
@click.option('--operator', default='admin', help='操作人')
@click.option('--dry-run', is_flag=True, help='试运行，不实际结算')
def finalize(record_id, farmer, village, all_records, operator, dry_run):
    """最终结算确认"""
    init_db()
    session = get_session()
    
    try:
        query = session.query(WorkRecord).filter(
            WorkRecord.is_confirmed == True,
            WorkRecord.is_finalized == False
        )
        
        if record_id:
            query = query.filter(WorkRecord.id == record_id)
        elif farmer:
            farmer_obj = session.query(Farmer).filter(Farmer.name == farmer).first()
            if not farmer_obj:
                click.echo(f'错误: 找不到农户 "{farmer}"')
                return
            query = query.filter(WorkRecord.farmer_id == farmer_obj.id)
        elif village:
            farmer_ids = [f.id for f in session.query(Farmer).filter(Farmer.village == village).all()]
            if not farmer_ids:
                click.echo(f'错误: 找不到村 "{village}" 的农户')
                return
            query = query.filter(WorkRecord.farmer_id.in_(farmer_ids))
        elif not all_records:
            click.echo('错误: 请指定 --record-id, --farmer, --village 或 --all')
            return
        
        records = query.all()
        
        if not records:
            click.echo('没有可结算的记录')
            return
        
        click.echo(f'准备结算 {len(records)} 条记录:')
        table_data = []
        total_amount = 0
        for record in records:
            from src.billing import calculate_record_total
            fees = calculate_record_total(session, record)
            actual = fees['actual_fee']
            total_amount += actual
            table_data.append([
                record.id,
                record.farmer.name if record.farmer else '未知',
                record.plot.plot_name if record.plot else '未知',
                record.work_type.name if record.work_type else '未知',
                record.work_date,
                f'¥{actual:.2f}'
            ])
        
        headers = ['ID', '农户', '地块', '作业类型', '日期', '实付']
        click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
        click.echo(f'合计: ¥{total_amount:.2f}')
        
        if dry_run:
            click.echo('[试运行] 不会实际执行结算')
            return
        
        if not click.confirm('确认结算？'):
            click.echo('已取消')
            return
        
        for record in records:
            record.is_finalized = True
            record.finalized_by = operator
            record.finalized_at = datetime.now()
            log_audit(session, 'FINALIZE', 'work_records', record.id, 
                      f'最终结算', operator)
        
        session.commit()
        click.echo(f'✅ 已结算 {len(records)} 条记录，合计 ¥{total_amount:.2f}')
        
    finally:
        session.close()


@confirm_cmd.command('unfinalize')
@click.option('--record-id', type=int, help='单条记录ID')
@click.option('--farmer', help='农户姓名')
@click.option('--village', help='村名')
@click.option('--all', 'all_records', is_flag=True, help='撤销所有已结算记录')
@click.option('--operator', default='admin', help='操作人')
@click.option('--reason', help='撤销原因')
def unfinalize(record_id, farmer, village, all_records, operator, reason):
    """撤销最终结算"""
    init_db()
    session = get_session()
    
    try:
        query = session.query(WorkRecord).filter(WorkRecord.is_finalized == True)
        
        if record_id:
            query = query.filter(WorkRecord.id == record_id)
        elif farmer:
            farmer_obj = session.query(Farmer).filter(Farmer.name == farmer).first()
            if not farmer_obj:
                click.echo(f'错误: 找不到农户 "{farmer}"')
                return
            query = query.filter(WorkRecord.farmer_id == farmer_obj.id)
        elif village:
            farmer_ids = [f.id for f in session.query(Farmer).filter(Farmer.village == village).all()]
            if not farmer_ids:
                click.echo(f'错误: 找不到村 "{village}" 的农户')
                return
            query = query.filter(WorkRecord.farmer_id.in_(farmer_ids))
        elif not all_records:
            click.echo('错误: 请指定 --record-id, --farmer, --village 或 --all')
            return
        
        records = query.all()
        
        if not records:
            click.echo('没有可撤销的记录')
            return
        
        click.echo(f'准备撤销 {len(records)} 条记录的结算')
        if not click.confirm('确认撤销？'):
            click.echo('已取消')
            return
        
        for record in records:
            record.is_finalized = False
            record.finalized_by = None
            record.finalized_at = None
            log_audit(session, 'UNFINALIZE', 'work_records', record.id, 
                      f'撤销结算: 原因={reason}', operator)
        
        session.commit()
        click.echo(f'✅ 已撤销 {len(records)} 条记录的结算')
        
    finally:
        session.close()


@confirm_cmd.command('status')
@click.option('--farmer', help='按农户筛选')
@click.option('--village', help='按村筛选')
def show_status(farmer, village):
    """显示记录状态"""
    init_db()
    session = get_session()
    
    try:
        query = session.query(WorkRecord)
        
        if farmer:
            farmer_obj = session.query(Farmer).filter(Farmer.name == farmer).first()
            if not farmer_obj:
                click.echo(f'错误: 找不到农户 "{farmer}"')
                return
            query = query.filter(WorkRecord.farmer_id == farmer_obj.id)
        elif village:
            farmer_ids = [f.id for f in session.query(Farmer).filter(Farmer.village == village).all()]
            if not farmer_ids:
                click.echo(f'错误: 找不到村 "{village}" 的农户')
                return
            query = query.filter(WorkRecord.farmer_id.in_(farmer_ids))
        
        records = query.order_by(WorkRecord.work_date).all()
        
        if not records:
            click.echo('没有记录')
            return
        
        table_data = []
        for record in records:
            status = []
            if record.is_confirmed:
                status.append('已确认')
            else:
                status.append('待确认')
            if record.is_finalized:
                status.append('已结算')
            else:
                status.append('待结算')
            
            table_data.append([
                record.id,
                record.farmer.name if record.farmer else '未知',
                record.plot.plot_name if record.plot else '未知',
                record.work_type.name if record.work_type else '未知',
                record.work_date,
                f'{record.area}{record.area_unit}',
                '/'.join(status),
                record.source
            ])
        
        headers = ['ID', '农户', '地块', '作业类型', '日期', '面积', '状态', '来源']
        click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
        
    finally:
        session.close()
