"""服务日志解析器"""

import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pytz

from ..config import Event, EventSource, EventType, ProjectConfig


class LogsParser:
    """服务日志解析器
    
    支持解析多种日志格式：
    - Nginx访问日志
    - Java应用日志（Log4j、Logback等）
    - Python应用日志
    - 通用文本日志
    """
    
    LOG_LEVELS = {
        'ERROR': 'error',
        'WARN': 'warning',
        'WARNING': 'warning',
        'INFO': 'info',
        'DEBUG': 'debug',
        'TRACE': 'trace',
        'FATAL': 'critical',
        'CRITICAL': 'critical',
    }
    
    ERROR_KEYWORDS = [
        'Exception', 'Error', 'Failed', 'Failure', 'Timeout',
        'Connection refused', 'Connection reset', '500', '502', '503',
        'OOM', 'OutOfMemory', 'NullPointerException', 'StackOverflow',
        '异常', '错误', '失败', '超时', '拒绝连接', '内存溢出',
    ]
    
    SURGE_THRESHOLD = 5
    
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.time_formats = {f.name: f for f in config.log_time_formats}
    
    def parse(
        self, 
        log_path: Path, 
        timezone: str = 'Asia/Shanghai',
        format_name: Optional[str] = None,
    ) -> List[Event]:
        """解析日志文件
        
        Args:
            log_path: 日志文件路径
            timezone: 日志的时区
            format_name: 指定日志时间格式名称（参考配置中的log_time_formats）
            
        Returns:
            解析出的事件列表
        """
        events: List[Event] = []
        tz = pytz.timezone(timezone)
        
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        log_entries = self._parse_log_lines(lines, tz, format_name)
        
        error_counts: Dict[str, int] = {}
        error_windows: Dict[str, List[datetime]] = {}
        
        for entry in log_entries:
            event = self._create_event_from_log_entry(
                entry=entry,
                source_file=log_path.name,
            )
            if event:
                events.append(event)
                
                if event.severity in ['error', 'critical', 'warning']:
                    minute_key = entry['timestamp'].strftime('%Y-%m-%d %H:%M')
                    error_counts[minute_key] = error_counts.get(minute_key, 0) + 1
                    
                    if minute_key not in error_windows:
                        error_windows[minute_key] = []
                    error_windows[minute_key].append(entry['timestamp'])
        
        surge_events = self._detect_error_surges(error_windows, log_path.name)
        events.extend(surge_events)
        
        return events
    
    def _parse_log_lines(
        self, 
        lines: List[str], 
        tz: pytz.BaseTzInfo,
        format_name: Optional[str],
    ) -> List[Dict[str, Any]]:
        """解析日志行为结构化条目"""
        entries: List[Dict[str, Any]] = []
        current_entry: Optional[Dict[str, Any]] = None
        
        for line in lines:
            line = line.rstrip()
            if not line:
                continue
            
            parsed = self._parse_single_line(line, tz, format_name)
            
            if parsed:
                if current_entry:
                    entries.append(current_entry)
                
                current_entry = parsed
            elif current_entry:
                current_entry['message'] += '\n' + line
        
        if current_entry:
            entries.append(current_entry)
        
        return entries
    
    def _parse_single_line(
        self, 
        line: str, 
        tz: pytz.BaseTzInfo,
        format_name: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """解析单行日志"""
        parsers = [
            self._parse_nginx_log,
            self._parse_java_log,
            self._parse_python_log,
            self._parse_generic_log,
        ]
        
        for parser in parsers:
            result = parser(line, tz, format_name)
            if result:
                return result
        
        return None
    
    def _parse_nginx_log(
        self, 
        line: str, 
        tz: pytz.BaseTzInfo,
        format_name: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """解析Nginx访问日志"""
        patterns = [
            r'^(?P<ip>\S+) - (?P<user>\S+) \[(?P<timestamp>[^\]]+)\] '
            r'"(?P<method>\S+) (?P<path>\S+) (?P<protocol>\S+)" '
            r'(?P<status>\d+) (?P<size>\d+) '
            r'"(?P<referrer>[^"]*)" "(?P<user_agent>[^"]*)"',
            
            r'^(?P<ip>\S+) - (?P<user>\S+) \[(?P<timestamp>[^\]]+)\] '
            r'"(?P<method>\S+) (?P<path>\S+) (?P<protocol>\S+)" '
            r'(?P<status>\d+) (?P<size>\d+)',
        ]
        
        for pattern in patterns:
            match = re.match(pattern, line)
            if match:
                groups = match.groupdict()
                
                timestamp_str = groups.get('timestamp', '')
                timestamp = self._parse_nginx_timestamp(timestamp_str, tz)
                
                if not timestamp:
                    continue
                
                status = groups.get('status', '')
                severity = 'info'
                if status.startswith('5'):
                    severity = 'error'
                elif status.startswith('4'):
                    severity = 'warning'
                
                return {
                    'timestamp': timestamp,
                    'level': severity.upper(),
                    'message': line,
                    'metadata': {
                        'ip': groups.get('ip'),
                        'user': groups.get('user'),
                        'method': groups.get('method'),
                        'path': groups.get('path'),
                        'protocol': groups.get('protocol'),
                        'status': status,
                        'size': groups.get('size'),
                        'referrer': groups.get('referrer'),
                        'user_agent': groups.get('user_agent'),
                    },
                }
        
        return None
    
    def _parse_nginx_timestamp(self, value: str, tz: pytz.BaseTzInfo) -> Optional[datetime]:
        """解析Nginx时间戳格式: 01/Jan/2024:10:30:00 +0800"""
        try:
            from dateutil import parser as dateutil_parser
            dt = dateutil_parser.parse(value.replace(':', ' ', 1))
            return dt.astimezone(pytz.UTC)
        except (ValueError, TypeError):
            pass
        
        formats = [
            '%d/%b/%Y:%H:%M:%S %z',
            '%d/%b/%Y:%H:%M:%S',
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                
                if dt.tzinfo is None:
                    dt = tz.localize(dt)
                
                return dt.astimezone(pytz.UTC)
            except (ValueError, TypeError):
                continue
        
        return None
    
    def _parse_java_log(
        self, 
        line: str, 
        tz: pytz.BaseTzInfo,
        format_name: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """解析Java应用日志"""
        patterns = [
            r'^(?P<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[,.]?\d*)\s+'
            r'(?P<level>ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)\s+'
            r'(?P<thread>\[[^\]]+\])?\s*'
            r'(?P<logger>[\w$.]+)?\s*-\s*'
            r'(?P<message>.*)$',
            
            r'^(?P<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[,.]?\d*)\s+'
            r'(?P<level>ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)\s+'
            r'(?P<message>.*)$',
        ]
        
        for pattern in patterns:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                groups = match.groupdict()
                
                timestamp_str = groups.get('timestamp', '')
                timestamp = self._parse_timestamp_string(timestamp_str, tz)
                
                if not timestamp:
                    continue
                
                level = groups.get('level', 'INFO').upper()
                message = groups.get('message', '')
                
                return {
                    'timestamp': timestamp,
                    'level': level,
                    'message': message,
                    'metadata': {
                        'thread': groups.get('thread'),
                        'logger': groups.get('logger'),
                    },
                }
        
        return None
    
    def _parse_python_log(
        self, 
        line: str, 
        tz: pytz.BaseTzInfo,
        format_name: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """解析Python应用日志"""
        patterns = [
            r'^(?P<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[,.]?\d*)\s+'
            r'(?P<level>ERROR|WARN|WARNING|INFO|DEBUG|TRACE|CRITICAL)\s+'
            r'(?P<module>[\w_]+):(?P<line>\d+)\s*-\s*'
            r'(?P<message>.*)$',
            
            r'^(?P<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[,.]?\d*)\s+'
            r'(?P<level>ERROR|WARN|WARNING|INFO|DEBUG|TRACE|CRITICAL)\s+'
            r'(?P<message>.*)$',
        ]
        
        for pattern in patterns:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                groups = match.groupdict()
                
                timestamp_str = groups.get('timestamp', '')
                timestamp = self._parse_timestamp_string(timestamp_str, tz)
                
                if not timestamp:
                    continue
                
                level = groups.get('level', 'INFO').upper()
                message = groups.get('message', '')
                
                return {
                    'timestamp': timestamp,
                    'level': level,
                    'message': message,
                    'metadata': {
                        'module': groups.get('module'),
                        'line': groups.get('line'),
                    },
                }
        
        return None
    
    def _parse_generic_log(
        self, 
        line: str, 
        tz: pytz.BaseTzInfo,
        format_name: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """解析通用日志格式"""
        timestamp_patterns = [
            r'^(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?)',
            r'^(?P<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[,.]?\d*)',
            r'^(?P<timestamp>\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})',
            r'^\[(?P<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[,.]?\d*)\]',
            r'^\[(?P<timestamp>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}[+-]\d{4})\]',
        ]
        
        for pattern in timestamp_patterns:
            match = re.match(pattern, line)
            if match:
                timestamp_str = match.group('timestamp')
                timestamp = self._parse_timestamp_string(timestamp_str, tz)
                
                if not timestamp:
                    continue
                
                remaining = line[match.end():].strip()
                
                level_match = re.match(r'^[(\[]?(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)[)\]]?', 
                                        remaining, re.IGNORECASE)
                level = 'INFO'
                if level_match:
                    level = level_match.group(1).upper()
                    remaining = remaining[level_match.end():].strip()
                
                return {
                    'timestamp': timestamp,
                    'level': level,
                    'message': remaining or line,
                    'metadata': {},
                }
        
        return None
    
    def _parse_timestamp_string(self, value: str, tz: pytz.BaseTzInfo) -> Optional[datetime]:
        """解析时间戳字符串"""
        value = value.replace(',', '.').strip()
        
        formats = [
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S.%f',
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d %H:%M:%S.%f',
            '%Y/%m/%d %H:%M:%S',
            '%d/%b/%Y:%H:%M:%S %z',
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                
                if dt.tzinfo is None:
                    dt = tz.localize(dt)
                
                return dt.astimezone(pytz.UTC)
            except (ValueError, TypeError):
                continue
        
        try:
            from dateutil import parser as dateutil_parser
            dt = dateutil_parser.parse(value)
            
            if dt.tzinfo is None:
                dt = tz.localize(dt)
            
            return dt.astimezone(pytz.UTC)
        except (ValueError, TypeError):
            pass
        
        return None
    
    def _create_event_from_log_entry(
        self, 
        entry: Dict[str, Any], 
        source_file: str,
    ) -> Optional[Event]:
        """从日志条目创建事件"""
        level = entry.get('level', 'INFO').upper()
        severity = self.LOG_LEVELS.get(level, 'info')
        
        message = entry.get('message', '')
        event_type = self._determine_event_type(message, severity)
        
        title = self._generate_title(message, level, event_type)
        
        event = Event(
            id=str(uuid.uuid4()),
            timestamp=entry['timestamp'],
            original_timestamp=entry['timestamp'].isoformat(),
            event_type=event_type,
            source=EventSource.LOGS,
            source_file=source_file,
            severity=severity,
            title=title,
            description=message,
            raw_content=message,
            tags=[level],
            metadata=entry.get('metadata', {}),
        )
        
        return event
    
    def _determine_event_type(self, message: str, severity: str) -> str:
        """根据日志内容确定事件类型"""
        if severity in ['error', 'critical']:
            return EventType.ERROR_SURGE
        
        return EventType.UNKNOWN
    
    def _generate_title(self, message: str, level: str, event_type: str) -> str:
        """生成事件标题"""
        max_length = 100
        first_line = message.strip().split('\n')[0][:max_length]
        
        if event_type == EventType.ERROR_SURGE:
            return f"[{level}] 错误日志: {first_line}"
        
        return f"[{level}] 日志: {first_line}"
    
    def _detect_error_surges(
        self, 
        error_windows: Dict[str, List[datetime]], 
        source_file: str,
    ) -> List[Event]:
        """检测错误激增事件"""
        events: List[Event] = []
        
        for minute_key, timestamps in error_windows.items():
            if len(timestamps) >= self.SURGE_THRESHOLD:
                sorted_timestamps = sorted(timestamps)
                start_time = sorted_timestamps[0]
                end_time = sorted_timestamps[-1]
                
                event = Event(
                    id=str(uuid.uuid4()),
                    timestamp=start_time,
                    original_timestamp=start_time.isoformat(),
                    event_type=EventType.ERROR_SURGE,
                    source=EventSource.LOGS,
                    source_file=source_file,
                    severity='critical',
                    title=f"错误激增: {minute_key} 出现 {len(timestamps)} 次错误",
                    description=f"在 {start_time} 到 {end_time} 期间检测到 {len(timestamps)} 次错误/警告日志",
                    tags=['error_surge', f'count:{len(timestamps)}'],
                    metadata={
                        'error_count': len(timestamps),
                        'window_start': start_time.isoformat(),
                        'window_end': end_time.isoformat(),
                    },
                )
                events.append(event)
        
        return events
