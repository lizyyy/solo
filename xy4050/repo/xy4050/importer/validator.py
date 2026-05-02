from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional, Set, Tuple
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import DEFAULT_TIME_FORMATS
from importer.parser import RawEventRecord, BaseParser


class ValidationErrorCode(Enum):
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD"
    INVALID_TIME_FORMAT = "INVALID_TIME_FORMAT"
    UNKNOWN_AREA = "UNKNOWN_AREA"
    UNKNOWN_EVENT_TYPE = "UNKNOWN_EVENT_TYPE"
    DUPLICATE_RECORD_NUMBER = "DUPLICATE_RECORD_NUMBER"
    INVALID_PERSON_COUNT = "INVALID_PERSON_COUNT"
    EMPTY_SOURCE = "EMPTY_SOURCE"
    EMPTY_EVENT_TYPE = "EMPTY_EVENT_TYPE"
    EMPTY_AREA = "EMPTY_AREA"


@dataclass
class ValidationError:
    code: ValidationErrorCode
    message: str
    field_name: Optional[str] = None
    raw_value: Any = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'code': self.code.value,
            'message': self.message,
            'field_name': self.field_name,
            'raw_value': self.raw_value,
        }


@dataclass
class ValidationResult:
    record_index: int = 0
    is_valid: bool = True
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    parsed_time: Optional[datetime] = None
    source: str = ""
    
    def add_error(self, code: ValidationErrorCode, message: str, field_name: Optional[str] = None, raw_value: Any = None):
        self.is_valid = False
        self.errors.append(ValidationError(code, message, field_name, raw_value))
    
    def add_warning(self, message: str):
        self.warnings.append(message)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'record_index': self.record_index,
            'is_valid': self.is_valid,
            'errors': [e.to_dict() for e in self.errors],
            'warnings': self.warnings,
            'source': self.source,
        }


