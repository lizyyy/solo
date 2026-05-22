import click
import os
import pandas as pd
from datetime import datetime
from ..database import get_session
from ..models import Batch, MedicineRecord, AuditLog, DataSourceType, ImportStrategy, OperationType, RecordStatus
from ..utils import generate_batch_no, generate_record_hash, parse_date, parse_int, parse_float, safe_str

COLUMN_MAPPING = {
    'medicine_code': ['药品编码', '货号', '编码', 'medicine_code', 'code'],
    'medicine_name': ['药品名称', '品名', '名称', 'medicine_name', 'name'],
    'specification': ['规格', '型号', 'specification', 'spec'],
    'manufacturer': ['生产厂家', '厂家', '生产商', 'manufacturer', 'producer'],
    'batch_number': ['批号', '批次号', 'batch_number', 'batch', 'lot'],
    'production_date': ['生产日期', '生产批号', 'production_date', 'prod_date'],
    'expiry_date': ['有效期', '到期日期', '失效日期', 'expiry_date', 'expire_date', 'valid_until'],
    'quantity': ['数量', '库存数量', 'quantity', 'qty', 'stock'],
    'unit': ['单位', '计量单位', 'unit'],
    'purchase_price': ['进价', '进货价', '采购价', 'purchase_price', 'cost_price'],
    'selling_price': ['售价', '零售价', '销售价', 'selling_price', 'retail_price', 'price'],
    'supplier': ['供应商', '供货商', 'supplier', 'vendor'],
    'warehouse': ['仓库', '库房', 'warehouse', 'storage'],
}

def map_columns(df_columns):
    mapping = {}
    df_cols_lower = {str(col).strip().lower(): col for col in df_columns}
    
    for target_field, possible_names in COLUMN_MAPPING.items():
        for name in possible_names:
            name_lower = name.lower()
            if name_lower in df_cols_lower:
                mapping[target_field] = df_cols_lower[name_lower]
                break
    return mapping

def read_data_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext in ['.xlsx', '.xls']:
        return pd.read_excel(file_path)
    elif ext == '.csv':
        return pd.read_csv(file_path)
    else:
        raise click.ClickException(f'不支持的文件格式: {ext}')

@click.command('import')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--source-type', required=True, 
              type=click.Choice(['inventory', 'transfer', 'return_photo', 'supplier_statement']),
              help='数据源类型: inventory(进销存), transfer(调拨单), return_photo(退货照片), supplier_statement(供应商对账单)')
@click.option('--strategy', default='append', 
              type=click.Choice(['ignore', 'overwrite', 'append']),
              help='导入策略: ignore(忽略重复), overwrite(覆盖), append(追加)')
@click.option('--pharmacy', required=True, help='药房名称')
@click.option('--operator', required=True, help='操作人')
@click.option('--name', help='批次名称')
@click.option('--remark', help='备注')
def import_cmd(file_path, source_type, strategy, pharmacy, operator, name, remark):
    """导入数据文件"""
    session = get_session()
    
    try:
        source_type_enum = DataSourceType(source_type)
        strategy_enum = ImportStrategy(strategy)
        
        df = read_data_file(file_path)
        column_mapping = map_columns(df.columns)
        
        if not column_mapping:
            raise click.ClickException('无法识别文件中的列名，请检查文件格式')
        
        batch_no = generate_batch_no()
        batch = Batch(
            batch_no=batch_no,
            name=name or os.path.basename(file_path),
            source_type=source_type_enum,
            strategy=strategy_enum,
            file_name=os.path.basename(file_path),
            pharmacy_name=pharmacy,
            operator=operator,
            total_records=len(df),
            remark=remark
        )
        session.add(batch)
        session.flush()
        
        records = []
        skipped_count = 0
        overwritten_count = 0
        
        with click.progressbar(df.iterrows(), length=len(df), label='导入中') as bar:
            for idx, row in bar:
                record_dict = {}
                for target_field, source_col in column_mapping.items():
                    record_dict[target_field] = row.get(source_col)
                
                record_hash = generate_record_hash({
                    k: v for k, v in record_dict.items() 
                    if k in ['medicine_code', 'batch_number', 'expiry_date']
                })
                
                if strategy_enum == ImportStrategy.IGNORE:
                    existing = session.query(MedicineRecord).filter_by(
                        source_type=source_type_enum,
                        original_hash=record_hash
                    ).first()
                    if existing:
                        skipped_count += 1
                        continue
                
                if strategy_enum == ImportStrategy.OVERWRITE:
                    existing = session.query(MedicineRecord).filter_by(
                        source_type=source_type_enum,
                        medicine_code=safe_str(record_dict.get('medicine_code')),
                        batch_number=safe_str(record_dict.get('batch_number'))
                    ).first()
                    if existing:
                        for field in COLUMN_MAPPING.keys():
                            if field in ['production_date', 'expiry_date']:
                                new_val = parse_date(record_dict.get(field))
                            elif field == 'quantity':
                                new_val = parse_int(record_dict.get(field))
                            elif field in ['purchase_price', 'selling_price']:
                                new_val = parse_float(record_dict.get(field))
                            else:
                                new_val = safe_str(record_dict.get(field))
                            
                            old_val = str(getattr(existing, field))
                            if str(new_val) != old_val:
                                audit = AuditLog(
                                    record_id=existing.id,
                                    operation_type=OperationType.UPDATE,
                                    operator=operator,
                                    field_name=field,
                                    old_value=old_val,
                                    new_value=str(new_val),
                                    change_reason='批量覆盖导入'
                                )
                                session.add(audit)
                                setattr(existing, field, new_val)
                        overwritten_count += 1
                        continue
                
                record = MedicineRecord(
                    batch_id=batch.id,
                    source_type=source_type_enum,
                    original_line_no=idx + 2,
                    original_hash=record_hash,
                    medicine_code=safe_str(record_dict.get('medicine_code')),
                    medicine_name=safe_str(record_dict.get('medicine_name')),
                    specification=safe_str(record_dict.get('specification')),
                    manufacturer=safe_str(record_dict.get('manufacturer')),
                    batch_number=safe_str(record_dict.get('batch_number')),
                    production_date=parse_date(record_dict.get('production_date')),
                    expiry_date=parse_date(record_dict.get('expiry_date')),
                    quantity=parse_int(record_dict.get('quantity')),
                    unit=safe_str(record_dict.get('unit')),
                    purchase_price=parse_float(record_dict.get('purchase_price')),
                    selling_price=parse_float(record_dict.get('selling_price')),
                    supplier=safe_str(record_dict.get('supplier')),
                    warehouse=safe_str(record_dict.get('warehouse')),
                    status=RecordStatus.RAW
                )
                records.append(record)
        
        session.bulk_save_objects(records)
        
        audit = AuditLog(
            batch_id=batch.id,
            operation_type=OperationType.IMPORT,
            operator=operator,
            change_reason=f'导入批次: {batch_no}, 策略: {strategy}'
        )
        session.add(audit)
        
        session.commit()
        
        click.echo(f'\n批次号: {batch_no}')
        click.echo(f'总记录数: {len(df)}')
        click.echo(f'新增: {len(records)}')
        if skipped_count > 0:
            click.echo(f'跳过(重复): {skipped_count}')
        if overwritten_count > 0:
            click.echo(f'覆盖: {overwritten_count}')
        click.echo('导入完成！')
        
    except Exception as e:
        session.rollback()
        raise click.ClickException(f'导入失败: {str(e)}')
    finally:
        session.close()
