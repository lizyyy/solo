import csv
import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import DEFAULT_TIME_FORMATS


class ParseError(Exception):
    pass


@dataclass
class RawEventRecord:
    source: str = ""
    original_time_str: str = ""
    area: str = ""
    event_type: str = ""
    description: str = ""
    person_count: Optional[int] = None
    photo_numbers: List[str] = field(default_factory=list)
    notes: str = ""
    raw_data: Dict[str, Any] = field(default_factory=dict)
    record_index: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'source': self.source,
            'original_time_str': self.original_time_str,
            'area': self.area,
            'event_type': self.event_type,
            'description': self.description,
            'person_count': self.person_count,
            'photo_numbers': self.photo_numbers,
            'notes': self.notes,
            'raw_data': self.raw_data,
            'record_index': self.record_index,
        }


class BaseParser:
    REQUIRED_FIELDS = [
        'source',
        'original_time',
        'area',
        'event_type',
    ]
    
    OPTIONAL_FIELDS = [
        'description',
        'person_count',
        'photo_numbers',
        'notes',
    ]
    
    FIELD_ALIASES = {
        '来源': 'source',
        '原始时间': 'original_time',
        '时间': 'original_time',
        '区域': 'area',
        '区域名称': 'area',
        '事件类型': 'event_type',
        '类型': 'event_type',
        '描述': 'description',
        '说明': 'description',
        '人数': 'person_count',
        '涉及人数': 'person_count',
        '照片编号': 'photo_numbers',
        '照片': 'photo_numbers',
        '备注': 'notes',
    }
    
    def __init__(self, time_formats: Optional[List[str]] = None):
        self.time_formats = time_formats or DEFAULT_TIME_FORMATS
        self.errors: List[Tuple[int, str]] = []
    
    def normalize_field_name(self, field_name: str) -> str:
        field_name = field_name.strip().lower()
        if field_name in self.FIELD_ALIASES:
            return self.FIELD_ALIASES[field_name]
        return field_name
    
    def parse_photo_numbers(self, value: str) -> List[str]:
        if not value or not value.strip():
            return []
        value = value.strip()
        if value.startswith('[') and value.endswith(']'):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(p).strip() for p in parsed if str(p).strip()]
            except json.JSONDecodeError:
                pass
        separators = [',', ';', '、', ' ']
        for sep in separators:
            if sep in value:
                return [p.strip() for p in value.split(sep) if p.strip()]
        return [value.strip()]
    
    def parse_person_count(self, value: Any) -> Optional[int]:
        if value is None or value == '':
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
    
    def parse_time(self, time_str: str) -> Optional[datetime]:
        if not time_str or not time_str.strip():
            return None
        time_str = time_str.strip()
        
        for fmt in self.time_formats:
            try:
                parsed = datetime.strptime(time_str, fmt)
                if parsed.year == 1900:
                    now = datetime.now()
                    parsed = parsed.replace(year=now.year, month=now.month, day=now.day)
                return parsed
            except ValueError:
                continue
        
        try:
            return datetime.fromisoformat(time_str)
        except ValueError:
            pass
        
        return None


