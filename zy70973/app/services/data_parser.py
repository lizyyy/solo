import pandas as pd
import json
import hashlib
from typing import List, Dict, Any, Tuple
from io import StringIO, BytesIO
from datetime import datetime

class DataParser:
    @staticmethod
    def parse_csv(content: bytes, encoding: str = 'utf-8') -> List[Dict[str, Any]]:
        try:
            content_str = content.decode(encoding)
        except UnicodeDecodeError:
            content_str = content.decode('gbk')
        
        df = pd.read_csv(StringIO(content_str), dtype=str)
        df = df.where(pd.notnull(df), None)
        records = df.to_dict('records')
        return [DataParser._normalize_keys(r) for r in records]
    
    @staticmethod
    def parse_json(content: bytes) -> List[Dict[str, Any]]:
        data = json.loads(content.decode('utf-8'))
        if isinstance(data, list):
            return [DataParser._normalize_keys(r) for r in data]
        elif isinstance(data, dict):
            return [DataParser._normalize_keys(data)]
        return []
    
    @staticmethod
    def _normalize_keys(record: Dict[str, Any]) -> Dict[str, Any]:
        key_mapping = {
            '手机号': 'phone',
            '电话': 'phone',
            '手机号码': 'phone',
            '姓名': 'name',
            '名字': 'name',
            '活动名称': 'activity_name',
            '活动': 'activity_name',
            '场次': 'activity_session',
            '活动场次': 'activity_session',
            '身份证': 'id_card',
            '身份证号': 'id_card',
            '报名时间': 'register_time',
            '签到时间': 'checkin_time',
            '候补时间': 'wait_time',
            '优先级': 'priority'
        }
        normalized = {}
        for k, v in record.items():
            new_key = key_mapping.get(k.strip(), k.strip().lower().replace(' ', '_'))
            normalized[new_key] = v
        return normalized
    
    @staticmethod
    def validate_record(record: Dict[str, Any], required_fields: List[str]) -> Tuple[bool, str]:
        missing = []
        for field in required_fields:
            if not record.get(field):
                missing.append(field)
        if missing:
            return False, f"缺少必填字段: {', '.join(missing)}"
        return True, ""
    
    @staticmethod
    def clean_phone(phone: str) -> str:
        if not phone:
            return ""
        return ''.join(filter(str.isdigit, str(phone)))
    
    @staticmethod
    def parse_datetime(date_str: str) -> datetime:
        if not date_str:
            return datetime.now()
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%m/%d/%Y %H:%M:%S',
            '%m/%d/%Y'
        ]
        for fmt in formats:
            try:
                return datetime.strptime(str(date_str).strip(), fmt)
            except ValueError:
                continue
        return datetime.now()
    
    @staticmethod
    def calculate_file_hash(content: bytes) -> str:
        return hashlib.md5(content).hexdigest()
