import re
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime

LOGFMT_PATTERN = re.compile(r'([a-zA-Z_][a-zA-Z0-9_]*)=([^\s]+)')

@dataclass
class ParsedLine:
    line_number: int
    raw: str
    fields: Dict[str, Any] = field(default_factory=dict)
    is_bad: bool = False
    error_reason: Optional[str] = None
    timestamp: Optional[datetime] = None
    logfmt_count: int = 0

    def to_dict(self):
        return {
            'line_number': self.line_number,
            'raw': self.raw,
            'fields': self.fields,
            'is_bad': self.is_bad,
            'error_reason': self.error_reason,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'logfmt_count': self.logfmt_count
        }

def parse_logfmt_line(line, line_number):
    result = ParsedLine(line_number=line_number, raw=line.rstrip(chr(10)))
    if not line.strip():
        result.is_bad = True
        result.error_reason = 'empty_line'
        return result
    matches = list(LOGFMT_PATTERN.finditer(line))
    if not matches:
        result.is_bad = True
        result.error_reason = 'no_logfmt_fields'
        return result
    fields = {}
    for match in matches:
        key = match.group(1)
        value = match.group(2)
        if value.startswith(chr(34)) and value.endswith(chr(34)):
            value = value[1:-1]
        elif value.startswith(chr(39)) and value.endswith(chr(39)):
            value = value[1:-1]
        if value.lower() == chr(116)+chr(114)+chr(117)+chr(101):
            fields[key] = True
        elif value.lower() == chr(102)+chr(97)+chr(108)+chr(115)+chr(101):
            fields[key] = False
        elif value.lower() in (chr(110)+chr(117)+chr(108)+chr(108), chr(110)+chr(105)+chr(108), chr(110)+chr(111)+chr(110)+chr(101)):
            fields[key] = None
        else:
            try:
                if chr(46) in value:
                    fields[key] = float(value)
                else:
                    fields[key] = int(value)
            except ValueError:
                fields[key] = value
    result.fields = fields
    result.logfmt_count = len(fields)
    return result

def parse_timestamp(ts_str):
    if not ts_str:
        return None
    ts_str = str(ts_str).strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(ts_str[:19], fmt)
        except ValueError:
            continue
    return None

class LogFileParser:
    def __init__(self, timestamp_keys=None):
        self.timestamp_keys = timestamp_keys or ['ts', 'timestamp', 'time', 'datetime']
        self.lines = []
        self.bad_lines = []
        self.good_lines = []

    def parse_file(self, filepath):
        self.lines = []
        self.bad_lines = []
        self.good_lines = []
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            for line_num, line in enumerate(f, 1):
                parsed = parse_logfmt_line(line, line_num)
                for ts_key in self.timestamp_keys:
                    if ts_key in parsed.fields:
                        parsed.timestamp = parse_timestamp(parsed.fields[ts_key])
                        if parsed.timestamp:
                            break
                self.lines.append(parsed)
                if parsed.is_bad:
                    self.bad_lines.append(parsed)
                else:
                    self.good_lines.append(parsed)
        return self.good_lines, self.bad_lines

    def get_all_fields(self):
        field_types = {}
        for line in self.good_lines:
            for key, value in line.fields.items():
                if key not in field_types:
                    field_types[key] = set()
                field_types[key].add(type(value).__name__)
        return field_types

    def get_field_stats(self):
        all_fields = self.get_all_fields()
        stats = {
            'total_lines': len(self.lines),
            'good_lines': len(self.good_lines),
            'bad_lines': len(self.bad_lines),
            'bad_rate': len(self.bad_lines) / len(self.lines) if self.lines else 0,
            'fields_count': len(all_fields),
            'fields': {},
            'sample_bad_lines': [bl.to_dict() for bl in self.bad_lines[:10]]
        }
        for field, types in all_fields.items():
            values = [line.fields[field] for line in self.good_lines if field in line.fields]
            unique_values = list(set(values))
            stats['fields'][field] = {
                'types': list(types),
                'count': len(values),
                'unique_count': len(unique_values),
                'sample_values': unique_values[:5]
            }
        return stats

    def sort_by_timestamp(self):
        def sort_key(line):
            if line.timestamp:
                return (0, line.timestamp)
            return (1, line.line_number)
        return sorted(self.good_lines, key=sort_key)

    def to_ndjson(self, output_path, sort_by_time=False):
        lines = self.sort_by_timestamp() if sort_by_time else self.good_lines
        with open(output_path, "w", encoding="utf-8") as f:
            for line in lines:
                f.write(json.dumps(line.to_dict(), ensure_ascii=False) + chr(10))
        bad_path = output_path.replace(".ndjson", "_bad.ndjson")
        with open(bad_path, "w", encoding="utf-8") as f:
            for line in self.bad_lines:
                f.write(json.dumps(line.to_dict(), ensure_ascii=False) + chr(10))