class CSVParser(BaseParser):
    def __init__(self, time_formats: Optional[List[str]] = None, encoding: str = 'utf-8'):
        super().__init__(time_formats)
        self.encoding = encoding
        self.delimiter = ','
    
    def detect_delimiter(self, sample: str) -> str:
        common_delimiters = [',', ';', '\t', '|']
        counts = {d: sample.count(d) for d in common_delimiters}
        return max(counts, key=counts.get)
    
    def parse(self, file_path: str) -> List[RawEventRecord]:
        path = Path(file_path)
        if not path.exists():
            raise ParseError(f"文件不存在: {file_path}")
        
        records: List[RawEventRecord] = []
        self.errors.clear()
        
        try:
            with open(path, 'r', encoding=self.encoding) as f:
                sample = f.read(2048)
                f.seek(0)
                
                if '\0' in sample:
                    raise ParseError("文件似乎是二进制文件，不是CSV格式")
                
                self.delimiter = self.detect_delimiter(sample)
                
                reader = csv.DictReader(f, delimiter=self.delimiter)
                
                field_mapping = {}
                for field in reader.fieldnames or []:
                    normalized = self.normalize_field_name(field)
                    field_mapping[field] = normalized
                
                for row_index, row in enumerate(reader, start=1):
                    try:
                        normalized_row = {}
                        for key, value in row.items():
                            normalized_key = field_mapping.get(key, key)
                            normalized_row[normalized_key] = value
                        
                        record = RawEventRecord(
                            source=normalized_row.get('source', ''),
                            original_time_str=normalized_row.get('original_time', ''),
                            area=normalized_row.get('area', ''),
                            event_type=normalized_row.get('event_type', ''),
                            description=normalized_row.get('description', ''),
                            person_count=self.parse_person_count(normalized_row.get('person_count')),
                            photo_numbers=self.parse_photo_numbers(normalized_row.get('photo_numbers', '')),
                            notes=normalized_row.get('notes', ''),
                            raw_data=row.copy(),
                            record_index=row_index,
                        )
                        records.append(record)
                    except Exception as e:
                        self.errors.append((row_index, f"解析行失败: {str(e)}"))
        
        except UnicodeDecodeError:
            raise ParseError(f"文件编码错误，尝试使用不同的编码读取: {file_path}")
        except csv.Error as e:
            raise ParseError(f"CSV解析错误: {str(e)}")
        except Exception as e:
            raise ParseError(f"解析文件失败: {str(e)}")
        
        return records


class JSONParser(BaseParser):
    def __init__(self, time_formats: Optional[List[str]] = None, encoding: str = 'utf-8'):
        super().__init__(time_formats)
        self.encoding = encoding
    
    def parse(self, file_path: str) -> List[RawEventRecord]:
        path = Path(file_path)
        if not path.exists():
            raise ParseError(f"文件不存在: {file_path}")
        
        records: List[RawEventRecord] = []
        self.errors.clear()
        
        try:
            with open(path, 'r', encoding=self.encoding) as f:
                data = json.load(f)
            
            if isinstance(data, dict):
                if 'events' in data or 'records' in data:
                    data = data.get('events', data.get('records', []))
                else:
                    data = [data]
            
            if not isinstance(data, list):
                raise ParseError("JSON格式错误，期望是数组或包含events/records字段的对象")
            
            for index, item in enumerate(data, start=1):
                if not isinstance(item, dict):
                    self.errors.append((index, f"记录格式错误，期望是对象: {type(item)}"))
                    continue
                
                try:
                    normalized_item = {}
                    for key, value in item.items():
                        normalized_key = self.normalize_field_name(key)
                        normalized_item[normalized_key] = value
                    
                    photo_nums = normalized_item.get('photo_numbers', [])
                    if isinstance(photo_nums, str):
                        photo_nums = self.parse_photo_numbers(photo_nums)
                    elif not isinstance(photo_nums, list):
                        photo_nums = []
                    
                    record = RawEventRecord(
                        source=normalized_item.get('source', ''),
                        original_time_str=normalized_item.get('original_time', ''),
                        area=normalized_item.get('area', ''),
                        event_type=normalized_item.get('event_type', ''),
                        description=normalized_item.get('description', ''),
                        person_count=self.parse_person_count(normalized_item.get('person_count')),
                        photo_numbers=[str(p).strip() for p in photo_nums if str(p).strip()],
                        notes=normalized_item.get('notes', ''),
                        raw_data=item.copy(),
                        record_index=index,
                    )
                    records.append(record)
                except Exception as e:
                    self.errors.append((index, f"解析记录失败: {str(e)}"))
        
        except json.JSONDecodeError as e:
            raise ParseError(f"JSON解析错误: 第{e.lineno}行, {e.msg}")
        except UnicodeDecodeError:
            raise ParseError(f"文件编码错误: {file_path}")
        except Exception as e:
            raise ParseError(f"解析文件失败: {str(e)}")
        
        return records
