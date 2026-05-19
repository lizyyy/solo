import csv
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


class ChangeType(Enum):
    ADD = "新增"
    MODIFY = "修改"
    DELETE = "删除"
    DEPRECATE = "废弃"
    UNKNOWN = "未知"


class ConfirmStatus(Enum):
    CONFIRMED = "已确认"
    PENDING = "待确认"
    TIMEOUT = "已超时"
    UNKNOWN = "未知"


@dataclass
class ParseError:
    file_path: str
    line_number: int
    raw_content: str
    error_message: str


@dataclass
class ParsedRecord:
    api_path: str
    subscriber: str
    change_type: ChangeType
    batch_id: str
    notify_time: Optional[datetime] = None
    confirm_time: Optional[datetime] = None
    confirm_status: ConfirmStatus = ConfirmStatus.UNKNOWN
    change_description: str = ""
    version: str = ""
    extra: Dict[str, Any] = field(default_factory=dict)
    source_file: str = ""
    source_line: int = 0
    is_valid: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "api_path": self.api_path,
            "subscriber": self.subscriber,
            "change_type": self.change_type.value,
            "batch_id": self.batch_id,
            "notify_time": self.notify_time.isoformat() if self.notify_time else None,
            "confirm_time": self.confirm_time.isoformat() if self.confirm_time else None,
            "confirm_status": self.confirm_status.value,
            "change_description": self.change_description,
            "version": self.version,
            "source_file": self.source_file,
            "source_line": self.source_line,
            "is_valid": self.is_valid,
            **self.extra
        }


