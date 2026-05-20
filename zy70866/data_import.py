import csv
import json
import re
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from models import Database, WashingRecord, RecoveryRecord, RoomConfig


class CSVParser:
    @staticmethod
    def parse_washing_csv(file_path: str) -> List[Dict]:
        records = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = {
                    'batch_no': row.get('批次号', '').strip(),
                    'send_date': CSVParser._parse_date(row.get('送洗日期', '')),
                    'linen_type': row.get('布草类型', '').strip(),
                    'quantity': int(row.get('数量', 0) or 0),
                    'unit_price': float(row.get('单价', 0) or 0),
                    'hotel_remark': row.get('酒店备注', '').strip(),
                    'factory_remark': row.get('工厂备注', '').strip()
                }
                records.append(record)
        return records

    @staticmethod
    def parse_room_config_csv(file_path: str) -> List[Dict]:
        configs = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                config = {
                    'room_type': row.get('房型', '').strip(),
                    'linen_type': row.get('布草类型', '').strip(),
                    'quantity': int(row.get('数量', 0) or 0),
                    'unit_price': float(row.get('单价', 0) or 0)
                }
                configs.append(config)
        return configs

    @staticmethod
    def _parse_date(date_str: str) -> str:
        date_str = date_str.strip()
        if not date_str:
            return datetime.now().strftime('%Y-%m-%d')
        patterns = [
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%m/%d/%Y',
            '%d-%m-%Y',
            '%Y%m%d'
        ]
        for pattern in patterns:
            try:
                return datetime.strptime(date_str, pattern).strftime('%Y-%m-%d')
            except ValueError:
                continue
        return datetime.now().strftime('%Y-%m-%d')


class JSONParser:
    @staticmethod
    def parse_recovery_json(file_path: str) -> List[Dict]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        records = []
        if isinstance(data, list):
            for item in data:
                record = JSONParser._parse_recovery_item(item)
                if record:
                    records.append(record)
        elif isinstance(data, dict):
            if 'data' in data and isinstance(data['data'], list):
                for item in data['data']:
                    record = JSONParser._parse_recovery_item(item)
                    if record:
                        records.append(record)
            else:
                record = JSONParser._parse_recovery_item(data)
                if record:
                    records.append(record)
        return records

    @staticmethod
    def _parse_recovery_item(item: Dict) -> Optional[Dict]:
        recovery_no = item.get('回收单号', item.get('recovery_no', '')).strip()
        recovery_date = item.get('回收日期', item.get('recovery_date', ''))
        recovery_date = CSVParser._parse_date(recovery_date)
        linen_type = item.get('布草类型', item.get('linen_type', '')).strip()
        clean_quantity = int(item.get('干净数量', item.get('clean_quantity', 0)) or 0)
        damaged_quantity = int(item.get('破损数量', item.get('damaged_quantity', 0)) or 0)
        lost_quantity = int(item.get('丢失数量', item.get('lost_quantity', 0)) or 0)
        damage_reason = item.get('破损原因', item.get('damage_reason', '')).strip()
        if not recovery_no or not linen_type:
            return None
        return {
            'recovery_no': recovery_no,
            'recovery_date': recovery_date,
            'linen_type': linen_type,
            'clean_quantity': clean_quantity,
            'damaged_quantity': damaged_quantity,
            'lost_quantity': lost_quantity,
            'damage_reason': damage_reason
        }


class DataImporter:
    def __init__(self, db: Database):
        self.db = db
        self.washing_record = WashingRecord(db)
        self.recovery_record = RecoveryRecord(db)
        self.room_config = RoomConfig(db)

    def import_washing_csv(self, file_path: str) -> Tuple[int, int, List[str]]:
        records = CSVParser.parse_washing_csv(file_path)
        success_count = 0
        error_count = 0
        errors = []
        for record in records:
            try:
                self.washing_record.add_record(
                    batch_no=record['batch_no'],
                    send_date=record['send_date'],
                    linen_type=record['linen_type'],
                    quantity=record['quantity'],
                    unit_price=record['unit_price'],
                    hotel_remark=record['hotel_remark'],
                    factory_remark=record['factory_remark']
                )
                success_count += 1
            except Exception as e:
                error_count += 1
                errors.append(f"批次 {record['batch_no']}: {str(e)}")
        return success_count, error_count, errors

    def import_recovery_json(self, file_path: str) -> Tuple[int, int, List[str]]:
        records = JSONParser.parse_recovery_json(file_path)
        success_count = 0
        error_count = 0
        errors = []
        for record in records:
            try:
                self.recovery_record.add_record(
                    recovery_no=record['recovery_no'],
                    recovery_date=record['recovery_date'],
                    linen_type=record['linen_type'],
                    clean_quantity=record['clean_quantity'],
                    damaged_quantity=record['damaged_quantity'],
                    lost_quantity=record['lost_quantity'],
                    damage_reason=record['damage_reason']
                )
                success_count += 1
            except Exception as e:
                error_count += 1
                errors.append(f"回收单 {record['recovery_no']}: {str(e)}")
        return success_count, error_count, errors

    def import_room_config_csv(self, file_path: str) -> Tuple[int, int, List[str]]:
        configs = CSVParser.parse_room_config_csv(file_path)
        success_count = 0
        error_count = 0
        errors = []
        for config in configs:
            try:
                self.room_config.add_config(
                    room_type=config['room_type'],
                    linen_type=config['linen_type'],
                    quantity=config['quantity'],
                    unit_price=config['unit_price']
                )
                success_count += 1
            except Exception as e:
                error_count += 1
                errors.append(f"房型 {config['room_type']} - {config['linen_type']}: {str(e)}")
        return success_count, error_count, errors

    def detect_duplicate_washing(self) -> List[Dict]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT linen_type, send_date, COUNT(*) as count, GROUP_CONCAT(batch_no) as batches
            FROM washing_records
            GROUP BY linen_type, send_date
            HAVING count > 1
        ''')
        duplicates = cursor.fetchall()
        conn.close()
        return [dict(d) for d in duplicates]
