"""
日志解析模块

支持解析多种日志格式：
- 文本日志（带时间戳）
- JSON 格式日志
- 多行堆栈跟踪
- 处理时间倒序的日志

处理边界情况：
- 多行堆栈（异常堆栈跨越多行）
- 日志时间倒序（需要重新排序）
- JSON 日志里嵌套 token/手机号
"""

import re
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class LogLevel(Enum):
    """日志级别"""
    VERBOSE = "V"
    DEBUG = "D"
    INFO = "I"
    WARN = "W"
    ERROR = "E"
    FATAL = "F"
    UNKNOWN = "?"


@dataclass
class StackFrame:
    """堆栈帧"""
    frame_index: int
    library: str = ""
    address: str = ""
    function: str = ""
    file: str = ""
    line: int = 0
    raw_line: str = ""


@dataclass
class CrashEntry:
    """崩溃条目"""
    crash_id: str = ""
    timestamp: Optional[datetime] = None
    exception_type: str = ""
    exception_message: str = ""
    stack_frames: List[StackFrame] = field(default_factory=list)
    raw_stack: List[str] = field(default_factory=list)
    log_source: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LogEntry:
    """日志条目"""
    raw_text: str
    timestamp: Optional[datetime] = None
    level: LogLevel = LogLevel.UNKNOWN
    tag: str = ""
    message: str = ""
    is_crash: bool = False
    crash_entry: Optional[CrashEntry] = None
    source_file: str = ""
    line_number: int = 0
    json_data: Dict[str, Any] = field(default_factory=dict)


