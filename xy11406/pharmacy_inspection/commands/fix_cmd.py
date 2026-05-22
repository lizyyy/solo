import click
from datetime import datetime
from ..database import get_session
from ..models import MedicineRecord, AuditLog, OperationType, RecordStatus, Batch
from ..utils import parse_date, parse_int, parse_float, safe_str

EDITABLE_FIELDS = [
    'medicine_code', 'medicine_name', 'specification', 'manufacturer',
    'batch_number', 'production_date', 'expiry_date', 'quantity',
    'unit', 'purchase_price', 'selling_price', 'supplier', 'warehouse'
]

@click.command()
@click.argument('record_id', type=int, required=False)
@click.option('--batch-no', help='按批次筛选')
@click.option('--invalid-only', is_flag=True, help='只显示无效记录')
@click.option('--operator', required=True, help='操作人')
@click.option('--field', help='要修改的字段名')
@click.option('--value', help='新的值')
@click.option('--reason', help='修改原因')
def fix(record_id, batch_no, invalid_only, operator, field, value, reason):
    """人工修正数据"""
    session = get_session()
    
    try:
        if record_id is None:
            query = session.query(MedicineRecord)
            if batch_no:
                batch = session.query(Batch).filter_by(batch_no=batch_no).first()
                if not batch:
                    raise click.ClickException(f'批次不存在: {batch_no}')
                query = query.filter_by(batch_id=batch.id)
            if invalid_only:
                query = query.filter_by(status=RecordStatus.INVALID)
            
            records = query.order_by(MedicineRecord.id).limit(50).all()
            
            if not records:
                click.echo('没有记录')
                return
            
            click.echo(f'{"ID":<6} {"原始行号":<10} {"药品编码":<12} {"药品名称":<20} {"状态":<10} {"错误信息"}')
            click.echo('-' * 100)
            for r in records:
                err_display = (r.check_errors or '')[:40]
                click.echo(f'{r.id:<6} {r.original_line_no or "-":<10} {r.medicine_code:<12} {(r.medicine_name or "")[:18]:<20} {r.status.value:<10} {err_display}')
            
            click.echo('\n使用 pharmacy-inspect fix <ID> 修正具体记录')
            return
        
        record = session.query(MedicineRecord).get(record_id)
        if not record:
            raise click.ClickException(f'记录不存在: {record_id}')
        
        if field and value:
            if field not in EDITABLE_FIELDS:
                raise click.ClickException(f'不支持修改字段: {field}')
            
            old_value = str(getattr(record, field))
            
            if field in ['production_date', 'expiry_date']:
                new_val = parse_date(value)
            elif field == 'quantity':
                new_val = parse_int(value)
            elif field in ['purchase_price', 'selling_price']:
                new_val = parse_float(value)
            else:
                new_val = safe_str(value)
            
            audit = AuditLog(
                record_id=record.id,
                operation_type=OperationType.FIX,
                operator=operator,
                field_name=field,
                old_value=old_value,
                new_value=str(new_val),
                change_reason=reason or '人工修正'
            )
            session.add(audit)
            
            setattr(record, field, new_val)
            record.is_fixed = True
            record.fixed_by = operator
            record.fixed_at = datetime.now()
            record.fix_note = reason
            record.status = RecordStatus.FIXED
            
            session.commit()
            click.echo(f'记录 {record_id} 已更新')
            click.echo(f'  {field}: {old_value} -> {new_val}')
            return
        
        click.echo(f'\n记录详情 - ID: {record.id}')
        click.echo('=' * 50)
        click.echo(f'批次号: {record.batch.batch_no}')
        click.echo(f'数据源: {record.source_type.value}')
        click.echo(f'原始行号: {record.original_line_no}')
        click.echo(f'状态: {record.status.value}')
        if record.check_errors:
            click.echo(f'错误: {record.check_errors}')
        click.echo('')
        
        for f in EDITABLE_FIELDS:
            val = getattr(record, f)
            click.echo(f'  {f}: {val}')
        
        click.echo('\n修改示例:')
        click.echo(f'  pharmacy-inspect fix {record_id} --field expiry_date --value 2025-12-31 --operator {operator}')
        
    finally:
        session.close()

@click.command('recheck')
@click.option('--batch-no', help='批次号')
@click.option('--operator', required=True, help='操作人')
def recheck(batch_no, operator):
    """重新校验已修正的数据"""
    from .check_cmd import validate_record
    
    session = get_session()
    
    try:
        query = session.query(MedicineRecord).filter_by(status=RecordStatus.FIXED)
        if batch_no:
            batch = session.query(Batch).filter_by(batch_no=batch_no).first()
            if not batch:
                raise click.ClickException(f'批次不存在: {batch_no}')
            query = query.filter_by(batch_id=batch.id)
        
        records = query.all()
        if not records:
            click.echo('没有已修正待复检的记录')
            return
        
        valid_count = 0
        still_invalid = 0
        
        with click.progressbar(records, label='复检中') as bar:
            for record in bar:
                errors = validate_record(record)
                if errors:
                    record.status = RecordStatus.INVALID
                    record.check_errors = '; '.join(errors)
                    still_invalid += 1
                else:
                    record.status = RecordStatus.VALID
                    record.check_errors = None
                    valid_count += 1
        
        session.commit()
        
        click.echo(f'\n复检完成:')
        click.echo(f'  通过: {valid_count}')
        click.echo(f'  仍无效: {still_invalid}')
        
    finally:
        session.close()
