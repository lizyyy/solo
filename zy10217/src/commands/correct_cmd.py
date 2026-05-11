import click
from tabulate import tabulate
from datetime import datetime
from src.database import get_session, init_db, log_audit, parse_date, safe_float
from src.models import WorkRecord, Correction


@click.group()
def correct_cmd():
    """人工修正命令"""
    pass


@correct_cmd.command('record')
@click.argument('record_id', type=int)
@click.option('--field', required=True, type=click.Choice([
    'area', 'area_unit', 'work_date', 'operator_name', 'machine_name'
]), help='要修改的字段')
@click.option('--value', required=True, help='新值')
@click.option('--operator', default='admin', help='操作人')
@click.option('--reason', help='修改原因')
def correct_record(record_id, field, value, operator, reason):
    """修正作业记录"""
    init_db()
    session = get_session()
    
    try:
        record = session.query(WorkRecord).filter(WorkRecord.id == record_id).first()
        if not record:
            click.echo(f'错误: 找不到记录 ID {record_id}')
            return
        
        if record.is_finalized:
            click.echo(f'警告: 记录 {record_id} 已结算，修改前请先撤销结算')
            if not click.confirm('是否继续修改？'):
                return
        
        old_value = str(getattr(record, field, ''))
        
        if field == 'area':
            new_value = safe_float(value)
        elif field == 'work_date':
            new_value = parse_date(value)
        else:
            new_value = value
        
        correction = Correction(
            work_record_id=record.id,
            field_name=field,
            old_value=old_value,
            new_value=str(new_value),
            corrected_by=operator,
            reason=reason
        )
        session.add(correction)
        
        setattr(record, field, new_value)
        
        log_audit(session, 'CORRECT', 'work_records', record.id, 
                  f'修改 {field}: {old_value} -> {new_value}', operator)
        
        session.commit()
        click.echo(f'✅ 记录 {record_id} 已修改')
        click.echo(f'   字段: {field}')
        click.echo(f'   原值: {old_value}')
        click.echo(f'   新值: {new_value}')
        
    except Exception as e:
        click.echo(f'修改失败: {str(e)}')
        session.rollback()
    finally:
        session.close()


@correct_cmd.command('delete')
@click.argument('record_id', type=int)
@click.option('--operator', default='admin', help='操作人')
@click.option('--reason', help='删除原因')
def delete_record(record_id, operator, reason):
    """删除作业记录（用于处理重复）"""
    init_db()
    session = get_session()
    
    try:
        record = session.query(WorkRecord).filter(WorkRecord.id == record_id).first()
        if not record:
            click.echo(f'错误: 找不到记录 ID {record_id}')
            return
        
        if record.is_finalized:
            click.echo(f'警告: 记录 {record_id} 已结算，删除前请先撤销结算')
            if not click.confirm('是否继续删除？'):
                return
        
        click.echo('即将删除以下记录:')
        click.echo(f'  ID: {record.id}')
        click.echo(f'  农户: {record.farmer.name if record.farmer else "未知"}')
        click.echo(f'  地块: {record.plot.plot_name if record.plot else "未知"}')
        click.echo(f'  作业类型: {record.work_type.name if record.work_type else "未知"}')
        click.echo(f'  作业日期: {record.work_date}')
        click.echo(f'  面积: {record.area} {record.area_unit}')
        
        if not click.confirm('确认删除？此操作不可恢复'):
            click.echo('已取消')
            return
        
        log_audit(session, 'DELETE', 'work_records', record.id, 
                  f'删除记录: 原因={reason}', operator)
        
        session.delete(record)
        session.commit()
        click.echo(f'✅ 记录 {record_id} 已删除')
        
    except Exception as e:
        click.echo(f'删除失败: {str(e)}')
        session.rollback()
    finally:
        session.close()


@correct_cmd.command('history')
@click.argument('record_id', type=int)
def show_correction_history(record_id):
    """查看修正历史"""
    init_db()
    session = get_session()
    
    try:
        corrections = session.query(Correction).filter(
            Correction.work_record_id == record_id
        ).order_by(Correction.created_at.desc()).all()
        
        if not corrections:
            click.echo(f'记录 {record_id} 没有修正历史')
            return
        
        table_data = []
        for c in corrections:
            table_data.append([
                c.id,
                c.field_name,
                c.old_value,
                c.new_value,
                c.corrected_by,
                c.reason or '',
                c.created_at.strftime('%Y-%m-%d %H:%M')
            ])
        
        headers = ['修正ID', '字段', '原值', '新值', '操作人', '原因', '时间']
        click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
        
    finally:
        session.close()