class LogParser:
    """日志解析器"""

    TIMESTAMP_PATTERNS = [
        re.compile(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d{3})?)'),
        re.compile(r'(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)'),
        re.compile(r'\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\]'),
    ]

    LOGCAT_PATTERN = re.compile(
        r'^(?:(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d{3})?)|'
        r'(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d{3})?))?\s*'
        r'(\d+)\s+(\d+)\s+([VDIWEF])\s+([^:]+):\s+(.*)$'
    )

    STACK_FRAME_PATTERNS = [
        re.compile(
            r'^\s*(?:at\s+)?([a-zA-Z_][\w$.]*)\('
            r'([^:]+)(?::(\d+))?\)$'
        ),
        re.compile(
            r'^\s*(\d+)\s+([\w./-]+)\s+0x([0-9a-fA-F]+)\s+'
            r'([\w_]+)\s+\+\s+(\d+)$'
        ),
        re.compile(
            r'^\s*([0-9a-fA-Fx]+)\s+-\s+([0-9a-fA-Fx]+)\s+'
            r'([\w_]+)\s+\(/?([^:]+)(?::(\d+))?\)$'
        ),
    ]

    EXCEPTION_PATTERNS = [
        re.compile(
            r'([\w.]+\.(?:[\w]*Exception|[\w]*Error)):\s*(.+?)(?:\n|$)',
            re.IGNORECASE
        ),
        re.compile(
            r'(FATAL\s+EXCEPTION|CRASH|FATAL):\s*(.+?)(?:\n|$)',
            re.IGNORECASE
        ),
        re.compile(
            r'(?:Caused by:)\s*([\w.]+(?:[\w]*Exception|[\w]*Error))(?::\s*(.+?))?(?:\n|$)',
            re.IGNORECASE
        ),
    ]

    def __init__(self):
        self._current_stack: List[str] = []
        self._in_stack = False

    def parse_file(self, file_path: str) -> List[LogEntry]:
        """解析单个日志文件"""
        entries = []
        line_num = 0

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
        except Exception as e:
            print(f"Warning: Failed to read {file_path}: {e}")
            return entries

        current_entry: Optional[LogEntry] = None
        self._current_stack = []
        self._in_stack = False

        for line in lines:
            line_num += 1
            line = line.rstrip('\n\r')

            if self._is_json_line(line):
                if current_entry:
                    entries.append(current_entry)
                json_entry = self._parse_json_line(line, file_path, line_num)
                entries.append(json_entry)
                current_entry = None
                continue

            is_new_entry = self._is_new_log_entry(line)

            if is_new_entry:
                if current_entry:
                    if self._in_stack and self._current_stack:
                        self._process_stack(current_entry)
                    entries.append(current_entry)

                current_entry = self._parse_text_line(line, file_path, line_num)
                self._current_stack = []
                self._in_stack = False
            elif current_entry:
                if self._is_stack_line(line):
                    self._in_stack = True
                    self._current_stack.append(line)

                if current_entry.timestamp is None:
                    ts = self._extract_timestamp(line)
                    if ts:
                        current_entry.timestamp = ts

                current_entry.message += '\n' + line
                current_entry.raw_text += '\n' + line

        if current_entry:
            if self._in_stack and self._current_stack:
                self._process_stack(current_entry)
            entries.append(current_entry)

        return entries

    def parse_directory(self, dir_path: str) -> List[LogEntry]:
        """解析日志目录中的所有日志文件"""
        all_entries = []
        log_extensions = {'.log', '.txt', '.crash', '.trace', '.json'}

        if not os.path.isdir(dir_path):
            raise ValueError(f"Directory not found: {dir_path}")

        for root, _, files in os.walk(dir_path):
            for file_name in files:
                ext = os.path.splitext(file_name)[1].lower()
                if ext in log_extensions or not ext:
                    file_path = os.path.join(root, file_name)
                    entries = self.parse_file(file_path)
                    all_entries.extend(entries)

        return all_entries

    def sort_by_time(self, entries: List[LogEntry], reverse: bool = False) -> List[LogEntry]:
        """按时间排序日志条目

        处理时间倒序的日志，将其重新排序为正序
        """
        def sort_key(entry: LogEntry) -> Tuple:
            if entry.timestamp:
                return (0, entry.timestamp)
            return (1, entry.line_number)

        return sorted(entries, key=sort_key, reverse=reverse)

    def _is_json_line(self, line: str) -> bool:
        """判断是否为 JSON 格式的日志行"""
        stripped = line.strip()
        return stripped.startswith('{') and stripped.endswith('}')

    def _parse_json_line(self, line: str, source_file: str, line_num: int) -> LogEntry:
        """解析 JSON 格式的日志行"""
        entry = LogEntry(
            raw_text=line,
            source_file=source_file,
            line_number=line_num
        )

        try:
            data = json.loads(line)
            entry.json_data = data

            timestamp = self._extract_timestamp_from_json(data)
            if timestamp:
                entry.timestamp = timestamp

            level_str = self._get_nested_value(data, ['level', 'logLevel', 'severity'])
            if level_str:
                entry.level = self._parse_level(str(level_str))

            tag = self._get_nested_value(data, ['tag', 'logger', 'category'])
            if tag:
                entry.tag = str(tag)

            message = self._get_nested_value(data, ['message', 'msg', 'logMessage', 'content'])
            if message:
                entry.message = str(message)

            exception = self._get_nested_value(data, ['exception', 'error', 'throwable'])
            if exception:
                entry.is_crash = True
                crash = self._parse_json_exception(exception)
                crash.log_source = source_file
                entry.crash_entry = crash

        except json.JSONDecodeError:
            entry.message = line

        return entry

    def _get_nested_value(self, data: Dict, keys: List[str]) -> Any:
        """从嵌套字典中获取值"""
        for key in keys:
            if key in data:
                return data[key]
            if '.' in key:
                parts = key.split('.')
                value = data
                for part in parts:
                    if isinstance(value, dict) and part in value:
                        value = value[part]
                    else:
                        value = None
                        break
                if value is not None:
                    return value
        return None

    def _extract_timestamp_from_json(self, data: Dict) -> Optional[datetime]:
        """从 JSON 中提取时间戳"""
        timestamp_keys = [
            'timestamp', 'time', '@timestamp', 'datetime',
            'eventTime', 'logTime', 'createdAt'
        ]

        for key in timestamp_keys:
            value = self._get_nested_value(data, [key])
            if value:
                parsed = self._parse_timestamp(str(value))
                if parsed:
                    return parsed

        return None

    def _is_new_log_entry(self, line: str) -> bool:
        """判断是否为新日志条目的开始"""
        if not line.strip():
            return False

        logcat_match = self.LOGCAT_PATTERN.match(line)
        if logcat_match:
            message = logcat_match.group(7).strip()

            if self._is_stack_line_in_message(message):
                return False

            return True

        has_timestamp = False
        stripped = line.strip()
        for pattern in self.TIMESTAMP_PATTERNS:
            if pattern.match(stripped[:50]):
                has_timestamp = True
                break

        if has_timestamp:
            return True

        return False

    def _is_stack_line_in_message(self, message: str) -> bool:
        """检查消息部分是否包含堆栈帧或异常消息（可能有标签前缀）"""
        stripped = message.strip()

        if re.search(r'^[\w.]+\.(?:[\w]*Exception|[\w]*Error):', stripped):
            return True

        if '\t' in stripped:
            parts = stripped.split('\t', 1)
            if len(parts) > 1:
                stripped = parts[1].strip()

        if re.search(r'^\s*at\s+[\w$.]+\(', stripped):
            return True

        if re.search(r'^\s*Caused\s+by:', stripped, re.IGNORECASE):
            return True

        if re.search(r'^\s*\.\.\.\s+\d+\s+more', stripped):
            return True

        return False

    def _is_exception_start(self, line: str) -> bool:
        """判断是否为异常开始"""
        for pattern in self.EXCEPTION_PATTERNS:
            if pattern.search(line):
                return True
        return False

    def _is_stack_line(self, line: str) -> bool:
        """判断是否为堆栈行"""
        stripped = line.strip()

        logcat_match = self.LOGCAT_PATTERN.match(line)
        if logcat_match:
            message = logcat_match.group(7).strip()
            return self._is_stack_line_in_message(message)

        if stripped.startswith('at '):
            return True
        if stripped.startswith('Caused by:'):
            return True
        if re.match(r'^\s*\d+\s+[\w./-]+\s+0x[0-9a-fA-F]+', stripped):
            return True
        if re.match(r'^\s*[0-9a-fA-Fx]+\s+-\s+[0-9a-fA-Fx]+', stripped):
            return True

        if re.search(r'^\s*at\s+[\w$.]+\(', stripped):
            return True
        if re.search(r'^\s*Caused\s+by:', stripped, re.IGNORECASE):
            return True
        if re.search(r'^\s*\.\.\.\s+\d+\s+more', stripped):
            return True

        return False

    def _parse_text_line(self, line: str, source_file: str, line_num: int) -> LogEntry:
        """解析文本格式的日志行"""
        entry = LogEntry(
            raw_text=line,
            source_file=source_file,
            line_number=line_num
        )

        logcat_match = self.LOGCAT_PATTERN.match(line)
        if logcat_match:
            ts_str = logcat_match.group(1) or logcat_match.group(2)
            if ts_str:
                entry.timestamp = self._parse_logcat_timestamp(ts_str)

            level_char = logcat_match.group(5)
            entry.level = self._parse_level(level_char)

            entry.tag = logcat_match.group(6).strip()
            entry.message = logcat_match.group(7).strip()

            if self._is_exception_start(entry.message):
                entry.is_crash = True
        else:
            entry.timestamp = self._extract_timestamp(line)

            level_match = re.search(r'\b([VDIWEF]|VERBOSE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\b', line, re.IGNORECASE)
            if level_match:
                entry.level = self._parse_level(level_match.group(1))

            if self._is_exception_start(line):
                entry.is_crash = True

            entry.message = line

        return entry

    def _extract_timestamp(self, line: str) -> Optional[datetime]:
        """从行中提取时间戳"""
        for pattern in self.TIMESTAMP_PATTERNS:
            match = pattern.search(line[:100])
            if match:
                ts_str = match.group(1)
                parsed = self._parse_timestamp(ts_str)
                if parsed:
                    return parsed
        return None

    def _parse_timestamp(self, ts_str: str) -> Optional[datetime]:
        """解析时间戳字符串"""
        formats = [
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S",
            "%H:%M:%S.%f",
            "%H:%M:%S",
        ]

        ts_str = ts_str.strip()

        for fmt in formats:
            try:
                dt = datetime.strptime(ts_str, fmt)
                if dt.year == 1900:
                    now = datetime.now()
                    dt = dt.replace(year=now.year, month=now.month, day=now.day)
                return dt
            except ValueError:
                continue

        try:
            from dateutil import parser
            return parser.parse(ts_str, fuzzy=True)
        except (ImportError, Exception):
            pass

        return None

    def _parse_logcat_timestamp(self, ts_str: str) -> Optional[datetime]:
        """解析 Logcat 时间戳格式 (MM-DD HH:MM:SS.mmm)"""
        try:
            now = datetime.now()
            dt = datetime.strptime(ts_str, "%m-%d %H:%M:%S.%f")
            dt = dt.replace(year=now.year)
            return dt
        except ValueError:
            try:
                dt = datetime.strptime(ts_str, "%m-%d %H:%M:%S")
                dt = dt.replace(year=datetime.now().year)
                return dt
            except ValueError:
                return self._parse_timestamp(ts_str)

    def _parse_level(self, level_str: str) -> LogLevel:
        """解析日志级别"""
        level_map = {
            'V': LogLevel.VERBOSE,
            'VERBOSE': LogLevel.VERBOSE,
            'D': LogLevel.DEBUG,
            'DEBUG': LogLevel.DEBUG,
            'I': LogLevel.INFO,
            'INFO': LogLevel.INFO,
            'W': LogLevel.WARN,
            'WARN': LogLevel.WARN,
            'WARNING': LogLevel.WARN,
            'E': LogLevel.ERROR,
            'ERROR': LogLevel.ERROR,
            'F': LogLevel.FATAL,
            'FATAL': LogLevel.FATAL,
        }

        upper = level_str.upper().strip()
        return level_map.get(upper, LogLevel.UNKNOWN)

    def _process_stack(self, entry: LogEntry):
        """处理堆栈跟踪"""
        if not self._current_stack:
            return

        crash = CrashEntry()
        crash.raw_stack = self._current_stack.copy()
        crash.log_source = entry.source_file
        crash.timestamp = entry.timestamp

        full_stack_text = '\n'.join([entry.message] + self._current_stack)

        for pattern in self.EXCEPTION_PATTERNS:
            match = pattern.search(full_stack_text)
            if match:
                if len(match.groups()) >= 1:
                    crash.exception_type = match.group(1).strip()
                if len(match.groups()) >= 2 and match.group(2):
                    crash.exception_message = match.group(2).strip()
                break

        crash.stack_frames = self._parse_stack_frames(self._current_stack)
        entry.crash_entry = crash
        entry.is_crash = True

    def _parse_stack_frames(self, stack_lines: List[str]) -> List[StackFrame]:
        """解析堆栈帧"""
        frames = []
        frame_index = 0

        for line in stack_lines:
            frame = self._parse_single_stack_frame(line, frame_index)
            if frame:
                frames.append(frame)
                frame_index += 1

        return frames

    def _parse_single_stack_frame(self, line: str, index: int) -> Optional[StackFrame]:
        """解析单个堆栈帧"""
        stripped = line.strip()

        for pattern in self.STACK_FRAME_PATTERNS:
            match = pattern.match(stripped)
            if match:
                frame = StackFrame(frame_index=index, raw_line=line)

                groups = match.groups()
                if len(groups) >= 1:
                    if match.re.pattern.startswith(r'^\s*(?:at\s+)?'):
                        frame.function = groups[0] if groups[0] else ""
                        frame.file = groups[1] if len(groups) > 1 and groups[1] else ""
                        if len(groups) > 2 and groups[2]:
                            try:
                                frame.line = int(groups[2])
                            except ValueError:
                                pass
                    else:
                        frame.library = groups[1] if len(groups) > 1 and groups[1] else ""
                        frame.address = groups[2] if len(groups) > 2 and groups[2] else ""
                        frame.function = groups[3] if len(groups) > 3 and groups[3] else ""

                return frame

        return None

    def _parse_json_exception(self, exception_data: Any) -> CrashEntry:
        """解析 JSON 格式的异常"""
        crash = CrashEntry()

        if isinstance(exception_data, dict):
            crash.exception_type = str(exception_data.get('type', exception_data.get('exceptionClass', '')))
            crash.exception_message = str(exception_data.get('message', exception_data.get('detailMessage', '')))

            stack_trace = exception_data.get('stackTrace', exception_data.get('frames', []))
            if isinstance(stack_trace, list):
                for i, frame_data in enumerate(stack_trace):
                    frame = StackFrame(frame_index=i)
                    if isinstance(frame_data, dict):
                        frame.function = str(frame_data.get('methodName', frame_data.get('function', '')))
                        frame.file = str(frame_data.get('fileName', frame_data.get('file', '')))
                        line = frame_data.get('lineNumber', frame_data.get('line', 0))
                        try:
                            frame.line = int(line)
                        except (ValueError, TypeError):
                            pass
                        frame.library = str(frame_data.get('className', frame_data.get('library', '')))
                    elif isinstance(frame_data, str):
                        frame.raw_line = frame_data
                    crash.stack_frames.append(frame)

            raw_stack = exception_data.get('rawStackTrace', exception_data.get('stack', ''))
            if raw_stack:
                if isinstance(raw_stack, list):
                    crash.raw_stack = [str(s) for s in raw_stack]
                else:
                    crash.raw_stack = str(raw_stack).split('\n')

        elif isinstance(exception_data, str):
            crash.exception_type = "Exception"
            crash.exception_message = exception_data
            crash.raw_stack = exception_data.split('\n')

        return crash
