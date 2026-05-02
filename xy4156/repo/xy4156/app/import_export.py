import csv
import json
from io import StringIO
from datetime import datetime
from typing import List, Dict, Any, Tuple
from app import db
from app.models import (
    ReagentLedger, Batch, Bottle, Cabinet, WasteBucket, WasteRecord,
    DispenseRecord, TemperatureRecord, HazardClass, ReviewStatus, WasteStatus
)
from app.audit_log import AuditLogger


def parse_datetime(value: str) -> datetime:
    if not value:
        return datetime.utcnow()
    try:
        return datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
    except ValueError:
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return datetime.utcnow()


def parse_date(value: str):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        return None


class CSVImporter:
    @staticmethod
    def import_ledgers(csv_content: str, created_by: str = 'system') -> Tuple[int, List[str]]:
        f = StringIO(csv_content)
        reader = csv.DictReader(f)
        
        count = 0
        errors = []
        
        for row in reader:
            try:
                hazard_class_str = row.get('hazard_class', '普通试剂')
                try:
                    hazard_class = HazardClass(hazard_class_str)
                except ValueError:
                    hazard_class = HazardClass.ORDINARY
                
                ledger = ReagentLedger(
                    reagent_name=row.get('reagent_name', row.get('name', '未命名试剂')),
                    cas_number=row.get('cas_number'),
                    hazard_class=hazard_class,
                    hazard_details=row.get('hazard_details'),
                    incompatible_with=row.get('incompatible_with'),
                    is_low_temp=row.get('is_low_temp', 'false').lower() in ['true', '1', 'yes'],
                    min_temp=float(row['min_temp']) if row.get('min_temp') else None,
                    max_temp=float(row['max_temp']) if row.get('max_temp') else None
                )
                db.session.add(ledger)
                count += 1
            except Exception as e:
                errors.append(f"行{reader.line_num}: {str(e)}")
        
        if count > 0:
            db.session.commit()
            AuditLogger.log(
                action='IMPORT_DATA',
                resource_type='ReagentLedger',
                resource_id='batch_import',
                user_name=created_by,
                details=json.dumps({'count': count}, ensure_ascii=False)
            )
        
        return count, errors
    
    @staticmethod
    def import_batches(csv_content: str, created_by: str = 'system') -> Tuple[int, List[str]]:
        f = StringIO(csv_content)
        reader = csv.DictReader(f)
        
        count = 0
        errors = []
        
        for row in reader:
            try:
                ledger_name = row.get('reagent_name', row.get('ledger_name'))
                ledger = None
                if ledger_name:
                    ledger = ReagentLedger.query.filter_by(reagent_name=ledger_name).first()
                
                ledger_id = row.get('ledger_id')
                if ledger_id and not ledger:
                    ledger = ReagentLedger.query.get(int(ledger_id))
                
                if not ledger:
                    errors.append(f"行{reader.line_num}: 找不到对应的试剂台账")
                    continue
                
                total_volume = float(row.get('total_volume', 0))
                
                batch = Batch(
                    batch_number=row.get('batch_number', f"IMP-{datetime.utcnow().strftime('%Y%m%d')}-{count}"),
                    ledger_id=ledger.id,
                    total_volume=total_volume,
                    remaining_volume=total_volume,
                    unit=row.get('unit', 'mL'),
                    supplier=row.get('supplier'),
                    manufactured_date=parse_date(row.get('manufactured_date')),
                    expiry_date=parse_date(row.get('expiry_date'))
                )
                db.session.add(batch)
                count += 1
            except Exception as e:
                errors.append(f"行{reader.line_num}: {str(e)}")
        
        if count > 0:
            db.session.commit()
            AuditLogger.log(
                action='IMPORT_DATA',
                resource_type='Batch',
                resource_id='batch_import',
                user_name=created_by,
                details=json.dumps({'count': count}, ensure_ascii=False)
            )
        
        return count, errors
    
    @staticmethod
    def import_cabinets(csv_content: str, created_by: str = 'system') -> Tuple[int, List[str]]:
        f = StringIO(csv_content)
        reader = csv.DictReader(f)
        
        count = 0
        errors = []
        
        for row in reader:
            try:
                hazard_class_str = row.get('hazard_class')
                hazard_class = None
                if hazard_class_str:
                    try:
                        hazard_class = HazardClass(hazard_class_str)
                    except ValueError:
                        pass
                
                cabinet = Cabinet(
                    cabinet_code=row.get('cabinet_code', row.get('code', f"CAB-{count}")),
                    name=row.get('name', f"柜位-{count}"),
                    location=row.get('location'),
                    hazard_class=hazard_class,
                    is_low_temp=row.get('is_low_temp', 'false').lower() in ['true', '1', 'yes'],
                    min_temp=float(row['min_temp']) if row.get('min_temp') else None,
                    max_temp=float(row['max_temp']) if row.get('max_temp') else None
                )
                db.session.add(cabinet)
                count += 1
            except Exception as e:
                errors.append(f"行{reader.line_num}: {str(e)}")
        
        if count > 0:
            db.session.commit()
            AuditLogger.log(
                action='IMPORT_DATA',
                resource_type='Cabinet',
                resource_id='batch_import',
                user_name=created_by,
                details=json.dumps({'count': count}, ensure_ascii=False)
            )
        
        return count, errors
    
    @staticmethod
    def import_waste_buckets(csv_content: str, created_by: str = 'system') -> Tuple[int, List[str]]:
        f = StringIO(csv_content)
        reader = csv.DictReader(f)
        
        count = 0
        errors = []
        
        for row in reader:
            try:
                hazard_class_str = row.get('hazard_class')
                hazard_class = None
                if hazard_class_str:
                    try:
                        hazard_class = HazardClass(hazard_class_str)
                    except ValueError:
                        pass
                
                start_date = parse_date(row.get('start_date')) or datetime.utcnow().date()
                
                bucket = WasteBucket(
                    bucket_code=row.get('bucket_code', row.get('code', f"WB-{count}")),
                    waste_type=row.get('waste_type', row.get('type', '未知废液')),
                    hazard_class=hazard_class,
                    max_volume=float(row.get('max_volume', 20)),
                    current_volume=float(row.get('current_volume', 0)),
                    unit=row.get('unit', 'L'),
                    start_date=start_date,
                    expiry_days=int(row.get('expiry_days', 90)),
                    status=WasteStatus.ACTIVE
                )
                db.session.add(bucket)
                count += 1
            except Exception as e:
                errors.append(f"行{reader.line_num}: {str(e)}")
        
        if count > 0:
            db.session.commit()
            AuditLogger.log(
                action='IMPORT_DATA',
                resource_type='WasteBucket',
                resource_id='batch_import',
                user_name=created_by,
                details=json.dumps({'count': count}, ensure_ascii=False)
            )
        
        return count, errors
    
    @staticmethod
    def import_temperature_records(csv_content: str, created_by: str = 'system') -> Tuple[int, List[str]]:
        from app.rules import TemperatureRule
        
        f = StringIO(csv_content)
        reader = csv.DictReader(f)
        
        count = 0
        errors = []
        
        for row in reader:
            try:
                cabinet_code = row.get('cabinet_code')
                cabinet = Cabinet.query.filter_by(cabinet_code=cabinet_code).first()
                if not cabinet:
                    cabinet_id = row.get('cabinet_id')
                    if cabinet_id:
                        cabinet = Cabinet.query.get(int(cabinet_id))
                
                if not cabinet:
                    errors.append(f"行{reader.line_num}: 找不到对应的柜位")
                    continue
                
                temperature = float(row.get('temperature', 0))
                record_time = parse_datetime(row.get('record_time', row.get('time')))
                
                temp_check = TemperatureRule.check_temperature_range(cabinet, temperature, record_time)
                
                record = TemperatureRecord(
                    cabinet_id=cabinet.id,
                    temperature=temperature,
                    record_time=record_time,
                    is_alert=not temp_check.valid,
                    alert_reason=temp_check.message if not temp_check.valid else None
                )
                db.session.add(record)
                count += 1
            except Exception as e:
                errors.append(f"行{reader.line_num}: {str(e)}")
        
        if count > 0:
            db.session.commit()
            AuditLogger.log(
                action='IMPORT_DATA',
                resource_type='TemperatureRecord',
                resource_id='batch_import',
                user_name=created_by,
                details=json.dumps({'count': count}, ensure_ascii=False)
            )
        
        return count, errors


