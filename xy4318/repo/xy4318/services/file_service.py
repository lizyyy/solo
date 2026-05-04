import os
import csv
import json
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.exc import IntegrityError
from extensions import db
from models import (
    ImportLog, TemperatureRecord, SampleTransfer, 
    AlarmRecord, ReviewNote
)
from config import Config

class FileService:
    @staticmethod
    def parse_datetime(dt_str: str) -> Optional[datetime]:
        if not dt_str or pd.isna(dt_str):
            return None
        
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M',
            '%d-%m-%Y %H:%M:%S',
            '%d/%m/%Y %H:%M:%S',
            '%Y-%m-%d',
            '%Y/%m/%d',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(str(dt_str).strip(), fmt)
            except (ValueError, TypeError):
                continue
        
        try:
            return pd.to_datetime(dt_str).to_pydatetime()
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def import_temperature_csv(file_path: str, batch_number: Optional[str] = None) -> Dict[str, Any]:
        result = {'success': False, 'count': 0, 'errors': [], 'log_id': None}
        
        try:
            df = pd.read_csv(file_path, encoding='utf-8-sig')
            df.columns = [col.strip().lower() for col in df.columns]
            
            import_log = ImportLog(
                file_type='temperature',
                file_name=os.path.basename(file_path)
            )
            db.session.add(import_log)
            db.session.flush()
            
            count = 0
            for idx, row in df.iterrows():
                try:
                    batch = batch_number if batch_number else str(row.get('batch_number', '') or row.get('batch', '') or '')
                    probe_id = str(row.get('probe_id', '') or row.get('probe', '') or row.get('sensor', '') or '')
                    location = str(row.get('location', '') or row.get('area', '') or '')
                    
                    temp_str = row.get('temperature', row.get('temp', ''))
                    if pd.isna(temp_str) or temp_str == '':
                        result['errors'].append(f"行 {idx+2}: 温度值为空")
                        continue
                    temperature = float(temp_str)
                    
                    record_time_str = row.get('record_time', row.get('time', row.get('timestamp', '')))
                    record_time = FileService.parse_datetime(record_time_str)
                    
                    if not record_time:
                        result['errors'].append(f"行 {idx+2}: 无法解析时间格式")
                        continue
                    
                    if not batch:
                        batch = 'UNKNOWN_BATCH'
                    
                    temp_record = TemperatureRecord(
                        batch_number=batch,
                        probe_id=probe_id,
                        location=location,
                        temperature=temperature,
                        record_time=record_time,
                        import_log_id=import_log.id
                    )
                    db.session.add(temp_record)
                    count += 1
                    
                except Exception as e:
                    result['errors'].append(f"行 {idx+2}: {str(e)}")
                    continue
            
            db.session.commit()
            import_log.record_count = count
            import_log.status = 'success'
            db.session.commit()
            
            result['success'] = True
            result['count'] = count
            result['log_id'] = import_log.id
            
        except Exception as e:
            db.session.rollback()
            result['errors'].append(f"导入失败: {str(e)}")
        
        return result
    
    @staticmethod
    def import_sample_transfer_json(file_path: str, batch_number: Optional[str] = None) -> Dict[str, Any]:
        result = {'success': False, 'count': 0, 'errors': [], 'log_id': None}
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, dict):
                if 'transfers' in data:
                    data = data['transfers']
                else:
                    data = [data]
            
            import_log = ImportLog(
                file_type='transfer',
                file_name=os.path.basename(file_path)
            )
            db.session.add(import_log)
            db.session.flush()
            
            count = 0
            for idx, item in enumerate(data):
                try:
                    batch = batch_number if batch_number else str(item.get('batch_number', '') or item.get('batch', '') or '')
                    sample_id = str(item.get('sample_id', '') or item.get('sample', '') or '')
                    sample_name = str(item.get('sample_name', '') or item.get('name', '') or '')
                    
                    from_loc = str(item.get('from_location', '') or item.get('from', '') or '')
                    to_loc = str(item.get('to_location', '') or item.get('to', '') or '')
                    
                    transfer_time_str = item.get('transfer_time', item.get('time', ''))
                    transfer_time = FileService.parse_datetime(transfer_time_str)
                    
                    if not transfer_time:
                        result['errors'].append(f"项目 {idx+1}: 无法解析时间格式")
                        continue
                    
                    if not sample_id:
                        result['errors'].append(f"项目 {idx+1}: 样本ID为空")
                        continue
                    
                    if not batch:
                        batch = 'UNKNOWN_BATCH'
                    
                    temp = item.get('temperature')
                    temperature = float(temp) if temp is not None and temp != '' else None
                    
                    transfer = SampleTransfer(
                        batch_number=batch,
                        sample_id=sample_id,
                        sample_name=sample_name,
                        from_location=from_loc,
                        to_location=to_loc,
                        transfer_time=transfer_time,
                        transfer_person=str(item.get('transfer_person', '') or item.get('person', '') or ''),
                        temperature=temperature,
                        status=str(item.get('status', '') or ''),
                        notes=str(item.get('notes', '') or item.get('comment', '') or ''),
                        import_log_id=import_log.id
                    )
                    db.session.add(transfer)
                    count += 1
                    
                except Exception as e:
                    result['errors'].append(f"项目 {idx+1}: {str(e)}")
                    continue
            
            db.session.commit()
            import_log.record_count = count
            import_log.status = 'success'
            db.session.commit()
            
            result['success'] = True
            result['count'] = count
            result['log_id'] = import_log.id
            
        except Exception as e:
            db.session.rollback()
            result['errors'].append(f"导入失败: {str(e)}")
        
        return result
    
    @staticmethod
    def import_alarm_csv(file_path: str, batch_number: Optional[str] = None) -> Dict[str, Any]:
        result = {'success': False, 'count': 0, 'errors': [], 'log_id': None}
        
        try:
            df = pd.read_csv(file_path, encoding='utf-8-sig')
            df.columns = [col.strip().lower() for col in df.columns]
            
            import_log = ImportLog(
                file_type='alarm',
                file_name=os.path.basename(file_path)
            )
            db.session.add(import_log)
            db.session.flush()
            
            count = 0
            for idx, row in df.iterrows():
                try:
                    batch = batch_number if batch_number else str(row.get('batch_number', '') or row.get('batch', '') or '')
                    probe_id = str(row.get('probe_id', '') or row.get('probe', '') or row.get('sensor', '') or '')
                    
                    if not probe_id:
                        result['errors'].append(f"行 {idx+2}: 探头ID为空")
                        continue
                    
                    start_time_str = row.get('start_time', row.get('start', row.get('time', '')))
                    start_time = FileService.parse_datetime(start_time_str)
                    
                    if not start_time:
                        result['errors'].append(f"行 {idx+2}: 无法解析开始时间")
                        continue
                    
                    end_time_str = row.get('end_time', row.get('end', ''))
                    end_time = FileService.parse_datetime(end_time_str)
                    
                    ack_time_str = row.get('ack_time', row.get('acknowledge_time', ''))
                    ack_time = FileService.parse_datetime(ack_time_str)
                    
                    temp_str = row.get('temperature', row.get('temp', ''))
                    temperature = float(temp_str) if temp_str and not pd.isna(temp_str) else None
                    
                    duration_str = row.get('duration_minutes', row.get('duration', ''))
                    duration_minutes = int(float(duration_str)) if duration_str and not pd.isna(duration_str) else None
                    
                    alarm = AlarmRecord(
                        batch_number=batch if batch else 'UNKNOWN_BATCH',
                        probe_id=probe_id,
                        location=str(row.get('location', '') or row.get('area', '') or ''),
                        alarm_type=str(row.get('alarm_type', '') or row.get('type', '') or ''),
                        alarm_level=str(row.get('alarm_level', '') or row.get('level', '') or ''),
                        temperature=temperature,
                        start_time=start_time,
                        end_time=end_time,
                        duration_minutes=duration_minutes,
                        ack_person=str(row.get('ack_person', '') or row.get('acknowledge_by', '') or ''),
                        ack_time=ack_time,
                        description=str(row.get('description', '') or row.get('desc', '') or ''),
                        import_log_id=import_log.id
                    )
                    db.session.add(alarm)
                    count += 1
                    
                except Exception as e:
                    result['errors'].append(f"行 {idx+2}: {str(e)}")
                    continue
            
            db.session.commit()
            import_log.record_count = count
            import_log.status = 'success'
            db.session.commit()
            
            result['success'] = True
            result['count'] = count
            result['log_id'] = import_log.id
            
        except Exception as e:
            db.session.rollback()
            result['errors'].append(f"导入失败: {str(e)}")
        
        return result
    
    @staticmethod
    def import_review_csv(file_path: str, batch_number: Optional[str] = None) -> Dict[str, Any]:
        result = {'success': False, 'count': 0, 'errors': [], 'log_id': None}
        
        try:
            df = pd.read_csv(file_path, encoding='utf-8-sig')
            df.columns = [col.strip().lower() for col in df.columns]
            
            import_log = ImportLog(
                file_type='review',
                file_name=os.path.basename(file_path)
            )
            db.session.add(import_log)
            db.session.flush()
            
            count = 0
            for idx, row in df.iterrows():
                try:
                    batch = batch_number if batch_number else str(row.get('batch_number', '') or row.get('batch', '') or '')
                    sample_id = str(row.get('sample_id', '') or row.get('sample', '') or '')
                    
                    review_time_str = row.get('review_time', row.get('time', ''))
                    review_time = FileService.parse_datetime(review_time_str)
                    
                    review = ReviewNote(
                        batch_number=batch if batch else 'UNKNOWN_BATCH',
                        sample_id=sample_id,
                        review_time=review_time,
                        reviewer=str(row.get('reviewer', '') or row.get('person', '') or ''),
                        temperature_check=str(row.get('temperature_check', '') or row.get('temp_check', '') or ''),
                        packaging_check=str(row.get('packaging_check', '') or row.get('pack_check', '') or ''),
                        documentation_check=str(row.get('documentation_check', '') or row.get('doc_check', '') or ''),
                        overall_status=str(row.get('overall_status', '') or row.get('status', '') or ''),
                        comments=str(row.get('comments', '') or row.get('note', '') or ''),
                        import_log_id=import_log.id
                    )
                    db.session.add(review)
                    count += 1
                    
                except Exception as e:
                    result['errors'].append(f"行 {idx+2}: {str(e)}")
                    continue
            
            db.session.commit()
            import_log.record_count = count
            import_log.status = 'success'
            db.session.commit()
            
            result['success'] = True
            result['count'] = count
            result['log_id'] = import_log.id
            
        except Exception as e:
            db.session.rollback()
            result['errors'].append(f"导入失败: {str(e)}")
        
        return result
    
    @staticmethod
    def get_import_history() -> List[Dict]:
        logs = ImportLog.query.order_by(ImportLog.import_time.desc()).all()
        return [
            {
                'id': log.id,
                'file_type': log.file_type,
                'file_name': log.file_name,
                'import_time': log.import_time.isoformat() if log.import_time else None,
                'record_count': log.record_count,
                'status': log.status
            }
            for log in logs
        ]
    
    @staticmethod
    def get_batch_numbers() -> List[str]:
        batches = set()
        batches.update([t.batch_number for t in TemperatureRecord.query.with_entities(TemperatureRecord.batch_number).distinct()])
        batches.update([t.batch_number for t in SampleTransfer.query.with_entities(SampleTransfer.batch_number).distinct()])
        batches.update([a.batch_number for a in AlarmRecord.query.with_entities(AlarmRecord.batch_number).distinct()])
        return sorted(list(batches))
