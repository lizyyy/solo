import re
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path


@dataclass
class LogRecord:
    file_path: str
    line_number: int
    raw_content: str
    timestamp: Optional[datetime] = None
    connector: Optional[str] = None
    supplier: Optional[str] = None
    level: Optional[str] = None
    message: Optional[str] = None
    is_rate_limit: bool = False
    is_retry: bool = False
    is_sleep: bool = False
    is_recovery: bool = False
    is_error: bool = False
    is_bad_line: bool = False
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'file_path': self.file_path,
            'line_number': self.line_number,
            'raw_content': self.raw_content,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'connector': self.connector,
            'supplier': self.supplier,
            'level': self.level,
            'message': self.message,
            'is_rate_limit': self.is_rate_limit,
            'is_retry': self.is_retry,
            'is_sleep': self.is_sleep,
            'is_recovery': self.is_recovery,
            'is_error': self.is_error,
            'is_bad_line': self.is_bad_line,
        }
        result.update(self.extra)
        return result


class LogParser:
    RATE_LIMIT_PATTERNS = [
        r'rate.?limit',
        r'throttled',
        r'too many requests',
        r'429',
        r'quota.?exceeded',
        r'限流',
        r'速率限制',
    ]

    RETRY_PATTERNS = [
        r'retry',
        r'retrying',
        r'重试',
    ]

    SLEEP_PATTERNS = [
        r'sleep',
        r'wait',
        r'delay',
        r'休眠',
        r'等待',
    ]

    RECOVERY_PATTERNS = [
        r'recover',
        r'recovered',
        r'resum',
        r'恢复',
        r'恢复执行',
    ]

    ERROR_PATTERNS = [
        r'error',
        r'exception',
        r'fail',
        r'failed',
        r'失败',
        r'异常',
    ]

    TIMESTAMP_PATTERNS = [
        r'(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{3})?)',
        r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]',
    ]

    CONNECTOR_PATTERNS = [
        r'connector[:\s]+([\w_-]+)',
        r'连接器[:\s]+([\w_-]+)',
        r'connector_id[:\s]+([\w_-]+)',
    ]

    SUPPLIER_PATTERNS = [
        r'supplier[:\s]+([\w_-]+)',
        r'supplier_id[:\s]+([\w_-]+)',
        r'供应商[:\s]+([\w_-]+)',
        r'账号[:\s]+([\w_-]+)',
        r'account[:\s]+([\w_-]+)',
    ]

    LEVEL_PATTERNS = [
        r'\b(DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL)\b',
    ]

    def __init__(self):
        self.rate_limit_regex = re.compile('|'.join(self.RATE_LIMIT_PATTERNS), re.IGNORECASE)
        self.retry_regex = re.compile('|'.join(self.RETRY_PATTERNS), re.IGNORECASE)
        self.sleep_regex = re.compile('|'.join(self.SLEEP_PATTERNS), re.IGNORECASE)
        self.recovery_regex = re.compile('|'.join(self.RECOVERY_PATTERNS), re.IGNORECASE)
        self.error_regex = re.compile('|'.join(self.ERROR_PATTERNS), re.IGNORECASE)
        self.timestamp_regex = re.compile('|'.join(self.TIMESTAMP_PATTERNS))
        self.connector_regex = re.compile('|'.join(self.CONNECTOR_PATTERNS), re.IGNORECASE)
        self.supplier_regex = re.compile('|'.join(self.SUPPLIER_PATTERNS), re.IGNORECASE)
        self.level_regex = re.compile('|'.join(self.LEVEL_PATTERNS))

    def parse_file(self, file_path: str) -> List[LogRecord]:
        path = Path(file_path)
        records = []
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            for line_num, line in enumerate(f, 1):
                line = line.rstrip('\n')
                record = self._parse_line(line, str(path), line_num)
                records.append(record)
        return records

    def _parse_line(self, line: str, file_path: str, line_num: int) -> LogRecord:
        record = LogRecord(
            file_path=file_path,
            line_number=line_num,
            raw_content=line
        )

        if not line.strip():
            record.is_bad_line = True
            return record

        try:
            self._extract_timestamp(record, line)
            self._extract_connector(record, line)
            self._extract_supplier(record, line)
            self._extract_level(record, line)
            self._extract_flags(record, line)
            self._extract_message(record, line)
            self._extract_json_fields(record, line)
            self._extract_sleep_duration(record, line)
            self._extract_retry_count(record, line)
        except Exception:
            record.is_bad_line = True

        if not record.is_bad_line:
            has_any_event = (
                record.is_rate_limit or
                record.is_sleep or
                record.is_recovery or
                record.is_retry or
                record.is_error
            )
            has_connector_or_supplier = (record.connector or record.supplier)
            has_timestamp = record.timestamp is not None

            if not has_timestamp and not has_connector_or_supplier and not has_any_event:
                record.is_bad_line = True

        return record

    def _extract_timestamp(self, record: LogRecord, line: str) -> None:
        match = self.timestamp_regex.search(line)
        if match:
            ts_str = match.group(1) or match.group(2)
            for fmt in [
                '%Y-%m-%dT%H:%M:%S',
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%dT%H:%M:%S.%f',
                '%Y-%m-%d %H:%M:%S,%f',
            ]:
                try:
                    record.timestamp = datetime.strptime(ts_str.split(',')[0].split('.')[0], fmt)
                    break
                except ValueError:
                    continue

    def _extract_connector(self, record: LogRecord, line: str) -> None:
        match = self.connector_regex.search(line)
        if match:
            record.connector = match.group(1)

    def _extract_supplier(self, record: LogRecord, line: str) -> None:
        match = self.supplier_regex.search(line)
        if match:
            record.supplier = match.group(1)

    def _extract_level(self, record: LogRecord, line: str) -> None:
        match = self.level_regex.search(line)
        if match:
            record.level = match.group(1)

    def _extract_flags(self, record: LogRecord, line: str) -> None:
        record.is_rate_limit = bool(self.rate_limit_regex.search(line))
        record.is_retry = bool(self.retry_regex.search(line))
        record.is_sleep = bool(self.sleep_regex.search(line))
        record.is_recovery = bool(self.recovery_regex.search(line))
        record.is_error = bool(self.error_regex.search(line))

    def _extract_message(self, record: LogRecord, line: str) -> None:
        parts = line.split(' - ', 1)
        if len(parts) > 1:
            record.message = parts[1].strip()
        else:
            record.message = line.strip()

    def _extract_json_fields(self, record: LogRecord, line: str) -> None:
        try:
            start = line.find('{')
            if start >= 0:
                end = line.rfind('}') + 1
                if end > start:
                    json_str = line[start:end]
                    data = json.loads(json_str)
                    for key, value in data.items():
                        if key in ['connector', 'connector_id'] and not record.connector:
                            record.connector = str(value)
                        elif key in ['supplier', 'supplier_id', 'account'] and not record.supplier:
                            record.supplier = str(value)
                        else:
                            record.extra[key] = value
        except (json.JSONDecodeError, ValueError):
            pass

    def _extract_sleep_duration(self, record: LogRecord, line: str) -> None:
        match = re.search(r'sleep[^\d]*(\d+(?:\.\d+)?)[^\d]*(s|sec|second|ms|minute)?', line, re.IGNORECASE)
        if match:
            duration = float(match.group(1))
            unit = (match.group(2) or 's').lower()
            if unit in ['ms']:
                duration = duration / 1000
            elif unit in ['minute', 'min']:
                duration = duration * 60
            record.extra['sleep_duration'] = duration

    def _extract_retry_count(self, record: LogRecord, line: str) -> None:
        match = re.search(r'retry[^\d]*(\d+)[^\d]*/[^\d]*(\d+)', line, re.IGNORECASE)
        if match:
            record.extra['retry_attempt'] = int(match.group(1))
            record.extra['retry_max'] = int(match.group(2))
        else:
            match = re.search(r'retry[^\d]*(\d+)', line, re.IGNORECASE)
            if match:
                record.extra['retry_attempt'] = int(match.group(1))

    def parse_files(self, file_paths: List[str]) -> List[LogRecord]:
        all_records = []
        for path in sorted(file_paths):
            records = self.parse_file(path)
            all_records.extend(records)
        return all_records