class EventValidator:
    REQUIRED_FIELDS = ['source', 'original_time', 'area', 'event_type']
    
    def __init__(
        self,
        valid_area_codes: Optional[Set[str]] = None,
        valid_event_type_codes: Optional[Set[str]] = None,
        valid_area_names: Optional[Dict[str, str]] = None,
        valid_event_type_names: Optional[Dict[str, str]] = None,
        time_formats: Optional[List[str]] = None,
    ):
        self.valid_area_codes = valid_area_codes or set()
        self.valid_event_type_codes = valid_event_type_codes or set()
        self.valid_area_names = valid_area_names or {}
        self.valid_event_type_names = valid_event_type_names or {}
        self.time_formats = time_formats or DEFAULT_TIME_FORMATS
        self._source_record_numbers: Dict[str, Set[str]] = {}
        self._parser = BaseParser(time_formats)
    
    def reset(self):
        self._source_record_numbers.clear()
    
    def _normalize_name(self, name: str) -> str:
        return name.strip().lower()
    
    def _match_area(self, area_str: str) -> Tuple[bool, Optional[str]]:
        normalized = self._normalize_name(area_str)
        if not normalized:
            return False, None
        
        if normalized in self.valid_area_codes:
            return True, normalized
        
        for code, name in self.valid_area_names.items():
            if self._normalize_name(name) == normalized:
                return True, code
        
        return False, None
    
    def _match_event_type(self, event_type_str: str) -> Tuple[bool, Optional[str]]:
        normalized = self._normalize_name(event_type_str)
        if not normalized:
            return False, None
        
        if normalized in self.valid_event_type_codes:
            return True, normalized
        
        for code, name in self.valid_event_type_names.items():
            if self._normalize_name(name) == normalized:
                return True, code
        
        return False, None
    
    def _parse_time(self, time_str: str) -> Optional[datetime]:
        return self._parser.parse_time(time_str)
    
    def validate_record(
        self,
        record: RawEventRecord,
        check_duplicates: bool = True,
    ) -> ValidationResult:
        result = ValidationResult(
            record_index=record.record_index,
            source=record.source,
        )
        
        if not record.source or not record.source.strip():
            result.add_error(
                ValidationErrorCode.EMPTY_SOURCE,
                "来源不能为空",
                field_name='source',
                raw_value=record.source,
            )
        
        if not record.original_time_str or not record.original_time_str.strip():
            result.add_error(
                ValidationErrorCode.MISSING_REQUIRED_FIELD,
                "原始时间不能为空",
                field_name='original_time',
                raw_value=record.original_time_str,
            )
        else:
            parsed_time = self._parse_time(record.original_time_str)
            if parsed_time is None:
                result.add_error(
                    ValidationErrorCode.INVALID_TIME_FORMAT,
                    f"无法解析时间格式: {record.original_time_str}",
                    field_name='original_time',
                    raw_value=record.original_time_str,
                )
            else:
                result.parsed_time = parsed_time
        
        if not record.area or not record.area.strip():
            result.add_error(
                ValidationErrorCode.EMPTY_AREA,
                "区域不能为空",
                field_name='area',
                raw_value=record.area,
            )
        elif self.valid_area_codes:
            matched, code = self._match_area(record.area)
            if not matched:
                result.add_error(
                    ValidationErrorCode.UNKNOWN_AREA,
                    f"未知的区域: {record.area}",
                    field_name='area',
                    raw_value=record.area,
                )
        
        if not record.event_type or not record.event_type.strip():
            result.add_error(
                ValidationErrorCode.EMPTY_EVENT_TYPE,
                "事件类型不能为空",
                field_name='event_type',
                raw_value=record.event_type,
            )
        elif self.valid_event_type_codes:
            matched, code = self._match_event_type(record.event_type)
            if not matched:
                result.add_error(
                    ValidationErrorCode.UNKNOWN_EVENT_TYPE,
                    f"未知的事件类型: {record.event_type}",
                    field_name='event_type',
                    raw_value=record.event_type,
                )
        
        if record.person_count is not None:
            try:
                count = int(record.person_count)
                if count < 0:
                    result.add_warning(f"人数为负数: {count}")
            except (ValueError, TypeError):
                result.add_error(
                    ValidationErrorCode.INVALID_PERSON_COUNT,
                    f"无效的人数格式: {record.person_count}",
                    field_name='person_count',
                    raw_value=record.person_count,
                )
        
        if check_duplicates and record.photo_numbers:
            source = record.source.strip() if record.source else "UNKNOWN"
            if source not in self._source_record_numbers:
                self._source_record_numbers[source] = set()
            
            for photo_num in record.photo_numbers:
                normalized_num = photo_num.strip().upper()
                if normalized_num:
                    if normalized_num in self._source_record_numbers[source]:
                        result.add_error(
                            ValidationErrorCode.DUPLICATE_RECORD_NUMBER,
                            f"同一来源重复的照片编号: {photo_num}",
                            field_name='photo_numbers',
                            raw_value=photo_num,
                        )
                    else:
                        self._source_record_numbers[source].add(normalized_num)
        
        return result
    
    def validate_batch(
        self,
        records: List[RawEventRecord],
        check_duplicates: bool = True,
    ) -> List[ValidationResult]:
        if check_duplicates:
            self.reset()
        
        results = []
        for record in records:
            result = self.validate_record(record, check_duplicates=check_duplicates)
            results.append(result)
        
        return results
    
    def get_statistics(self, results: List[ValidationResult]) -> Dict[str, Any]:
        total = len(results)
        valid = sum(1 for r in results if r.is_valid)
        invalid = total - valid
        
        error_counts: Dict[str, int] = {}
        source_counts: Dict[str, int] = {}
        
        for result in results:
            source = result.source or "UNKNOWN"
            source_counts[source] = source_counts.get(source, 0) + 1
            
            for error in result.errors:
                error_code = error.code.value
                error_counts[error_code] = error_counts.get(error_code, 0) + 1
        
        return {
            'total': total,
            'valid': valid,
            'invalid': invalid,
            'error_counts': error_counts,
            'source_counts': source_counts,
        }
