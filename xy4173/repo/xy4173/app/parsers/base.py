from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, TypeVar, Generic


T = TypeVar('T')


class ImportType(str, Enum):
    RESERVATION = "reservation"
    SWIPE_LOG = "swipe_log"
    SAMPLE_REGISTRATION = "sample_registration"
    BILLING_RULE = "billing_rule"
    USER = "user"
    INSTRUMENT = "instrument"
    RESEARCH_GROUP = "research_group"


@dataclass
class ParseError:
    row_number: int
    field: Optional[str]
    message: str
    code: str = "PARSE_ERROR"
    value: Optional[Any] = None


@dataclass
class ParseResult(Generic[T]):
    success: bool = True
    data: List[T] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    total_count: int = 0
    success_count: int = 0
    error_count: int = 0
    skip_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_error(self, error: ParseError):
        self.errors.append(error)
        self.error_count += 1
        self.success = False
    
    def add_warning(self, warning: str):
        self.warnings.append(warning)


class BaseParser(ABC):
    
    def __init__(self):
        self.errors: List[ParseError] = []
        self.warnings: List[str] = []
    
    @abstractmethod
    def parse(self, content: str) -> ParseResult[Any]:
        pass
    
    @abstractmethod
    def parse_file(self, file_path: str) -> ParseResult[Any]:
        pass
    
    def _validate_required(self, row: Dict, required_fields: List[str], 
                           row_number: int) -> bool:
        for field in required_fields:
            if field not in row or row[field] is None or str(row[field]).strip() == "":
                self.errors.append(ParseError(
                    row_number=row_number,
                    field=field,
                    message=f"必填字段 '{field}' 为空或缺失",
                    code="MISSING_REQUIRED_FIELD"
                ))
                return False
        return True
    
    def _parse_datetime(self, value: Any, row_number: int, 
                        field_name: str = "datetime") -> Optional[datetime]:
        if value is None or str(value).strip() == "":
            return None
        
        value_str = str(value).strip()
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M",
            "%Y%m%d %H:%M:%S",
            "%Y%m%d%H%M%S",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value_str, fmt)
            except ValueError:
                continue
        
        self.errors.append(ParseError(
            row_number=row_number,
            field=field_name,
            message=f"无法解析日期时间格式: {value_str}",
            code="INVALID_DATETIME_FORMAT",
            value=value_str
        ))
        return None
    
    def _parse_int(self, value: Any, row_number: int, 
                   field_name: str = "int") -> Optional[int]:
        if value is None or str(value).strip() == "":
            return None
        
        try:
            return int(str(value).strip())
        except ValueError:
            self.errors.append(ParseError(
                row_number=row_number,
                field=field_name,
                message=f"无法解析整数格式: {value}",
                code="INVALID_INT_FORMAT",
                value=value
            ))
            return None
    
    def _parse_float(self, value: Any, row_number: int, 
                     field_name: str = "float") -> Optional[float]:
        if value is None or str(value).strip() == "":
            return None
        
        try:
            return float(str(value).strip())
        except ValueError:
            self.errors.append(ParseError(
                row_number=row_number,
                field=field_name,
                message=f"无法解析浮点数格式: {value}",
                code="INVALID_FLOAT_FORMAT",
                value=value
            ))
            return None
