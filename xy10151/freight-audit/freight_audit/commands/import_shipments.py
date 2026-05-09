import os
import csv
import uuid
import click
import sqlite3
from datetime import datetime
from typing import Dict, List, Any, Tuple

from freight_audit.context import pass_ctx
from freight_audit.database import get_connection_dict, now_timestamp


def parse_csv(file_path: str, encoding: str, delimiter: str) -> List[Dict]:
    records = []
    with open(file_path, 'r', encoding=encoding) as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        for row in reader:
            records.append({k: v.strip() if v else None for k, v in row.items()})
    return records


def validate_record(record: Dict, line_num: int) -> Tuple[bool, List[str]]:
    errors = []
    
    if not record.get('shipment_no'):
        errors.append(f'shipment_no 不能为空')
    
    version = record.get('version')
    if version is None or version == '':
        errors.append(f'version 不能为空')
    else:
        try:
            v = int(version)
            if v < 1:
                errors.append(f'version 必须 >= 1')
        except ValueError:
            errors.append(f'version 必须是整数')
    
    numeric_fields = ['weight', 'original_weight', 'freight_fee', 'standard_fee']
    for field in numeric_fields:
        val = record.get(field)
        if val is not None and val != '':
            try:
                float(val)
            except ValueError:
                errors.append(f'{field} 必须是数字')
    
    return len(errors) == 0, errors


def parse_record(record: Dict) -> Dict:
    parsed = {}
    
    parsed['shipment_no'] = record.get('shipment_no', '').strip()
    parsed['version'] = int(record.get('version', 1))
    
    for field in ['weight', 'original_weight', 'freight_fee', 'standard_fee']:
        val = record.get(field)
        if val is not None and val != '':
            parsed[field] = float(val)
        else:
            parsed[field] = None
    
    for field in ['route', 'original_route', 'shipper', 'receiver']:
        val = record.get(field)
        parsed[field] = val.strip() if val else None
    
    return parsed


def compare_versions(old: Dict, new: Dict, tracked_fields: List[str]) -> List[Dict]:
    changes = []
    
    for field in tracked_fields:
        old_val = old.get(field)
        new_val = new.get(field)
        
        if old_val != new_val:
            changes.append({
                'field': field,
                'old': old_val,
                'new': new_val,
            })
    
    return changes


