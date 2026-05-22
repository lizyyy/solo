import click
from tabulate import tabulate
from ..database import get_session
from ..models import AuditLog, OperationType, MedicineRecord

@click.command()
@click.option('--record-id', type=int, help='按记录ID筛选')
@click.option('--batch-id', type=int, help='按批次ID筛选')
@click.option('--operator', help='按操作人筛选')
@click.option('--limit', type=int, default=50, help='显示条数')
def history(record_id, batch_id, operator, limit):
    """查看操作历史"""
    session = get_session()
    
    try:
        query = session.query(AuditLog).order_by(AuditLog.created_at.desc())
        
        if record_id:
            query = query.filter_by(record_id=record_id)
        if batch_id:
            query = query.filter_by(batch_id=batch_id)
        if operator:
            query = query.filter_by(operator=operator)
        
        logs = query.limit(limit).all()
        
        if not logs:
            click.echo('没有操作记录')
            return
        
        rows = []
        for log in logs:
            rows.append([
                log.id,
                log.created_at.strftime('%m-%d %H:%M'),
                log.operator,
                log.operation_type.value,
                log.record_id or '-',
                log.field_name or '-',
                (log.old_value or '-')[:20],
                (log.new_value or '-')[:20],
                (log.change_reason or '-')[:20]
            ])
        
        headers = ['ID', '时间', '操作人', '操作', '记录ID', '字段', '原值', '新值', '原因']
        click.echo(tabulate(rows, headers=headers, tablefmt='simple'))
        
    finally:
        session.close()
