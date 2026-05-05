import re
import json
import codecs
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from enum import Enum


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    UNKNOWN = "UNKNOWN"


@dataclass
class ParsedLogLine:
    original_line: str
    line_number: int
    file_path: str
    timestamp: Optional[datetime] = None
    device_id: Optional[str] = None
    level: LogLevel = LogLevel.UNKNOWN
    module: Optional[str] = None
    message: Optional[str] = None
    error_code: Optional[str] = None
    batch_id: Optional[str] = None
    matched_template: Optional[str] = None
    is_valid: bool = True
    issues: List[str] = field(default_factory=list)
    raw_fields: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_line": self.original_line,
            "line_number": self.line_number,
            "file_path": self.file_path,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "device_id": self.device_id,
            "level": self.level.value,
            "module": self.module,
            "message": self.message,
            "error_code": self.error_code,
            "batch_id": self.batch_id,
            "matched_template": self.matched_template,
            "is_valid": self.is_valid,
            "issues": self.issues,
            "raw_fields": self.raw_fields,
        }


@dataclass
class BadLine:
    original_line: str
    line_number: int
    file_path: str
    reasons: List[str]
    parsed_fields: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_line": self.original_line,
            "line_number": self.line_number,
            "file_path": self.file_path,
            "reasons": self.reasons,
            "parsed_fields": self.parsed_fields,
        }