@click.command('import-shipments')
@click.argument('file_path', type=click.Path(exists=True, readable=True))
@click.option('--batch', '-b', default=None, help='批次名称，自动生成如未指定')
@click.option('--encoding', '-e', default='utf-8', help='文件编码，默认 utf-8')
@click.option('--delimiter', '-d', default=',', help='CSV 分隔符，默认逗号')
@pass_ctx
def import_shipments(ctx, file_path, batch, encoding, delimiter):
    """导入物流单数据，支持幂等导入和坏数据留痕"""
    project_dir = ctx.project_dir
    config = ctx.config
    import_config = config.get('import', {})
    audit_config = config.get('audit', {})
    tracked_fields = audit_config.get('tracked_fields', ['weight', 'original_weight', 'route', 'original_route', 'freight_fee'])
    
    if not batch:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        batch = f'batch_{timestamp}'
    
    click.echo(f'导入文件: {file_path}')
    click.echo(f'批次名称: {batch}')
    click.echo(f'编码: {encoding}')
    click.echo('=' * 60)
    
    try:
        records = parse_csv(file_path, encoding, delimiter)
    except Exception as e:
        click.echo(f'[错误] 读取文件失败: {e}')
        return
    
    if not records:
        click.echo('[警告] 文件为空或格式错误')
        return
    
    click.echo(f'读取到 {len(records)} 条记录')
    click.echo('-' * 60)
    
    conn = get_connection_dict(project_dir)
    cursor = conn.cursor()
    
    stats = {
        'total': len(records),
        'new': 0,
        'updated': 0,
        'duplicate': 0,
        'bad': 0,
        'changes': 0,
    }
    
    bad_records = []
    
    for idx, raw_record in enumerate(records, start=2):
        line_num = idx
        
        is_valid, errors = validate_record(raw_record, line_num)
        
        if not is_valid:
            stats['bad'] += 1
            bad_records.append({
                'source_file': os.path.basename(file_path),
                'line_number': line_num,
                'raw_data': str(raw_record),
                'error_type': 'validation_error',
                'error_message': '; '.join(errors),
                'import_batch': batch,
                'import_time': now_timestamp(),
            })
            continue
        
        try:
            parsed = parse_record(raw_record)
        except Exception as e:
            stats['bad'] += 1
            bad_records.append({
                'source_file': os.path.basename(file_path),
                'line_number': line_num,
                'raw_data': str(raw_record),
                'error_type': 'parse_error',
                'error_message': str(e),
                'import_batch': batch,
                'import_time': now_timestamp(),
            })
            continue
        
        shipment_no = parsed['shipment_no']
        version = parsed['version']
        
        cursor.execute(
            'SELECT * FROM shipments WHERE shipment_no = ? AND version = ?',
            (shipment_no, version)
        )
        existing = cursor.fetchone()
        
        if existing:
            stats['duplicate'] += 1
            continue
        
        cursor.execute(
            'SELECT * FROM shipments WHERE shipment_no = ? ORDER BY version DESC LIMIT 1',
            (shipment_no,)
        )
        prev_version = cursor.fetchone()
        
        cursor.execute(
            '''INSERT INTO shipments 
               (shipment_no, version, weight, original_weight, route, original_route, 
                freight_fee, standard_fee, shipper, receiver, import_batch, import_time, update_time)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (
                parsed['shipment_no'], parsed['version'],
                parsed['weight'], parsed['original_weight'],
                parsed['route'], parsed['original_route'],
                parsed['freight_fee'], parsed['standard_fee'],
                parsed['shipper'], parsed['receiver'],
                batch, now_timestamp(), now_timestamp(),
            )
        )
        
        if prev_version is None:
            stats['new'] += 1
        else:
            stats['updated'] += 1
            changes = compare_versions(prev_version, parsed, tracked_fields)
            
            if changes:
                stats['changes'] += len(changes)
                for change in changes:
                    cursor.execute(
                        '''INSERT INTO shipment_changelog 
                           (shipment_no, version, change_type, field_changed, 
                            old_value, new_value, change_time, import_batch)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                        (
                            shipment_no, version, 'update', change['field'],
                            str(change['old']), str(change['new']),
                            now_timestamp(), batch,
                        )
                    )
    
    if bad_records:
        for br in bad_records:
            cursor.execute(
                '''INSERT INTO bad_records 
                   (source_file, line_number, raw_data, error_type, 
                    error_message, import_batch, import_time)
                   VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (
                    br['source_file'], br['line_number'], br['raw_data'],
                    br['error_type'], br['error_message'],
                    br['import_batch'], br['import_time'],
                )
            )
    
    conn.commit()
    conn.close()
    
    click.echo(f'[新增] {stats["new"]} 条新物流单')
    click.echo(f'[更新] {stats["updated"]} 条物流单 (新版本)')
    click.echo(f'[变更] {stats["changes"]} 个字段变更已记录')
    click.echo(f'[跳过] {stats["duplicate"]} 条重复记录 (相同 shipment_no + version)')
    click.echo(f'[错误] {stats["bad"]} 条坏数据已留痕')
    click.echo('=' * 60)
    
    if stats['bad'] > 0:
        click.echo(f'坏数据详情:')
        for br in bad_records:
            click.echo(f'  第 {br["line_number"]} 行: {br["error_message"]}')
        click.echo('-' * 60)
    
    click.echo(f'导入完成，批次: {batch}')
    click.echo('')
    click.echo('下一步:')
    click.echo('  运行: freight-audit audit')