class JSONImporter:
    @staticmethod
    def import_ledgers(json_content: str, created_by: str = 'system') -> Tuple[int, List[str]]:
        data = json.loads(json_content)
        if isinstance(data, dict):
            data = [data]
        
        count = 0
        errors = []
        
        for idx, item in enumerate(data):
            try:
                hazard_class_str = item.get('hazard_class', '普通试剂')
                try:
                    hazard_class = HazardClass(hazard_class_str)
                except ValueError:
                    hazard_class = HazardClass.ORDINARY
                
                ledger = ReagentLedger(
                    reagent_name=item.get('reagent_name', item.get('name', '未命名试剂')),
                    cas_number=item.get('cas_number'),
                    hazard_class=hazard_class,
                    hazard_details=item.get('hazard_details'),
                    incompatible_with=item.get('incompatible_with'),
                    is_low_temp=item.get('is_low_temp', False),
                    min_temp=item.get('min_temp'),
                    max_temp=item.get('max_temp')
                )
                db.session.add(ledger)
                count += 1
            except Exception as e:
                errors.append(f"项{idx}: {str(e)}")
        
        if count > 0:
            db.session.commit()
            AuditLogger.log(
                action='IMPORT_DATA',
                resource_type='ReagentLedger',
                resource_id='batch_import',
                user_name=created_by,
                details=json.dumps({'count': count}, ensure_ascii=False)
            )
        
        return count, errors


