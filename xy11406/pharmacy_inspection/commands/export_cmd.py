import click
import pandas as pd
from ..database import get_session
from ..models import Batch, MedicineRecord, RecordStatus

@click.command()
@click.argument('output_path', type=click.Path())
@click.option('--batch-no', help='指定批次号')
@click.option('--status', 
              type=click.Choice(['all', 'valid', 'invalid', 'fixed', 'raw']),
              default='all',
              help='按状态筛选')
@click.option('--include-original', is_flag=True, help='包含原始行号和错误信息')
@click.option('--format', 'fmt', default='xlsx', 
              type=click.Choice(['xlsx', 'csv']),
              help='输出格式')
def export(output_path, batch_no, status, include_original, fmt):
    """导出修正后的数据"""
    session = get_session()
    
    try:
        query = session.query(MedicineRecord)
        
        if batch_no:
            batch = session.query(Batch).filter_by(batch_no=batch_no).first()
            if not batch:
                raise click.ClickException(f'批次不存在: {batch_no}')
            query = query.filter_by(batch_id=batch.id)
        
        if status != 'all':
            status_map = {
                'valid': RecordStatus.VALID,
                'invalid': RecordStatus.INVALID,
                'fixed': RecordStatus.FIXED,
                'raw': RecordStatus.RAW
            }
            query = query.filter_by(status=status_map[status])
        
        records = query.all()
        
        if not records:
            click.echo('没有可导出的数据')
            return
        
        data = []
        for r in records:
            row = {
                '药品编码': r.medicine_code,
                '药品名称': r.medicine_name,
                '规格': r.specification,
                '生产厂家': r.manufacturer,
                '批号': r.batch_number,
                '生产日期': str(r.production_date) if r.production_date else '',
                '有效期': str(r.expiry_date) if r.expiry_date else '',
                '数量': r.quantity,
                '单位': r.unit,
                '进价': r.purchase_price,
                '售价': r.selling_price,
                '供应商': r.supplier,
                '仓库': r.warehouse,
                '状态': r.status.value
            }
            if include_original:
                row['原始行号'] = r.original_line_no
                row['错误信息'] = r.check_errors or ''
                row['是否修正'] = '是' if r.is_fixed else '否'
                row['修正人'] = r.fixed_by or ''
            data.append(row)
        
        df = pd.DataFrame(data)
        
        if fmt == 'xlsx':
            if not output_path.endswith('.xlsx'):
                output_path += '.xlsx'
            df.to_excel(output_path, index=False, engine='openpyxl')
        else:
            if not output_path.endswith('.csv'):
                output_path += '.csv'
            df.to_csv(output_path, index=False, encoding='utf-8-sig')
        
        click.echo(f'已导出 {len(data)} 条记录到: {output_path}')
        
    finally:
        session.close()
