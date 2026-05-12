from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from pathlib import Path
import json
import re
import hashlib
from collections import defaultdict

from .config import SLOConfig, LogFormat


@dataclass
class LogEntry:
    timestamp: datetime
    path: str
    method: str
    status: int
    duration_ms: float
    business_code: Optional[str] = None
    trace_id: Optional[str] = None
    raw: Dict = field(default_factory=dict)

    def hash_key(self) -> str:
        key_parts = [
            self.timestamp.isoformat(),
            self.path,
            self.method,
            str(self.status),
            f"{self.duration_ms:.3f}"
        ]
        if self.trace_id:
            key_parts.append(self.trace_id)
        return hashlib.md5("|".join(key_parts).encode()).hexdigest()

    def is_error(self, http_5xx_as_error: bool = True,
                 http_4xx_as_error: bool = False,
                 business_error_codes: List[str] = None) -> bool:
        if business_error_codes is None:
            business_error_codes = []

        if self.business_code and self.business_code in business_error_codes:
            return True

        if http_5xx_as_error and 500 <= self.status < 600:
            return True

        if http_4xx_as_error and 400 <= self.status < 500:
            return True

        return False


@dataclass
class LogParseStats:
    total_lines: int = 0
    parsed_lines: int = 0
    failed_lines: int = 0
    duplicate_lines: int = 0
    health_check_excluded: int = 0
    missing_duration: int = 0
    earliest_timestamp: Optional[datetime] = None
    latest_timestamp: Optional[datetime] = None
    endpoints_seen: set = field(default_factory=set)


class LogParser:
    def __init__(self, config: SLOConfig):
        self.config = config
        self.log_format = config.log_format

    def parse_file(self, file_path: Path,
                   exclude_health_checks: bool = True,
                   remove_duplicates: bool = True,
                   sort_by_time: bool = True) -> Tuple[List[LogEntry], LogParseStats]:
        stats = LogParseStats()
        entries: List[LogEntry] = []
        seen_hashes = set()

        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                stats.total_lines += 1

                try:
                    entry = self._parse_line(line)
                    stats.parsed_lines += 1

                    if exclude_health_checks and self.config.is_health_check(entry.path):
                        stats.health_check_excluded += 1
                        continue

                    if remove_duplicates:
                        h = entry.hash_key()
                        if h in seen_hashes:
                            stats.duplicate_lines += 1
                            continue
                        seen_hashes.add(h)

                    if entry.duration_ms < 0:
                        stats.missing_duration += 1

                    if stats.earliest_timestamp is None or entry.timestamp < stats.earliest_timestamp:
                        stats.earliest_timestamp = entry.timestamp
                    if stats.latest_timestamp is None or entry.timestamp > stats.latest_timestamp:
                        stats.latest_timestamp = entry.timestamp

                    stats.endpoints_seen.add(entry.path)
                    entries.append(entry)

                except Exception as e:
                    stats.failed_lines += 1
                    continue

        if sort_by_time:
            entries.sort(key=lambda e: e.timestamp)

        return entries, stats

    def _parse_line(self, line: str) -> LogEntry:
        if line.strip().startswith('{'):
            return self._parse_json_line(line)
        else:
            return self._parse_nginx_style_line(line)

    def _parse_json_line(self, line: str) -> LogEntry:
        data = json.loads(line)
        return self._build_entry(data)

    def _parse_nginx_style_line(self, line: str) -> LogEntry:
        data = {}
        patterns = [
            (r'\[([^\]]+)\]', 'timestamp'),
            (r'"(\w+)\s+(\S+)\s+HTTP/[\d.]+"', lambda m: (('method', m.group(1)), ('path', m.group(2)))),
            (r'\s(\d{3})\s', 'status'),
            (r'\s(\d+(?:\.\d+)?)\s*(ms|s|us)?\s*$',
             lambda m: (('duration_raw', m.group(1)), ('duration_unit', m.group(2) or 'ms'))),
            (r'X-Trace-ID:\s*(\S+)', 'trace_id'),
            (r'X-Business-Code:\s*(\S+)', 'business_code'),
        ]

        for pattern, target in patterns:
            match = re.search(pattern, line)
            if match:
                if callable(target):
                    kv_pairs = target(match)
                    if isinstance(kv_pairs, tuple):
                        if isinstance(kv_pairs[0], tuple):
                            for k, v in kv_pairs:
                                data[k] = v
                        else:
                            data[kv_pairs[0]] = kv_pairs[1]
                else:
                    data[target] = match.group(1)

        return self._build_entry(data)

    def _build_entry(self, data: Dict) -> LogEntry:
        lf = self.log_format

        ts_str = data.get(lf.timestamp_field, '')
        try:
            timestamp = datetime.strptime(ts_str, lf.timestamp_format)
        except ValueError:
            timestamp = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))

        path = data.get(lf.path_field, '/')
        method = data.get(lf.method_field, 'GET')

        status_val = data.get(lf.status_field, 0)
        status = int(status_val) if status_val else 0

        duration_val = data.get(lf.duration_field)
        duration_unit = lf.duration_unit
        if duration_val is None:
            duration_val = data.get('duration_raw')
            duration_unit = data.get('duration_unit', duration_unit)

        duration_ms = self._convert_duration(duration_val, duration_unit)

        business_code = None
        if lf.business_code_field and lf.business_code_field in data:
            business_code = str(data[lf.business_code_field])

        trace_id = None
        if lf.trace_id_field and lf.trace_id_field in data:
            trace_id = data[lf.trace_id_field]

        return LogEntry(
            timestamp=timestamp,
            path=path,
            method=method,
            status=status,
            duration_ms=duration_ms,
            business_code=business_code,
            trace_id=trace_id,
            raw=data
        )

    def _convert_duration(self, value, unit: str) -> float:
        if value is None:
            return -1.0

        try:
            num = float(value)
        except (ValueError, TypeError):
            return -1.0

        unit = (unit or 'ms').lower()

        if unit == 's' or unit == 'seconds':
            return num * 1000
        elif unit == 'us' or unit == 'microseconds':
            return num / 1000
        elif unit == 'ns' or unit == 'nanoseconds':
            return num / 1000000
        else:
            return num

    def parse_files(self, file_paths: List[Path], **kwargs) -> Tuple[List[LogEntry], LogParseStats]:
        all_entries: List[LogEntry] = []
        combined_stats = LogParseStats()

        for path in file_paths:
            entries, stats = self.parse_file(path, **kwargs)
            all_entries.extend(entries)

            combined_stats.total_lines += stats.total_lines
            combined_stats.parsed_lines += stats.parsed_lines
            combined_stats.failed_lines += stats.failed_lines
            combined_stats.duplicate_lines += stats.duplicate_lines
            combined_stats.health_check_excluded += stats.health_check_excluded
            combined_stats.missing_duration += stats.missing_duration
            combined_stats.endpoints_seen.update(stats.endpoints_seen)

            if stats.earliest_timestamp:
                if combined_stats.earliest_timestamp is None:
                    combined_stats.earliest_timestamp = stats.earliest_timestamp
                else:
                    combined_stats.earliest_timestamp = min(combined_stats.earliest_timestamp, stats.earliest_timestamp)

            if stats.latest_timestamp:
                if combined_stats.latest_timestamp is None:
                    combined_stats.latest_timestamp = stats.latest_timestamp
                else:
                    combined_stats.latest_timestamp = max(combined_stats.latest_timestamp, stats.latest_timestamp)

        if kwargs.get('sort_by_time', True):
            all_entries.sort(key=lambda e: e.timestamp)

        return all_entries, combined_stats