class Exporter:
    @staticmethod
    def to_json(data: List[Dict]) -> str:
        return json.dumps(data, ensure_ascii=False, indent=2, default=str)
    
    @staticmethod
    def to_csv(data: List[Dict]) -> str:
        if not data:
            return ''
        
        output = StringIO()
        fieldnames = data[0].keys()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for row in data:
            writer.writerow(row)
        
        return output.getvalue()
    
    @staticmethod
    def to_markdown(data: List[Dict], title: str = '导出数据') -> str:
        if not data:
            return f'# {title}\n\n暂无数据\n'
        
        output = [f'# {title}\n']
        output.append(f'\n> 导出时间: {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")} UTC\n')
        output.append(f'> 数据条数: {len(data)}\n\n')
        
        headers = list(data[0].keys())
        
        output.append('| ' + ' | '.join(headers) + ' |')
        output.append('| ' + ' | '.join(['---'] * len(headers)) + ' |')
        
        for row in data:
            values = [str(row.get(h, '')) for h in headers]
            output.append('| ' + ' | '.join(values) + ' |')
        
        return '\n'.join(output) + '\n'
    
    @staticmethod
    def export_ledgers(format_type: str = 'json') -> Tuple[str, str]:
        ledgers = ReagentLedger.query.all()
        data = [{
            'id': l.id,
            'reagent_name': l.reagent_name,
            'cas_number': l.cas_number or '',
            'hazard_class': l.hazard_class.value if l.hazard_class else '',
            'hazard_details': l.hazard_details or '',
            'incompatible_with': l.incompatible_with or '',
            'is_low_temp': '是' if l.is_low_temp else '否',
            'min_temp': l.min_temp or '',
            'max_temp': l.max_temp or '',
            'created_at': l.created_at.strftime('%Y-%m-%d %H:%M:%S') if l.created_at else ''
        } for l in ledgers]
        
        if format_type == 'csv':
            return Exporter.to_csv(data), 'text/csv'
        elif format_type == 'markdown':
            return Exporter.to_markdown(data, '试剂台账导出'), 'text/markdown'
        return Exporter.to_json(data), 'application/json'
    
    @staticmethod
    def export_batches(format_type: str = 'json') -> Tuple[str, str]:
        batches = Batch.query.all()
        data = [{
            'id': b.id,
            'batch_number': b.batch_number,
            'reagent_name': b.ledger.reagent_name if b.ledger else '',
            'total_volume': b.total_volume,
            'remaining_volume': b.remaining_volume,
            'unit': b.unit,
            'supplier': b.supplier or '',
            'manufactured_date': b.manufactured_date.isoformat() if b.manufactured_date else '',
            'expiry_date': b.expiry_date.isoformat() if b.expiry_date else ''
        } for b in batches]
        
        if format_type == 'csv':
            return Exporter.to_csv(data), 'text/csv'
        elif format_type == 'markdown':
            return Exporter.to_markdown(data, '批次记录导出'), 'text/markdown'
        return Exporter.to_json(data), 'application/json'
    
    @staticmethod
    def export_dispense_records(format_type: str = 'json') -> Tuple[str, str]:
        records = DispenseRecord.query.all()
        data = [{
            'id': r.id,
            'record_id': r.record_id,
            'batch_number': r.batch.batch_number if r.batch else '',
            'reagent_name': r.batch.ledger.reagent_name if r.batch and r.batch.ledger else '',
            'dispensed_volume': r.dispensed_volume,
            'unit': r.unit,
            'experiment_name': r.experiment_name or '',
            'user_name': r.user_name or '',
            'dispense_time': r.dispense_time.strftime('%Y-%m-%d %H:%M:%S') if r.dispense_time else '',
            'review_status': r.review_status.value if r.review_status else '',
            'reviewed_by': r.reviewed_by or ''
        } for r in records]
        
        if format_type == 'csv':
            return Exporter.to_csv(data), 'text/csv'
        elif format_type == 'markdown':
            return Exporter.to_markdown(data, '分装记录导出'), 'text/markdown'
        return Exporter.to_json(data), 'application/json'
    
    @staticmethod
    def export_waste_records(format_type: str = 'json') -> Tuple[str, str]:
        records = WasteRecord.query.all()
        data = [{
            'id': r.id,
            'record_id': r.record_id,
            'bucket_code': r.bucket.bucket_code if r.bucket else '',
            'waste_name': r.waste_name or '',
            'volume': r.volume,
            'unit': r.unit,
            'user_name': r.user_name or '',
            'record_time': r.record_time.strftime('%Y-%m-%d %H:%M:%S') if r.record_time else '',
            'review_status': r.review_status.value if r.review_status else ''
        } for r in records]
        
        if format_type == 'csv':
            return Exporter.to_csv(data), 'text/csv'
        elif format_type == 'markdown':
            return Exporter.to_markdown(data, '废液记录导出'), 'text/markdown'
        return Exporter.to_json(data), 'application/json'
    
    @staticmethod
    def export_temperature_records(format_type: str = 'json') -> Tuple[str, str]:
        records = TemperatureRecord.query.all()
        data = [{
            'id': r.id,
            'cabinet_code': r.cabinet.cabinet_code if r.cabinet else '',
            'cabinet_name': r.cabinet.name if r.cabinet else '',
            'temperature': r.temperature,
            'record_time': r.record_time.strftime('%Y-%m-%d %H:%M:%S') if r.record_time else '',
            'is_alert': '是' if r.is_alert else '否',
            'alert_reason': r.alert_reason or ''
        } for r in records]
        
        if format_type == 'csv':
            return Exporter.to_csv(data), 'text/csv'
        elif format_type == 'markdown':
            return Exporter.to_markdown(data, '温度记录导出'), 'text/markdown'
        return Exporter.to_json(data), 'application/json'
