import os
import csv
import re
from datetime import datetime, date, timedelta
from typing import List, Tuple, Optional, Dict, Any, Set
import uuid

import yaml
import pytz
from dateutil.parser import parse as dateutil_parse

from src.models import Event, EventStatus, ValidationError


DEFAULT_TIMEZONE = pytz.timezone('Asia/Shanghai')
DEFAULT_MAPPING_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                                     'config', 'csv_mapping.yaml')


class CSVParser:
    def __init__(self, mapping_config_path: Optional[str] = None, default_timezone=None, profile: str = "default"):
        self.default_timezone = default_timezone or DEFAULT_TIMEZONE
        self.profile = profile
        self.mapping_config = self._load_mapping_config(mapping_config_path or DEFAULT_MAPPING_PATH)
        self.validation_errors: List[ValidationError] = []
        self.datetime_formats = self.mapping_config.get('datetime_formats', [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ])

    def _load_mapping_config(self, path: str) -> Dict[str, Any]:
        if not os.path.exists(path):
            return self._get_default_mapping()
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or self._get_default_mapping()
        except Exception:
            return self._get_default_mapping()

    def _get_default_mapping(self) -> Dict[str, Any]:
        return {
            "default": {
                "title": ["标题", "主题", "事件", "title", "summary", "name", "subject"],
                "start": ["开始时间", "开始日期", "日期", "start", "start_time", "date", "dtstart"],
                "end": ["结束时间", "结束日期", "end", "end_time", "dtend"],
                "location": ["地点", "位置", "location", "place", "venue", "地址"],
                "description": ["描述", "详情", "备注", "description", "notes"],
                "all_day": ["全天", "全天事件", "all_day", "is_all_day"],
                "timezone": ["时区", "timezone", "tz"],
                "duration": ["时长", "持续时间", "duration", "minutes", "hours"],
            },
            "datetime_formats": [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y/%m/%d %H:%M:%S",
                "%Y/%m/%d %H:%M",
                "%Y-%m-%d",
                "%Y/%m/%d",
            ]
        }

    def parse_file(self, file_path: str) -> Tuple[List[Event], List[ValidationError]]:
        self.validation_errors = []
        events: List[Event] = []
        
        if not os.path.exists(file_path):
            self._add_error(file_path, None, None, "file_not_found", f"文件不存在: {file_path}")
            return [], self.validation_errors

        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='gbk') as f:
                    content = f.read()
            except Exception as e:
                self._add_error(file_path, None, None, "read_error", f"读取文件失败: {str(e)}")
                return [], self.validation_errors
        except Exception as e:
            self._add_error(file_path, None, None, "read_error", f"读取文件失败: {str(e)}")
            return [], self.validation_errors

        file_name = os.path.basename(file_path)
        lines = content.strip().split('\n')
        
        if not lines:
            self._add_error(file_path, 1, None, "empty_file", "CSV 文件为空")
            return [], self.validation_errors

        header_line = lines[0]
        delimiter = self._detect_delimiter(header_line)
        
        try:
            reader = csv.DictReader(lines, delimiter=delimiter)
        except Exception as e:
            self._add_error(file_path, 1, None, "parse_error", f"解析 CSV 失败: {str(e)}")
            return [], self.validation_errors

        field_mapping = self._build_field_mapping(reader.fieldnames or [])

        for row_num, row in enumerate(reader, start=2):
            try:
                event = self._parse_row(row, field_mapping, file_name, file_path, row_num)
                if event:
                    events.append(event)
            except Exception as e:
                event_title = self._get_row_value(row, field_mapping.get('title', []))
                self._add_error(file_path, row_num, event_title, "row_parse_error", 
                               f"解析行失败: {str(e)}")

        return events, self.validation_errors

    def _detect_delimiter(self, line: str) -> str:
        delimiters = [',', '\t', ';', '|']
        counts = {d: line.count(d) for d in delimiters}
        return max(counts, key=counts.get) if any(counts.values()) > 0 else ','

    def _build_field_mapping(self, actual_fields: List[str]) -> Dict[str, List[str]]:
        mapping = {}
        profile_config = self.mapping_config.get(self.profile, {})
        default_config = self.mapping_config.get('default', {})
        
        actual_fields_lower = [f.strip().lower() for f in actual_fields]
        actual_field_map = {f.lower(): f for f in actual_fields}
        
        for field_name in ['title', 'start', 'end', 'location', 'description', 
                           'all_day', 'timezone', 'duration', 'status', 'organizer', 'attendees']:
            possible_names = []
            
            profile_names = profile_config.get(field_name, [])
            default_names = default_config.get(field_name, [])
            all_candidates = list(profile_names) + list(default_names)
            
            for candidate in all_candidates:
                candidate_lower = str(candidate).strip().lower()
                if candidate_lower in actual_field_map:
                    possible_names.append(actual_field_map[candidate_lower])
            
            mapping[field_name] = possible_names
        
        return mapping

    def _get_row_value(self, row: Dict[str, Any], possible_keys: List[str]) -> Optional[str]:
        for key in possible_keys:
            if key in row and row[key]:
                value = str(row[key]).strip()
                if value:
                    return value
        return None

    def _parse_row(self, row: Dict[str, Any], field_mapping: Dict[str, List[str]],
                   file_name: str, file_path: str, row_num: int) -> Optional[Event]:
        title = self._get_row_value(row, field_mapping.get('title', []))
        
        if not title:
            self._add_error(file_path, row_num, None, "missing_title", f"第 {row_num} 行缺少标题")
        
        start_str = self._get_row_value(row, field_mapping.get('start', []))
        end_str = self._get_row_value(row, field_mapping.get('end', []))
        duration_str = self._get_row_value(row, field_mapping.get('duration', []))
        timezone_str = self._get_row_value(row, field_mapping.get('timezone', []))
        all_day_str = self._get_row_value(row, field_mapping.get('all_day', []))
        
        tz = self._parse_timezone(timezone_str, file_path, row_num, title) or self.default_timezone
        
        start_dt, all_day = self._parse_datetime(start_str, tz, file_path, row_num, title)
        
        if start_dt is None:
            self._add_error(file_path, row_num, title, "missing_start", 
                           f"第 {row_num} 行无法解析开始时间: '{start_str}'")
            return None
        
        if all_day_str is not None:
            all_day = self._parse_bool(all_day_str)
        
        end_dt = None
        if end_str:
            end_dt, _ = self._parse_datetime(end_str, tz, file_path, row_num, title)
        
        if end_dt is None and duration_str:
            duration = self._parse_duration(duration_str)
            if duration:
                end_dt = start_dt + duration
        
        if end_dt is None:
            if all_day:
                end_dt = start_dt + timedelta(days=1)
            else:
                end_dt = start_dt + timedelta(hours=1)
                self._add_error(file_path, row_num, title, "missing_end", 
                               f"第 {row_num} 行缺少结束时间，默认使用 1 小时", severity="warning")
        
        event = Event(
            uid=f"{uuid.uuid4()}@schedule-cleaner.local",
            title=title or "未命名事件",
            start=start_dt,
            end=end_dt,
            source_file=file_name,
            all_day=all_day,
        )
        
        event.location = self._get_row_value(row, field_mapping.get('location', []))
        event.description = self._get_row_value(row, field_mapping.get('description', []))
        
        status_str = self._get_row_value(row, field_mapping.get('status', []))
        if status_str:
            status_map = {
                'confirmed': EventStatus.ACTIVE,
                'active': EventStatus.ACTIVE,
                'tentative': EventStatus.TENTATIVE,
                'cancelled': EventStatus.CANCELLED,
            }
            event.status = status_map.get(status_str.lower(), EventStatus.ACTIVE)
        
        event.organizer = self._get_row_value(row, field_mapping.get('organizer', []))
        
        attendees_str = self._get_row_value(row, field_mapping.get('attendees', []))
        if attendees_str:
            event.attendees = [a.strip() for a in re.split(r'[,;，；]', attendees_str) if a.strip()]
        
        return event

    def _parse_datetime(self, value_str: Optional[str], tz: pytz.BaseTzInfo,
                        file_path: str, row_num: int, title: Optional[str]) -> Tuple[Optional[datetime], bool]:
        if not value_str:
            return None, False
        
        value_str = value_str.strip()
        all_day = False
        
        for fmt in self.datetime_formats:
            try:
                dt = datetime.strptime(value_str, fmt)
                if '%H' not in fmt and '%M' not in fmt:
                    all_day = True
                if dt.tzinfo is None:
                    dt = tz.localize(dt)
                return dt, all_day
            except ValueError:
                continue
        
        try:
            dt = dateutil_parse(value_str, fuzzy=True)
            if dt.tzinfo is None:
                dt = tz.localize(dt)
            return dt, False
        except Exception:
            pass
        
        return None, False

    def _parse_timezone(self, tz_str: Optional[str], file_path: str, 
                        row_num: int, title: Optional[str]) -> Optional[pytz.BaseTzInfo]:
        if not tz_str:
            return None
        
        tz_str = tz_str.strip()
        
        common_tz_mappings = {
            '北京': 'Asia/Shanghai',
            '上海': 'Asia/Shanghai',
            '中国': 'Asia/Shanghai',
            'UTC+8': 'Asia/Shanghai',
            'UTC+08:00': 'Asia/Shanghai',
            'GMT+8': 'Asia/Shanghai',
            '东京': 'Asia/Tokyo',
            '纽约': 'America/New_York',
            '伦敦': 'Europe/London',
            '巴黎': 'Europe/Paris',
        }
        
        if tz_str in common_tz_mappings:
            tz_str = common_tz_mappings[tz_str]
        
        try:
            return pytz.timezone(tz_str)
        except pytz.exceptions.UnknownTimeZoneError:
            self._add_error(file_path, row_num, title, "invalid_timezone", 
                           f"第 {row_num} 行未知时区: '{tz_str}'，使用默认时区", severity="warning")
            return None

    def _parse_duration(self, duration_str: str) -> Optional[timedelta]:
        if not duration_str:
            return None
        
        duration_str = duration_str.strip()
        
        iso_match = re.match(r'PT(\d+H)?(\d+M)?(\d+S)?', duration_str, re.IGNORECASE)
        if iso_match:
            hours = int(iso_match.group(1)[:-1]) if iso_match.group(1) else 0
            minutes = int(iso_match.group(2)[:-1]) if iso_match.group(2) else 0
            seconds = int(iso_match.group(3)[:-1]) if iso_match.group(3) else 0
            return timedelta(hours=hours, minutes=minutes, seconds=seconds)
        
        colon_match = re.match(r'(\d+):(\d+)(?::(\d+))?', duration_str)
        if colon_match:
            hours = int(colon_match.group(1))
            minutes = int(colon_match.group(2))
            seconds = int(colon_match.group(3)) if colon_match.group(3) else 0
            return timedelta(hours=hours, minutes=minutes, seconds=seconds)
        
        try:
            num = float(duration_str)
            if '小时' in duration_str or 'h' in duration_str.lower() or 'hour' in duration_str.lower():
                return timedelta(hours=num)
            elif '分钟' in duration_str or 'min' in duration_str.lower() or 'm' in duration_str.lower():
                return timedelta(minutes=num)
            else:
                if num < 24:
                    return timedelta(hours=num)
                return timedelta(minutes=num)
        except ValueError:
            pass
        
        hour_match = re.search(r'(\d+)\s*[小hH]', duration_str)
        minute_match = re.search(r'(\d+)\s*[分mM]', duration_str)
        if hour_match or minute_match:
            hours = int(hour_match.group(1)) if hour_match else 0
            minutes = int(minute_match.group(1)) if minute_match else 0
            return timedelta(hours=hours, minutes=minutes)
        
        return None

    def _parse_bool(self, value: str) -> bool:
        value = str(value).lower().strip()
        return value in ['true', '是', 'yes', '1', '全天', 'all_day', 'all day']

    def _add_error(self, source_file: str, line_number: Optional[int], event_title: Optional[str], 
                   error_type: str, message: str, severity: str = "error"):
        self.validation_errors.append(ValidationError(
            source_file=source_file,
            line_number=line_number,
            event_title=event_title,
            error_type=error_type,
            message=message,
            severity=severity,
        ))