class LogParser:
    def __init__(self, templates: List[Dict[str, Any]]):
        self.templates = templates
        self._compiled_patterns: List[Tuple[Dict[str, Any], re.Pattern]] = []
        self._compile_patterns()

    def _compile_patterns(self):
        for template in self.templates:
            if "is_json" in template and template["is_json"]:
                continue
            pattern = template.get("pattern", "")
            try:
                compiled = re.compile(pattern)
                self._compiled_patterns.append((template, compiled))
            except re.error as e:
                print(f"Warning: Invalid regex in template {template.get('name')}: {e}")

    def parse_file(self, file_path: str) -> List[ParsedLogLine]:
        lines = self._read_file_with_encoding_fallback(file_path)
        parsed_lines = []
        
        for line_number, line in enumerate(lines, start=1):
            parsed_line = self.parse_line(line, line_number, file_path)
            parsed_lines.append(parsed_line)
        
        return parsed_lines

    def _read_file_with_encoding_fallback(self, file_path: str) -> List[str]:
        encodings = ["utf-8", "gbk", "gb2312", "cp1252", "latin-1"]
        
        for encoding in encodings:
            try:
                with open(file_path, "r", encoding=encoding) as f:
                    return f.readlines()
            except UnicodeDecodeError:
                continue
        
        with open(file_path, "r", encoding="latin-1", errors="replace") as f:
            return f.readlines()

    def parse_line(self, line: str, line_number: int, file_path: str) -> ParsedLogLine:
        line = line.rstrip("\r\n")
        parsed = ParsedLogLine(
            original_line=line,
            line_number=line_number,
            file_path=file_path,
        )
        
        if not line.strip():
            parsed.is_valid = False
            parsed.issues.append("empty_line")
            return parsed
        
        for template, compiled_pattern in self._compiled_patterns:
            match = compiled_pattern.match(line)
            if match:
                self._apply_template_match(parsed, match, template)
                return parsed
        
        for template in self.templates:
            if template.get("is_json", False):
                result = self._try_parse_json(line, template)
                if result:
                    parsed, is_valid = result
                    if is_valid:
                        return parsed
        
        parsed.is_valid = False
        parsed.issues.append("no_matching_template")
        
        self._try_extract_partial_info(parsed)
        
        return parsed

    def _apply_template_match(
        self, parsed: ParsedLogLine, match: re.Match, template: Dict[str, Any]
    ):
        parsed.matched_template = template.get("name")
        parsed.raw_fields = match.groupdict()
        
        fields_config = template.get("fields", {})
        level_mapping = template.get("level_mapping", {})
        
        if "timestamp" in parsed.raw_fields:
            timestamp_str = parsed.raw_fields["timestamp"]
            ts_format = fields_config.get("timestamp", {}).get("format", "%Y-%m-%d %H:%M:%S.%f")
            year_default = fields_config.get("timestamp", {}).get("year_default")
            
            try:
                parsed.timestamp = datetime.strptime(timestamp_str, ts_format)
                if year_default and parsed.timestamp.year == 1900:
                    parsed.timestamp = parsed.timestamp.replace(year=year_default)
            except ValueError:
                parsed.issues.append("invalid_timestamp_format")
        
        if "device" in parsed.raw_fields:
            parsed.device_id = parsed.raw_fields["device"]
        
        if "level" in parsed.raw_fields:
            level_str = parsed.raw_fields["level"].upper()
            mapped_level = level_mapping.get(level_str.lower(), level_str)
            try:
                parsed.level = LogLevel(mapped_level)
            except ValueError:
                parsed.level = LogLevel.UNKNOWN
                parsed.issues.append("unknown_log_level")
        
        if "module" in parsed.raw_fields:
            parsed.module = parsed.raw_fields["module"]
        
        if "message" in parsed.raw_fields:
            parsed.message = parsed.raw_fields["message"]
            self._extract_error_code_from_message(parsed, template)
            self._extract_batch_id_from_message(parsed, template)
        else:
            parsed.message = parsed.original_line

    def _extract_error_code_from_message(
        self, parsed: ParsedLogLine, template: Dict[str, Any]
    ):
        error_code_config = template.get("error_code_extraction")
        if error_code_config and parsed.message:
            pattern = error_code_config.get("pattern")
            if pattern:
                match = re.search(pattern, parsed.message)
                if match:
                    parsed.error_code = match.groupdict().get("error_code") or match.group(1)

    def _extract_batch_id_from_message(
        self, parsed: ParsedLogLine, template: Dict[str, Any]
    ):
        batch_config = template.get("batch_extraction")
        if batch_config and parsed.message:
            pattern = batch_config.get("pattern")
            if pattern:
                match = re.search(pattern, parsed.message)
                if match:
                    parsed.batch_id = match.groupdict().get("batch_id") or match.group(1)

    def _try_parse_json(
        self, line: str, template: Dict[str, Any]
    ) -> Optional[Tuple[ParsedLogLine, bool]]:
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            return None
        
        parsed = ParsedLogLine(
            original_line=line,
            line_number=0,
            file_path="",
            matched_template=template.get("name"),
            raw_fields=data,
        )
        
        json_fields = template.get("json_fields", {})
        timestamp_format = template.get("timestamp_format", "%Y-%m-%dT%H:%M:%S.%fZ")
        
        for field_name, possible_keys in json_fields.items():
            for key in possible_keys:
                if key in data and data[key] is not None:
                    value = data[key]
                    
                    if field_name == "timestamp":
                        try:
                            parsed.timestamp = datetime.strptime(str(value), timestamp_format)
                        except ValueError:
                            try:
                                from dateutil import parser as dateutil_parser
                                parsed.timestamp = dateutil_parser.parse(str(value))
                            except Exception:
                                parsed.issues.append("invalid_json_timestamp")
                    
                    elif field_name == "device":
                        parsed.device_id = str(value)
                    
                    elif field_name == "level":
                        level_str = str(value).upper()
                        try:
                            parsed.level = LogLevel(level_str)
                        except ValueError:
                            parsed.level = LogLevel.UNKNOWN
                    
                    elif field_name == "message":
                        parsed.message = str(value)
                    
                    elif field_name == "error_code":
                        parsed.error_code = str(value)
                    
                    elif field_name == "batch_id":
                        parsed.batch_id = str(value)
                    
                    break
        
        is_valid = parsed.timestamp is not None or parsed.device_id is not None
        
        return parsed, is_valid

    def _try_extract_partial_info(self, parsed: ParsedLogLine):
        timestamp_patterns = [
            r'\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}',
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}',
            r'\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}',
        ]
        
        for pattern in timestamp_patterns:
            match = re.search(pattern, parsed.original_line)
            if match:
                try:
                    from dateutil import parser as dateutil_parser
                    parsed.timestamp = dateutil_parser.parse(match.group(0), fuzzy=True)
                    break
                except Exception:
                    continue
        
        device_patterns = [
            r'PLC[-_]?\w+',
            r'EDGE[-_]?\w+',
            r'GW[-_]?\d+',
        ]
        
        for pattern in device_patterns:
            match = re.search(pattern, parsed.original_line)
            if match:
                parsed.device_id = match.group(0)
                break
        
        error_code_patterns = [
            r'E\d{3,4}',
            r'ERR\d+',
            r'ERROR[-_]?\d+',
        ]
        
        for pattern in error_code_patterns:
            match = re.search(pattern, parsed.original_line)
            if match:
                parsed.error_code = match.group(0)
                break
