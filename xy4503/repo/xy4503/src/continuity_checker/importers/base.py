from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime, time
from pathlib import Path
from typing import Any, Dict, Generic, List, Optional, TypeVar
import csv
import json

T = TypeVar('T')


@dataclass
class ImportResult(Generic[T]):
    success: bool = True
    data: Optional[T] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_error(self, error: str):
        self.errors.append(error)
        self.success = False
    
    def add_warning(self, warning: str):
        self.warnings.append(warning)


class BaseImporter(ABC, Generic[T]):
    
    def __init__(self):
        self.existing_data: Dict[str, Any] = {}
    
    @abstractmethod
    def import_from_dict(self, data: Dict[str, Any]) -> ImportResult[T]:
        pass
    
    def import_from_file(self, file_path: Path) -> ImportResult[T]:
        result = ImportResult[T]()
        
        try:
            file_ext = file_path.suffix.lower()
            
            if file_ext == '.json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return self.import_from_dict(data)
            
            elif file_ext == '.csv':
                with open(file_path, 'r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)
                    rows = [dict(row) for row in reader]
                return self.import_from_dict({"rows": rows})
            
            else:
                result.add_error(f"不支持的文件格式: {file_ext}")
                return result
        
        except Exception as e:
            result.add_error(f"读取文件失败: {str(e)}")
            return result
    
    def _parse_date(self, date_str: str, formats: List[str] = None) -> Optional[date]:
        if not date_str or not date_str.strip():
            return None
        
        date_str = date_str.strip()
        formats = formats or ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y"]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except (ValueError, TypeError):
                continue
        
        try:
            from dateutil import parser
            return parser.parse(date_str).date()
        except (ImportError, ValueError, TypeError):
            pass
        
        return None
    
    def _parse_time(self, time_str: str, formats: List[str] = None) -> Optional[time]:
        if not time_str or not time_str.strip():
            return None
        
        time_str = time_str.strip()
        formats = formats or ["%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M:%S %p"]
        
        for fmt in formats:
            try:
                return datetime.strptime(time_str, fmt).time()
            except (ValueError, TypeError):
                continue
        
        try:
            from dateutil import parser
            return parser.parse(time_str).time()
        except (ImportError, ValueError, TypeError):
            pass
        
        return None
    
    def _parse_list(self, list_str: str, delimiter: str = ",") -> List[str]:
        if not list_str or not list_str.strip():
            return []
        
        items = [item.strip() for item in list_str.split(delimiter)]
        return [item for item in items if item]
    
    def _merge_values(self, old_value: Any, new_value: Any, keep_old_if_empty: bool = True) -> Any:
        if new_value is None or (isinstance(new_value, str) and not new_value.strip()):
            return old_value if keep_old_if_empty else new_value
        
        if isinstance(new_value, list):
            if not new_value:
                return old_value if keep_old_if_empty else new_value
        
        return new_value
