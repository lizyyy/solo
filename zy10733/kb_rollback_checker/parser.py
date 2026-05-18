import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List, TextIO
from .models import ArticleRollbackRecord, RollbackStatus


class LogParser:
    def __init__(self):
        self.supported_formats = ['json', 'csv', 'log']
    
    def parse_file(self, file_path: str) -> List[ArticleRollbackRecord]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"日志文件不存在: {file_path}")
        
        suffix = path.suffix.lower().lstrip('.')
        
        if suffix == 'json':
            return self._parse_json(path)
        elif suffix == 'csv':
            return self._parse_csv(path)
        elif suffix in ['log', 'txt']:
            return self._parse_plain_text(path)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")
    
    def _parse_json(self, path: Path) -> List[ArticleRollbackRecord]:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        records = []
        if isinstance(data, list):
            for item in data:
                record = self._dict_to_record(item)
                if record:
                    records.append(record)
        elif isinstance(data, dict):
            record = self._dict_to_record(data)
            if record:
                records.append(record)
        
        return records
    
    def _parse_csv(self, path: Path) -> List[ArticleRollbackRecord]:
        records = []
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = self._dict_to_record(row)
                if record:
                    records.append(record)
        return records
    
    def _parse_plain_text(self, path: Path) -> List[ArticleRollbackRecord]:
        records = []
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    record = self._dict_to_record(data)
                    if record:
                        records.append(record)
                except json.JSONDecodeError:
                    continue
        return records
    
    def _dict_to_record(self, data: dict) -> ArticleRollbackRecord:
        try:
            status_str = data.get('status', 'SUCCESS')
            status = RollbackStatus[status_str] if status_str in RollbackStatus.__members__ else RollbackStatus.FAILED
            
            publish_time = self._parse_datetime(data.get('publish_time', ''))
            rollback_time = self._parse_datetime(data.get('rollback_time', ''))
            
            attachments = data.get('attachments', [])
            if isinstance(attachments, str):
                attachments = [a.strip() for a in attachments.split(',') if a.strip()]
            
            rolled_back_attachments = data.get('rolled_back_attachments', [])
            if isinstance(rolled_back_attachments, str):
                rolled_back_attachments = [a.strip() for a in rolled_back_attachments.split(',') if a.strip()]
            
            processing_log = data.get('processing_log', [])
            if isinstance(processing_log, str):
                processing_log = [processing_log]
            
            return ArticleRollbackRecord(
                article_id=data.get('article_id', ''),
                article_title=data.get('article_title', ''),
                space_id=data.get('space_id', ''),
                space_name=data.get('space_name', ''),
                publish_time=publish_time,
                rollback_time=rollback_time,
                operator=data.get('operator', ''),
                rollback_version=data.get('rollback_version', ''),
                previous_version=data.get('previous_version', ''),
                status=status,
                error_message=data.get('error_message'),
                attachments=attachments,
                rolled_back_attachments=rolled_back_attachments,
                processing_log=processing_log
            )
        except Exception as e:
            return None
    
    def _parse_datetime(self, dt_str: str) -> datetime:
        if not dt_str:
            return datetime.now()
        
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%d'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        
        return datetime.now()