class DataParser:
    def __init__(self):
        self.parsed_records: List[ParsedRecord] = []
        self.parse_errors: List[ParseError] = []

    def parse_file(self, file_path: Union[str, Path]) -> tuple[List[ParsedRecord], List[ParseError]]:
        file_path = Path(file_path)
        suffix = file_path.suffix.lower()

        if suffix == '.csv':
            return self._parse_csv(file_path)
        elif suffix == '.json':
            return self._parse_json(file_path)
        elif suffix in ['.txt', '.log']:
            return self._parse_text(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _parse_csv(self, file_path: Path) -> tuple[List[ParsedRecord], List[ParseError]]:
        records: List[ParsedRecord] = []
        errors: List[ParseError] = []

        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    record = self._parse_row(row, str(file_path), line_num)
                    records.append(record)
                except Exception as e:
                    errors.append(ParseError(
                        file_path=str(file_path),
                        line_number=line_num,
                        raw_content=json.dumps(row, ensure_ascii=False),
                        error_message=str(e)
                    ))

        self.parsed_records.extend(records)
        self.parse_errors.extend(errors)
        return records, errors

    def _parse_json(self, file_path: Path) -> tuple[List[ParsedRecord], List[ParseError]]:
        records: List[ParsedRecord] = []
        errors: List[ParseError] = []

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, list):
            for line_num, item in enumerate(data, start=1):
                try:
                    record = self._parse_row(item, str(file_path), line_num)
                    records.append(record)
                except Exception as e:
                    errors.append(ParseError(
                        file_path=str(file_path),
                        line_number=line_num,
                        raw_content=json.dumps(item, ensure_ascii=False),
                        error_message=str(e)
                    ))
        else:
            try:
                record = self._parse_row(data, str(file_path), 1)
                records.append(record)
            except Exception as e:
                errors.append(ParseError(
                    file_path=str(file_path),
                    line_number=1,
                    raw_content=json.dumps(data, ensure_ascii=False),
                    error_message=str(e)
                ))

        self.parsed_records.extend(records)
        self.parse_errors.extend(errors)
        return records, errors

    def _parse_text(self, file_path: Path) -> tuple[List[ParsedRecord], List[ParseError]]:
        records: List[ParsedRecord] = []
        errors: List[ParseError] = []

        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, start=1):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                try:
                    data = self._parse_text_line(line)
                    record = self._parse_row(data, str(file_path), line_num)
                    records.append(record)
                except Exception as e:
                    errors.append(ParseError(
                        file_path=str(file_path),
                        line_number=line_num,
                        raw_content=line,
                        error_message=str(e)
                    ))

        self.parsed_records.extend(records)
        self.parse_errors.extend(errors)
        return records, errors

    def _parse_text_line(self, line: str) -> Dict[str, Any]:
        if '\t' in line:
            parts = line.split('\t')
        elif '|' in line:
            parts = [p.strip() for p in line.split('|')]
        else:
            parts = line.split()

        data = {}
        fields = ['api_path', 'subscriber', 'change_type', 'batch_id', 
                  'notify_time', 'confirm_time', 'confirm_status']
        
        for i, part in enumerate(parts):
            if i < len(fields):
                data[fields[i]] = part
            else:
                data[f'field_{i}'] = part

        return data

    def _parse_row(self, row: Dict[str, Any], source_file: str, line_num: int) -> ParsedRecord:
        def get_value(keys: List[str], default: Any = '') -> Any:
            for key in keys:
                if key in row and row[key]:
                    return row[key]
            return default

        api_path = get_value(['api_path', '接口路径', 'path', 'url']).strip()
        subscriber = get_value(['subscriber', '订阅方', 'consumer', '调用方']).strip()
        change_type_str = get_value(['change_type', '变更类型', 'type']).strip()
        batch_id = get_value(['batch_id', '批次', '通知批次', 'batch']).strip()

        if not api_path:
            raise ValueError("缺少接口路径")
        if not subscriber:
            raise ValueError("缺少订阅方")
        if not batch_id:
            raise ValueError("缺少通知批次")

        change_type = self._parse_change_type(change_type_str)
        notify_time = self._parse_datetime(get_value(['notify_time', '通知时间', 'notify']))
        confirm_time = self._parse_datetime(get_value(['confirm_time', '确认时间', 'confirm']))
        confirm_status = self._parse_confirm_status(get_value(['confirm_status', '确认状态', 'status']))

        return ParsedRecord(
            api_path=api_path,
            subscriber=subscriber,
            change_type=change_type,
            batch_id=batch_id,
            notify_time=notify_time,
            confirm_time=confirm_time,
            confirm_status=confirm_status,
            change_description=get_value(['change_description', '变更说明', 'description'], ''),
            version=get_value(['version', '版本', 'ver'], ''),
            source_file=source_file,
            source_line=line_num,
            is_valid=True,
            extra={k: v for k, v in row.items() if k not in [
                'api_path', '接口路径', 'path', 'url',
                'subscriber', '订阅方', 'consumer', '调用方',
                'change_type', '变更类型', 'type',
                'batch_id', '批次', '通知批次', 'batch',
                'notify_time', '通知时间', 'notify',
                'confirm_time', '确认时间', 'confirm',
                'confirm_status', '确认状态', 'status',
                'change_description', '变更说明', 'description',
                'version', '版本', 'ver'
            ]}
        )

    def _parse_change_type(self, value: str) -> ChangeType:
        mapping = {
            '新增': ChangeType.ADD,
            'add': ChangeType.ADD,
            'create': ChangeType.ADD,
            '修改': ChangeType.MODIFY,
            'modify': ChangeType.MODIFY,
            'update': ChangeType.MODIFY,
            '删除': ChangeType.DELETE,
            'delete': ChangeType.DELETE,
            'remove': ChangeType.DELETE,
            '废弃': ChangeType.DEPRECATE,
            'deprecate': ChangeType.DEPRECATE,
            'deprecated': ChangeType.DEPRECATE,
        }
        return mapping.get(value.lower(), ChangeType.UNKNOWN)

    def _parse_datetime(self, value: str) -> Optional[datetime]:
        if not value:
            return None
        
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%d',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%Y/%m/%d',
            '%Y%m%d%H%M%S',
            '%Y%m%d',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        
        return None

    def _parse_confirm_status(self, value: str) -> ConfirmStatus:
        mapping = {
            '已确认': ConfirmStatus.CONFIRMED,
            'confirmed': ConfirmStatus.CONFIRMED,
            'done': ConfirmStatus.CONFIRMED,
            '待确认': ConfirmStatus.PENDING,
            'pending': ConfirmStatus.PENDING,
            '未确认': ConfirmStatus.PENDING,
            '已超时': ConfirmStatus.TIMEOUT,
            'timeout': ConfirmStatus.TIMEOUT,
            'overdue': ConfirmStatus.TIMEOUT,
        }
        return mapping.get(value.lower(), ConfirmStatus.UNKNOWN)

    def get_all_records(self) -> List[ParsedRecord]:
        return sorted(self.parsed_records, key=lambda x: (x.source_file, x.source_line))

    def get_all_errors(self) -> List[ParseError]:
        return sorted(self.parse_errors, key=lambda x: (x.file_path, x.line_number))
