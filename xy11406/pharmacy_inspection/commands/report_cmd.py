import click
from datetime import date
from tabulate import tabulate
from ..database import get_session
from ..models import Batch, MedicineRecord, RecordStatus

@click.command()
@click.option('--batch-no', help='指定批次号')
@click.option('--pharmacy', help='按药房筛选')
@click.option('--show-failed', is_flag=True, help='只显示失败清单')
@click.option('--show-expired', is_flag=True, help='显示近效期/过期药品')
@click.option('--output', type=click.Path(), help='输出到文件')
@click.option('--format', 'fmt', default='table', 
              type=click.Choice(['table', 'csv', 'json']),
              help='输出格式')
def report(batch_no, pharmacy, show_failed, show_expired, output, fmt):
    """生成巡检报告"""
    session = get_session()
    
    try:
        query = session.query(MedicineRecord)
        
        if batch_no:
            batch = session.query(Batch).filter_by(batch_no=batch_no).first()
            if not batch:
                raise click.ClickException(f'批次不存在: {batch_no}')
            query = query.filter_by(batch_id=batch.id)
        
        if pharmacy:
            query = query.join(Batch).filter(Batch.pharmacy_name == pharmacy)
        
        if show_failed:
            query = query.filter(MedicineRecord.status == RecordStatus.INVALID)
        
        records = query.all()
        
        if not records:
            click.echo('没有数据')
            return
        
        if show_expired:
            today = date.today()
            records = [r for r in records if r.expiry_date and (r.expiry_date - today).days <= 90]
            records.sort(key=lambda r: r.expiry_date or date.max)
        
        total = len(records)
        valid = sum(1 for r in records if r.status == RecordStatus.VALID)
        invalid = sum(1 for r in records if r.status == RecordStatus.INVALID)
        fixed = sum(1 for r in records if r.status == RecordStatus.FIXED)
        raw = sum(1 for r in records if r.status == RecordStatus.RAW)
        
        if show_failed or show_expired:
            display_records(records, fmt, output)
        else:
            click.echo('\n' + '=' * 60)
            click.echo('乡镇药房近效期巡检报告')
            click.echo('=' * 60)
            click.echo(f'总记录数: {total}')
            click.echo(f'  有效: {valid}')
            click.echo(f'  无效: {invalid}')
            click.echo(f'  已修正: {fixed}')
            click.echo(f'  待校验: {raw}')
            click.echo('')
            
            if invalid > 0:
                click.echo('失败清单 (前20条):')
                click.echo('-' * 60)
                failed_records = [r for r in records if r.status == RecordStatus.INVALID][:20]
                display_records(failed_records, fmt, None, brief=True)
                click.echo(f'\n... 共 {invalid} 条失败记录')
                click.echo('使用 --show-failed 查看完整失败清单')
    
    finally:
        session.close()

def display_records(records, fmt, output, brief=False):
    if fmt == 'table' or fmt == 'csv':
        headers = ['ID', '原始行号', '药品编码', '药品名称', '规格', '批号', '有效期', '数量', '状态', '错误']
        rows = []
        for r in records:
            rows.append([
                r.id,
                r.original_line_no or '-',
                r.medicine_code,
                r.medicine_name[:15] if brief and r.medicine_name else r.medicine_name,
                r.specification[:10] if brief and r.specification else r.specification,
                r.batch_number,
                str(r.expiry_date) if r.expiry_date else '-',
                r.quantity,
                r.status.value,
                (r.check_errors or '')[:50] if brief else (r.check_errors or '')
            ])
        
        if fmt == 'csv':
            import csv
            import io
            output_io = open(output, 'w', newline='', encoding='utf-8-sig') if output else io.StringIO()
            writer = csv.writer(output_io)
            writer.writerow(headers)
            writer.writerows(rows)
            if output:
                output_io.close()
                click.echo(f'已导出到: {output}')
            else:
                click.echo(output_io.getvalue())
        else:
            click.echo(tabulate(rows, headers=headers, tablefmt='simple'))
    
    elif fmt == 'json':
        import json
        data = []
        for r in records:
            data.append({
                'id': r.id,
                'original_line_no': r.original_line_no,
                'medicine_code': r.medicine_code,
                'medicine_name': r.medicine_name,
                'specification': r.specification,
                'manufacturer': r.manufacturer,
                'batch_number': r.batch_number,
                'expiry_date': str(r.expiry_date) if r.expiry_date else None,
                'quantity': r.quantity,
                'status': r.status.value,
                'check_errors': r.check_errors
            })
        
        if output:
            with open(output, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            click.echo(f'已导出到: {output}')
        else:
            click.echo(json.dumps(data, ensure_ascii=False, indent=2))

@click.command('batches')
@click.option('--pharmacy', help='按药房筛选')
def list_batches(pharmacy):
    """查看批次列表"""
    session = get_session()
    
    try:
        query = session.query(Batch).order_by(Batch.created_at.desc())
        if pharmacy:
            query = query.filter_by(pharmacy_name=pharmacy)
        
        batches = query.limit(20).all()
        
        if not batches:
            click.echo('没有批次记录')
            return
        
        click.echo(f'{"批次号":<20} {"名称":<25} {"数据源":<15} {"药房":<12} {"总数":<6} {"操作人":<8} {"创建时间"}')
        click.echo('-' * 100)
        for b in batches:
            click.echo(f'{b.batch_no:<20} {(b.name or "")[:23]:<25} {b.source_type.value:<15} {b.pharmacy_name[:10]:<12} {b.total_records:<6} {b.operator:<8} {b.created_at.strftime("%m-%d %H:%M")}')
    
    finally:
        session.close()
