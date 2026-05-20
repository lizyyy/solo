import hashlib
import json
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Tuple
from io import StringIO
from sqlalchemy.orm import Session

from app.models.models import Batch, CheckInRecord, LeaveRecord, LocationSummary
from app.models.models import RecordType, DataSource


def generate_batch_hash(content: str, record_type: RecordType) -> str:
    hash_input = f"{record_type}:{content}"
    return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()


def check_duplicate_batch(db: Session, batch_hash: str) -> bool:
    existing = db.query(Batch).filter(Batch.batch_hash == batch_hash).first()
    return existing is not None


def create_batch(db: Session, batch_hash: str, record_type: RecordType,
                 source: DataSource, total_records: int) -> Batch:
    batch = Batch(
        batch_hash=batch_hash,
        record_type=record_type,
        source=source,
        total_records=total_records,
        processed=False
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def parse_checkin_csv(csv_content: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    valid_records = []
    invalid_records = []
    
    try:
        df = pd.read_csv(StringIO(csv_content))
        
        required_columns = ['person_id']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise ValueError(f"CSV缺少必要列: {', '.join(missing_cols)}")
        
        for idx, row in df.iterrows():
            try:
                record = {
                    'person_id': str(row.get('person_id', '')).strip(),
                    'person_name': str(row.get('person_name', '')).strip() if pd.notna(row.get('person_name')) else None,
                    'location': str(row.get('location', '')).strip() if pd.notna(row.get('location')) else None,
                    'raw_data': json.dumps(row.to_dict(), ensure_ascii=False)
                }
                
                checkin_time_str = row.get('checkin_time')
                if pd.notna(checkin_time_str):
                    record['checkin_time'] = pd.to_datetime(checkin_time_str).to_pydatetime()
                
                scheduled_time_str = row.get('scheduled_time')
                if pd.notna(scheduled_time_str):
                    record['scheduled_time'] = pd.to_datetime(scheduled_time_str).to_pydatetime()
                
                if not record['person_id']:
                    invalid_records.append({
                        'row': idx + 2,
                        'data': row.to_dict(),
                        'error': 'person_id不能为空'
                    })
                    continue
                
                valid_records.append(record)
                
            except Exception as e:
                invalid_records.append({
                    'row': idx + 2,
                    'data': row.to_dict(),
                    'error': str(e)
                })
    
    except Exception as e:
        raise ValueError(f"CSV解析失败: {str(e)}")
    
    return valid_records, invalid_records


def parse_leave_json(json_content: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    valid_records = []
    invalid_records = []
    
    try:
        data = json.loads(json_content)
        
        if isinstance(data, dict):
            records = [data]
        elif isinstance(data, list):
            records = data
        else:
            raise ValueError("JSON格式必须是对象或数组")
        
        for idx, item in enumerate(records):
            try:
                person_id = str(item.get('person_id', '')).strip()
                if not person_id:
                    invalid_records.append({
                        'index': idx,
                        'data': item,
                        'error': 'person_id不能为空'
                    })
                    continue
                
                record = {
                    'person_id': person_id,
                    'person_name': str(item.get('person_name', '')).strip() if item.get('person_name') else None,
                    'reason': str(item.get('reason', '')).strip() if item.get('reason') else None,
                    'status': str(item.get('status', 'approved')).strip(),
                    'raw_data': json.dumps(item, ensure_ascii=False)
                }
                
                start_time_str = item.get('start_time')
                if start_time_str:
                    record['start_time'] = datetime.fromisoformat(str(start_time_str).replace('Z', '+00:00'))
                
                end_time_str = item.get('end_time')
                if end_time_str:
                    record['end_time'] = datetime.fromisoformat(str(end_time_str).replace('Z', '+00:00'))
                
                valid_records.append(record)
                
            except Exception as e:
                invalid_records.append({
                    'index': idx,
                    'data': item,
                    'error': str(e)
                })
    
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON解析失败: {str(e)}")
    
    return valid_records, invalid_records


def parse_location_summary(json_content: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    valid_records = []
    invalid_records = []
    
    try:
        data = json.loads(json_content)
        
        if isinstance(data, dict):
            records = [data]
        elif isinstance(data, list):
            records = data
        else:
            raise ValueError("JSON格式必须是对象或数组")
        
        for idx, item in enumerate(records):
            try:
                person_id = str(item.get('person_id', '')).strip()
                if not person_id:
                    invalid_records.append({
                        'index': idx,
                        'data': item,
                        'error': 'person_id不能为空'
                    })
                    continue
                
                record = {
                    'person_id': person_id,
                    'person_name': str(item.get('person_name', '')).strip() if item.get('person_name') else None,
                    'total_points': int(item.get('total_points', 0)),
                    'gap_count': int(item.get('gap_count', 0)),
                    'max_gap_minutes': float(item.get('max_gap_minutes', 0)),
                    'out_of_bounds': bool(item.get('out_of_bounds', False)),
                    'raw_data': json.dumps(item, ensure_ascii=False)
                }
                
                date_str = item.get('date')
                if date_str:
                    record['date'] = datetime.fromisoformat(str(date_str).replace('Z', '+00:00'))
                
                valid_records.append(record)
                
            except Exception as e:
                invalid_records.append({
                    'index': idx,
                    'data': item,
                    'error': str(e)
                })
    
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON解析失败: {str(e)}")
    
    return valid_records, invalid_records


def save_checkin_records(db: Session, records: List[Dict[str, Any]], source: DataSource = DataSource.OTHER) -> List[CheckInRecord]:
    saved = []
    for record in records:
        record_id = hashlib.md5(f"{record['person_id']}:{record.get('checkin_time', '')}".encode()).hexdigest()
        
        existing = db.query(CheckInRecord).filter(CheckInRecord.record_id == record_id).first()
        if existing:
            continue
        
        db_record = CheckInRecord(
            record_id=record_id,
            person_id=record['person_id'],
            person_name=record.get('person_name'),
            checkin_time=record.get('checkin_time'),
            scheduled_time=record.get('scheduled_time'),
            location=record.get('location'),
            source=source,
            raw_data=record.get('raw_data')
        )
        db.add(db_record)
        saved.append(db_record)
    
    db.commit()
    return saved


def save_leave_records(db: Session, records: List[Dict[str, Any]], source: DataSource = DataSource.OTHER) -> List[LeaveRecord]:
    saved = []
    for record in records:
        record_id = hashlib.md5(f"{record['person_id']}:{record.get('start_time', '')}:{record.get('end_time', '')}".encode()).hexdigest()
        
        existing = db.query(LeaveRecord).filter(LeaveRecord.record_id == record_id).first()
        if existing:
            continue
        
        db_record = LeaveRecord(
            record_id=record_id,
            person_id=record['person_id'],
            person_name=record.get('person_name'),
            start_time=record.get('start_time'),
            end_time=record.get('end_time'),
            reason=record.get('reason'),
            status=record.get('status', 'approved'),
            source=source,
            raw_data=record.get('raw_data')
        )
        db.add(db_record)
        saved.append(db_record)
    
    db.commit()
    return saved


def save_location_records(db: Session, records: List[Dict[str, Any]], source: DataSource = DataSource.OTHER) -> List[LocationSummary]:
    saved = []
    for record in records:
        record_id = hashlib.md5(f"{record['person_id']}:{record.get('date', '')}".encode()).hexdigest()
        
        existing = db.query(LocationSummary).filter(LocationSummary.record_id == record_id).first()
        if existing:
            continue
        
        db_record = LocationSummary(
            record_id=record_id,
            person_id=record['person_id'],
            person_name=record.get('person_name'),
            date=record.get('date'),
            total_points=record.get('total_points', 0),
            gap_count=record.get('gap_count', 0),
            max_gap_minutes=record.get('max_gap_minutes', 0.0),
            out_of_bounds=record.get('out_of_bounds', False),
            source=source,
            raw_data=record.get('raw_data')
        )
        db.add(db_record)
        saved.append(db_record)
    
    db.commit()
    return saved
