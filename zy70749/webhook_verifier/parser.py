import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from .models import WebhookEvent, BadLine, ParseResult


class LogParser:
    def __init__(self, old_endpoint: str, new_endpoint: str, vendor: Optional[str] = None):
        self.old_endpoint = old_endpoint
        self.new_endpoint = new_endpoint
        self.vendor = vendor

    def parse_file(self, file_path: str) -> ParseResult:
        path = Path(file_path)
        suffix = path.suffix.lower()

        if suffix == '.json':
            return self._parse_json(file_path)
        elif suffix == '.csv':
            return self._parse_csv(file_path)
        else:
            return self._parse_line_based(file_path)

    def _parse_json(self, file_path: str) -> ParseResult:
        valid_events: List[WebhookEvent] = []
        bad_lines: List[BadLine] = []
        total_lines = 0

        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                if isinstance(data, list):
                    for idx, item in enumerate(data):
                        total_lines += 1
                        try:
                            event = self._parse_event_dict(item, file_path, idx + 1)
                            if event:
                                valid_events.append(event)
                        except Exception as e:
                            bad_lines.append(BadLine(
                                source_file=file_path,
                                line_number=idx + 1,
                                content=json.dumps(item, ensure_ascii=False),
                                error=str(e)
                            ))
                else:
                    total_lines = 1
                    try:
                        event = self._parse_event_dict(data, file_path, 1)
                        if event:
                            valid_events.append(event)
                    except Exception as e:
                        bad_lines.append(BadLine(
                            source_file=file_path,
                            line_number=1,
                            content=json.dumps(data, ensure_ascii=False),
                            error=str(e)
                        ))
            except json.JSONDecodeError as e:
                bad_lines.append(BadLine(
                    source_file=file_path,
                    line_number=e.lineno,
                    content=f"JSON decode error at line {e.lineno}",
                    error=str(e)
                ))

        return ParseResult(valid_events=valid_events, bad_lines=bad_lines, total_lines=total_lines)

    def _parse_csv(self, file_path: str) -> ParseResult:
        valid_events: List[WebhookEvent] = []
        bad_lines: List[BadLine] = []
        total_lines = 0

        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                total_lines += 1
                try:
                    event = self._parse_csv_row(row, file_path, line_num)
                    if event:
                        valid_events.append(event)
                except Exception as e:
                    bad_lines.append(BadLine(
                        source_file=file_path,
                        line_number=line_num,
                        content=','.join(str(v) for v in row.values()),
                        error=str(e)
                    ))

        return ParseResult(valid_events=valid_events, bad_lines=bad_lines, total_lines=total_lines)

    def _parse_line_based(self, file_path: str) -> ParseResult:
        valid_events: List[WebhookEvent] = []
        bad_lines: List[BadLine] = []
        total_lines = 0

        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, start=1):
                total_lines += 1
                line = line.strip()
                if not line:
                    continue
                try:
                    event = self._parse_line(line, file_path, line_num)
                    if event:
                        valid_events.append(event)
                except Exception as e:
                    bad_lines.append(BadLine(
                        source_file=file_path,
                        line_number=line_num,
                        content=line,
                        error=str(e)
                    ))

        return ParseResult(valid_events=valid_events, bad_lines=bad_lines, total_lines=total_lines)

    def _parse_line(self, line: str, source_file: str, line_num: int) -> Optional[WebhookEvent]:
        try:
            data = json.loads(line)
            return self._parse_event_dict(data, source_file, line_num)
        except json.JSONDecodeError:
            raise ValueError(f"无法解析JSON: {line[:100]}...")

    def _parse_event_dict(self, data: dict, source_file: str, line_num: int) -> Optional[WebhookEvent]:
        event_id = self._get_field(data, ['event_id', 'id', 'eventId', 'request_id'])
        event_type = self._get_field(data, ['event_type', 'type', 'eventType'])
        vendor = self._get_field(data, ['vendor', 'provider', 'source']) or self.vendor
        timestamp = self._parse_timestamp(self._get_field(data, ['timestamp', 'time', 'created_at', 'ts']))
        endpoint = self._get_field(data, ['endpoint', 'url', 'destination', 'webhook_url'])
        payload_hash = self._get_field(data, ['payload_hash', 'hash', 'signature'])
        status_code = self._get_field(data, ['status_code', 'status', 'code'])

        if not all([event_id, event_type, timestamp, endpoint]):
            raise ValueError(f"缺少必填字段: event_id={event_id}, event_type={event_type}, timestamp={timestamp}, endpoint={endpoint}")

        if not vendor and not self.vendor:
            raise ValueError("缺少vendor字段且未指定默认vendor")

        endpoint_match = (self.old_endpoint in endpoint) or (self.new_endpoint in endpoint)
        if not endpoint_match:
            return None

        return WebhookEvent(
            vendor=vendor or self.vendor,
            event_type=event_type,
            event_id=event_id,
            timestamp=timestamp,
            endpoint=endpoint,
            payload_hash=payload_hash,
            status_code=int(status_code) if status_code else None,
            raw=json.dumps(data, ensure_ascii=False),
            source_file=source_file,
            line_number=line_num
        )

    def _parse_csv_row(self, row: dict, source_file: str, line_num: int) -> Optional[WebhookEvent]:
        return self._parse_event_dict(row, source_file, line_num)

    @staticmethod
    def _get_field(data: dict, keys: List[str]) -> Optional[str]:
        for key in keys:
            if key in data and data[key]:
                return str(data[key])
        return None

    @staticmethod
    def _parse_timestamp(ts_str: Optional[str]) -> Optional[datetime]:
        if not ts_str:
            return None
        for fmt in [
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S%z',
            '%Y-%m-%dT%H:%M:%S.%f%z',
        ]:
            try:
                return datetime.strptime(ts_str, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromtimestamp(float(ts_str))
        except (ValueError, TypeError):
            return None

    def parse_files(self, file_paths: List[str]) -> ParseResult:
        all_valid: List[WebhookEvent] = []
        all_bad: List[BadLine] = []
        total = 0

        for path in sorted(file_paths):
            result = self.parse_file(path)
            all_valid.extend(result.valid_events)
            all_bad.extend(result.bad_lines)
            total += result.total_lines

        return ParseResult(valid_events=all_valid, bad_lines=all_bad, total_lines=total)
