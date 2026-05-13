import csv
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Tuple
from dateutil import parser as date_parser

from database import Database
from config import get_config


class Importer:
    def __init__(self, db: Database = None):
        self.db = db or Database()
        self.config = get_config()

    def import_from_csv(self, file_path: str, source: str, imported_by: str = "system") -> Dict[str, Any]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        records = self._read_csv(file_path)
        return self._process_import(records, source, file_path, imported_by)

    def import_from_json(self, file_path: str, source: str, imported_by: str = "system") -> Dict[str, Any]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        with open(file_path, 'r', encoding='utf-8') as f:
            records = json.load(f)

        return self._process_import(records, source, file_path, imported_by)

    def _read_csv(self, file_path: str) -> List[Dict[str, Any]]:
        records = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append(self._normalize_row(row))
        return records

    def _normalize_row(self, row: Dict[str, str]) -> Dict[str, Any]:
        def get_value(*keys):
            for key in keys:
                if key in row and row[key]:
                    return row[key]
            return None

        normalized = {
            'member_id': get_value('member_id', '会员ID', 'user_id'),
            'name': get_value('name', '姓名', 'member_name'),
            'phone': get_value('phone', '手机号', 'mobile'),
            'email': get_value('email', '邮箱'),
            'join_date': get_value('join_date', '加入日期', '注册日期'),
            'tag_name': get_value('tag_name', '标签', 'tag'),
            'reason': get_value('reason', '原因', 'remark', '备注'),
            'start_date': get_value('start_date', '开始日期', '生效日期'),
            'end_date': get_value('end_date', '结束日期', '失效日期'),
        }
        return {k: v for k, v in normalized.items() if v is not None}

    def _process_import(self, records: List[Dict[str, Any]], source: str, 
                        file_path: str, imported_by: str) -> Dict[str, Any]:
        source_display_name = self.config.get_source_display_name(source)
        
        members = {}
        tags = []
        warnings = []

        for record in records:
            member_id = record.get('member_id')
            if not member_id:
                warnings.append(f"跳过记录: 缺少会员ID")
                continue

            if member_id not in members:
                members[member_id] = {
                    'member_id': member_id,
                    'name': record.get('name'),
                    'phone': record.get('phone'),
                    'email': record.get('email'),
                    'join_date': record.get('join_date'),
                }

            tag_name = record.get('tag_name')
            if tag_name:
                tag_data = {
                    'member_id': member_id,
                    'tag_name': tag_name,
                    'source': source,
                    'source_display_name': source_display_name,
                    'reason': record.get('reason'),
                    'start_date': self._parse_date(record.get('start_date')),
                    'end_date': self._parse_date(record.get('end_date')),
                }
                
                if self.config.requires_reason(tag_name) and not tag_data['reason']:
                    warnings.append(f"会员 {member_id} 标签 '{tag_name}' 缺少原因（需要人工标签）")
                
                reappearances = self.db.check_reappearance(member_id, tag_name, source)
                if reappearances:
                    warnings.append(f"会员 {member_id} 标签 '{tag_name}' 已清洗过，再次出现（复发）")
                
                tags.append(tag_data)

        batch_id = self.db.create_batch(source, file_path, imported_by, len(records))
        
        imported_members = 0
        imported_tags = 0
        duplicate_tags = 0

        for member_data in members.values():
            self.db.import_member(member_data)
            imported_members += 1

        for tag_data in tags:
            tag_id = self.db.import_tag(tag_data, batch_id)
            existing_tag = self.db.get_tag_by_id(tag_id)
            if existing_tag and existing_tag['import_batch_id'] != batch_id:
                duplicate_tags += 1
            else:
                imported_tags += 1

        return {
            'batch_id': batch_id,
            'imported_members': imported_members,
            'imported_tags': imported_tags,
            'duplicate_tags': duplicate_tags,
            'warnings': warnings,
            'source': source,
            'imported_by': imported_by,
            'file_name': file_path,
        }

    def _parse_date(self, date_str: str) -> str:
        if not date_str:
            return None
        try:
            dt = date_parser.parse(date_str)
            return dt.strftime('%Y-%m-%d')
        except Exception:
            return date_str


_db_instance = None


def get_db() -> Database:
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    return _db_instance
