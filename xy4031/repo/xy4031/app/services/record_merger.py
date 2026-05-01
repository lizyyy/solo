import hashlib
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import ChargeRecord, FlightRecord, CellVoltageReading, QuarantineRecord
from app.services.csv_parser import CSVParseError


class RecordMerger:
    @staticmethod
    def generate_unique_hash(record_data: Dict[str, Any], record_type: str) -> str:
        key_fields = {
            'charge': ['battery_id', 'charge_start_time', 'charge_end_time', 'cycle_count'],
            'flight': ['battery_id', 'flight_date', 'cycle_count', 'start_voltage', 'end_voltage'],
            'voltage': ['battery_id', 'reading_time', 'total_voltage'],
        }
        
        fields = key_fields.get(record_type, ['battery_id'])
        
        hash_components = []
        for field in fields:
            value = record_data.get(field)
            if value is not None:
                if isinstance(value, datetime):
                    hash_components.append(value.isoformat())
                else:
                    hash_components.append(str(value))
        
        hash_input = f"{record_type}:{'|'.join(hash_components)}"
        return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
    
    @staticmethod
    def check_duplicate(db: Session, record_hash: str, record_type: str) -> bool:
        if record_type == 'charge':
            return db.query(ChargeRecord).filter(ChargeRecord.import_hash == record_hash).first() is not None
        elif record_type == 'flight':
            return db.query(FlightRecord).filter(FlightRecord.import_hash == record_hash).first() is not None
        elif record_type == 'voltage':
            return db.query(CellVoltageReading).filter(CellVoltageReading.import_hash == record_hash).first() is not None
        return False
    
    @staticmethod
    def check_time_order(records: List[Dict[str, Any]], time_field: str) -> List[Tuple[int, str, str]]:
        issues = []
        
        sorted_records = sorted(
            enumerate(records),
            key=lambda x: x[1].get(time_field) or datetime.min
        )
        
        prev_time = None
        for original_idx, record in sorted_records:
            current_time = record.get(time_field)
            if current_time and prev_time and current_time < prev_time:
                issues.append((
                    original_idx,
                    "time_out_of_order",
                    f"记录时间倒序: 当前 {current_time} 早于前一条 {prev_time}"
                ))
            prev_time = current_time
        
        return issues
    
    @staticmethod
    def check_cycle_jumps(
        records: List[Dict[str, Any]], 
        battery_id: str,
        max_jump: int = 5
    ) -> List[Tuple[int, str, str]]:
        issues = []
        
        time_field_map = {
            'charge': 'charge_start_time',
            'flight': 'flight_date',
            'voltage': 'reading_time'
        }
        
        record_type = None
        for rt, tf in time_field_map.items():
            if any(tf in r for r in records):
                record_type = rt
                break
        
        time_field = time_field_map.get(record_type)
        if not time_field:
            return issues
        
        valid_records = [
            (i, r) for i, r in enumerate(records)
            if r.get('cycle_count') is not None and r.get(time_field) is not None
        ]
        
        sorted_records = sorted(
            valid_records,
            key=lambda x: x[1].get(time_field)
        )
        
        prev_cycle = None
        for original_idx, record in sorted_records:
            current_cycle = record.get('cycle_count')
            if current_cycle is not None and prev_cycle is not None:
                jump = abs(current_cycle - prev_cycle)
                if jump > max_jump:
                    issues.append((
                        original_idx,
                        "cycle_jump_detected",
                        f"循环次数跳变: {prev_cycle} -> {current_cycle} (跳变 {jump} > {max_jump})"
                    ))
            prev_cycle = current_cycle
        
        return issues
    
    @staticmethod
    def check_cell_voltage_diff(
        records: List[Dict[str, Any]],
        max_diff: float = 0.05
    ) -> List[Tuple[int, str, str]]:
        issues = []
        
        for idx, record in enumerate(records):
            voltage_diff = record.get('voltage_diff')
            if voltage_diff is not None and voltage_diff > max_diff:
                max_cell = record.get('max_cell_voltage')
                min_cell = record.get('min_cell_voltage')
                issues.append((
                    idx,
                    "cell_voltage_diff_too_large",
                    f"单体压差过大: {voltage_diff:.3f}V > {max_diff}V (最高:{max_cell}V, 最低:{min_cell}V)"
                ))
        
        return issues
    
    @staticmethod
    def group_by_battery(records: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        grouped = defaultdict(list)
        for record in records:
            battery_id = record.get('battery_id')
            if battery_id:
                grouped[battery_id].append(record)
        return dict(grouped)
    
    @staticmethod
    def merge_records(
        existing: Dict[str, Any],
        new: Dict[str, Any]
    ) -> Dict[str, Any]:
        merged = {**existing}
        
        for key, value in new.items():
            if key == 'raw_row':
                continue
            if value is not None and (key not in merged or merged[key] is None):
                merged[key] = value
        
        return merged


class QuarantineService:
    @staticmethod
    def add_to_quarantine(
        db: Session,
        import_session_id: str,
        source_type: str,
        source_file: str,
        row_number: int,
        raw_data: Dict[str, Any],
        error_type: str,
        error_message: str,
        battery_id_extracted: str = None,
        timestamp_extracted: datetime = None
    ) -> QuarantineRecord:
        quarantine_record = QuarantineRecord(
            import_session_id=import_session_id,
            source_type=source_type,
            source_file=source_file,
            row_number=row_number,
            raw_data=json.dumps(raw_data, ensure_ascii=False, default=str),
            error_type=error_type,
            error_message=error_message,
            battery_id_extracted=battery_id_extracted,
            timestamp_extracted=timestamp_extracted,
            is_resolved=False,
            created_at=datetime.utcnow()
        )
        
        db.add(quarantine_record)
        db.commit()
        db.refresh(quarantine_record)
        
        return quarantine_record
    
    @staticmethod
    def add_parse_error_to_quarantine(
        db: Session,
        import_session_id: str,
        source_type: str,
        source_file: str,
        error: CSVParseError
    ) -> QuarantineRecord:
        battery_id = None
        timestamp = None
        
        if error.row_data:
            battery_id = error.row_data.get('battery_id')
            for key in ['charge_start_time', 'flight_date', 'reading_time', 'time', '日期']:
                if key in error.row_data:
                    from app.services.csv_parser import BaseCSVParser
                    timestamp = BaseCSVParser.parse_datetime(error.row_data[key])
                    if timestamp:
                        break
        
        return QuarantineService.add_to_quarantine(
            db=db,
            import_session_id=import_session_id,
            source_type=source_type,
            source_file=source_file,
            row_number=error.row_number,
            raw_data=error.row_data,
            error_type=error.error_type,
            error_message=error.message,
            battery_id_extracted=battery_id,
            timestamp_extracted=timestamp
        )
    
    @staticmethod
    def get_quarantine_records(
        db: Session,
        import_session_id: str = None,
        battery_id: str = None,
        error_type: str = None,
        is_resolved: bool = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[QuarantineRecord]:
        query = db.query(QuarantineRecord)
        
        if import_session_id:
            query = query.filter(QuarantineRecord.import_session_id == import_session_id)
        if battery_id:
            query = query.filter(QuarantineRecord.battery_id_extracted == battery_id)
        if error_type:
            query = query.filter(QuarantineRecord.error_type == error_type)
        if is_resolved is not None:
            query = query.filter(QuarantineRecord.is_resolved == is_resolved)
        
        return query.order_by(QuarantineRecord.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_quarantine_record(db: Session, record_id: int) -> Optional[QuarantineRecord]:
        return db.query(QuarantineRecord).filter(QuarantineRecord.id == record_id).first()
    
    @staticmethod
    def resolve_quarantine_record(
        db: Session,
        record_id: int,
        resolution_note: str = None
    ) -> Optional[QuarantineRecord]:
        record = db.query(QuarantineRecord).filter(QuarantineRecord.id == record_id).first()
        if record:
            record.is_resolved = True
            record.resolution_note = resolution_note
            record.resolved_at = datetime.utcnow()
            db.commit()
            db.refresh(record)
        return record
    
    @staticmethod
    def count_quarantine_records(
        db: Session,
        import_session_id: str = None,
        battery_id: str = None,
        error_type: str = None,
        is_resolved: bool = None
    ) -> int:
        query = db.query(QuarantineRecord)
        
        if import_session_id:
            query = query.filter(QuarantineRecord.import_session_id == import_session_id)
        if battery_id:
            query = query.filter(QuarantineRecord.battery_id_extracted == battery_id)
        if error_type:
            query = query.filter(QuarantineRecord.error_type == error_type)
        if is_resolved is not None:
            query = query.filter(QuarantineRecord.is_resolved == is_resolved)
        
        return query.count()
