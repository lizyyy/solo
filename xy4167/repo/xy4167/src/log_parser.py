import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class UpgradeEventType(Enum):
    HANDSHAKE = "HANDSHAKE"
    VERSION_CHECK = "VERSION_CHECK"
    FIRMWARE_INFO = "FIRMWARE_INFO"
    TRANSFER_START = "TRANSFER_START"
    TRANSFER_PROGRESS = "TRANSFER_PROGRESS"
    TRANSFER_COMPLETE = "TRANSFER_COMPLETE"
    CRC_CHECK = "CRC_CHECK"
    CRC_PASS = "CRC_PASS"
    CRC_FAIL = "CRC_FAIL"
    FLASH_START = "FLASH_START"
    FLASH_PROGRESS = "FLASH_PROGRESS"
    FLASH_COMPLETE = "FLASH_COMPLETE"
    REBOOT = "REBOOT"
    ROLLBACK_START = "ROLLBACK_START"
    ROLLBACK_COMPLETE = "ROLLBACK_COMPLETE"
    TIMEOUT = "TIMEOUT"
    RETRY = "RETRY"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    UNKNOWN = "UNKNOWN"


@dataclass
class LogEntry:
    raw_line: str
    line_number: int
    timestamp: Optional[datetime] = None
    level: LogLevel = LogLevel.INFO
    message: str = ""
    event_type: UpgradeEventType = UpgradeEventType.UNKNOWN
    extracted_data: Dict[str, Any] = field(default_factory=dict)
    
    def get(self, key: str, default: Any = None) -> Any:
        return self.extracted_data.get(key, default)


class LogParser:
    TIMESTAMP_PATTERNS = [
        re.compile(r'^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[.,]\d{3})'),
        re.compile(r'^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[.,]\d{3})\]'),
        re.compile(r'^(\d{2}:\d{2}:\d{2}[.,]\d{3})'),
    ]
    
    LEVEL_PATTERNS = [
        re.compile(r'\b(DEBUG|INFO|WARNING|WARN|ERROR|CRITICAL|FATAL)\b', re.IGNORECASE),
    ]
    
    EVENT_PATTERNS = [
        (re.compile(r'(crc.*pass|crc.*ok|校验通过)', re.IGNORECASE), UpgradeEventType.CRC_PASS),
        (re.compile(r'(crc.*fail|crc.*error|校验失败)', re.IGNORECASE), UpgradeEventType.CRC_FAIL),
        (re.compile(r'(transfer\s*complete|传输完成)', re.IGNORECASE), UpgradeEventType.TRANSFER_COMPLETE),
        (re.compile(r'(transfer\s*start|开始传输)', re.IGNORECASE), UpgradeEventType.TRANSFER_START),
        (re.compile(r'(flash\s*complete|烧录完成|写入完成)', re.IGNORECASE), UpgradeEventType.FLASH_COMPLETE),
        (re.compile(r'(flash\s*start|开始烧录|开始写入)', re.IGNORECASE), UpgradeEventType.FLASH_START),
        (re.compile(r'(rollback.*complete|回滚完成)', re.IGNORECASE), UpgradeEventType.ROLLBACK_COMPLETE),
        (re.compile(r'(rollback|回滚)', re.IGNORECASE), UpgradeEventType.ROLLBACK_START),
        (re.compile(r'(timeout|超时)', re.IGNORECASE), UpgradeEventType.TIMEOUT),
        (re.compile(r'(retry|重试)', re.IGNORECASE), UpgradeEventType.RETRY),
        (re.compile(r'(upgrade.*complete|升级完成|upgrade.*success|升级成功)', re.IGNORECASE), UpgradeEventType.SUCCESS),
        (re.compile(r'(version|版本|VER:)', re.IGNORECASE), UpgradeEventType.VERSION_CHECK),
        (re.compile(r'(firmware|固件)', re.IGNORECASE), UpgradeEventType.FIRMWARE_INFO),
        (re.compile(r'(crc|校验)', re.IGNORECASE), UpgradeEventType.CRC_CHECK),
        (re.compile(r'(handshake.*success|握手成功)', re.IGNORECASE), UpgradeEventType.VERSION_CHECK),
        (re.compile(r'(success|成功)', re.IGNORECASE), UpgradeEventType.SUCCESS),
        (re.compile(r'(failure|fail|失败)', re.IGNORECASE), UpgradeEventType.FAILURE),
        (re.compile(r'(reboot|重启)', re.IGNORECASE), UpgradeEventType.REBOOT),
        (re.compile(r'(handshake|握手)', re.IGNORECASE), UpgradeEventType.HANDSHAKE),
    ]
    
    DATA_EXTRACTION_PATTERNS = [
        (re.compile(r'version[:\s]+([\d.]+)', re.IGNORECASE), 'version'),
        (re.compile(r'VER[:\s]+([\d.]+)', re.IGNORECASE), 'version'),
        (re.compile(r'crc[:\s]+([0-9A-Fa-f]+)', re.IGNORECASE), 'crc'),
        (re.compile(r'CRC[:\s]+([0-9A-Fa-f]+)', re.IGNORECASE), 'crc'),
        (re.compile(r'progress[:\s]+(\d+)%', re.IGNORECASE), 'progress'),
        (re.compile(r'(\d+)%', re.IGNORECASE), 'progress'),
        (re.compile(r'size[:\s]+(\d+)', re.IGNORECASE), 'size'),
        (re.compile(r'packet[:\s]+(\d+)', re.IGNORECASE), 'packet'),
        (re.compile(r'retry[:\s]+(\d+)', re.IGNORECASE), 'retry_count'),
        (re.compile(r'attempt[:\s]+(\d+)', re.IGNORECASE), 'retry_count'),
    ]

    def __init__(self):
        self.entries: List[LogEntry] = []
    
    def parse_file(self, file_path: str) -> List[LogEntry]:
        self.entries = []
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line_number, line in enumerate(f, start=1):
                entry = self._parse_line(line.strip(), line_number)
                if entry:
                    self.entries.append(entry)
        return self.entries
    
    def parse_string(self, content: str) -> List[LogEntry]:
        self.entries = []
        for line_number, line in enumerate(content.split('\n'), start=1):
            entry = self._parse_line(line.strip(), line_number)
            if entry:
                self.entries.append(entry)
        return self.entries
    
    def _parse_line(self, line: str, line_number: int) -> Optional[LogEntry]:
        if not line:
            return None
        
        entry = LogEntry(raw_line=line, line_number=line_number)
        
        entry.timestamp = self._extract_timestamp(line)
        entry.level = self._extract_level(line)
        entry.message = self._extract_message(line)
        entry.event_type = self._extract_event_type(line)
        entry.extracted_data = self._extract_data(line)
        
        return entry
    
    def _extract_timestamp(self, line: str) -> Optional[datetime]:
        for pattern in self.TIMESTAMP_PATTERNS:
            match = pattern.search(line)
            if match:
                timestamp_str = match.group(1)
                timestamp_str = timestamp_str.replace(',', '.')
                try:
                    if len(timestamp_str) > 11:
                        return datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S.%f')
                    else:
                        return datetime.strptime(timestamp_str, '%H:%M:%S.%f')
                except ValueError:
                    continue
        return None
    
    def _extract_level(self, line: str) -> LogLevel:
        for pattern in self.LEVEL_PATTERNS:
            match = pattern.search(line)
            if match:
                level_str = match.group(1).upper()
                if level_str == 'WARN':
                    level_str = 'WARNING'
                if level_str == 'FATAL':
                    level_str = 'CRITICAL'
                try:
                    return LogLevel[level_str]
                except KeyError:
                    continue
        return LogLevel.INFO
    
    def _extract_message(self, line: str) -> str:
        for pattern in self.TIMESTAMP_PATTERNS:
            line = pattern.sub('', line)
        
        for pattern in self.LEVEL_PATTERNS:
            line = pattern.sub('', line)
        
        line = re.sub(r'^\s*[\[\]:\-\|]+\s*', '', line)
        return line.strip()
    
    def _extract_event_type(self, line: str) -> UpgradeEventType:
        for pattern, event_type in self.EVENT_PATTERNS:
            if pattern.search(line):
                return event_type
        return UpgradeEventType.UNKNOWN
    
    def _extract_data(self, line: str) -> Dict[str, Any]:
        data = {}
        for pattern, key in self.DATA_EXTRACTION_PATTERNS:
            match = pattern.search(line)
            if match:
                value = match.group(1)
                if key in ['progress', 'size', 'packet', 'retry_count']:
                    try:
                        data[key] = int(value)
                    except ValueError:
                        data[key] = value
                else:
                    data[key] = value
        return data
    
    def get_entries_by_event(self, event_type: UpgradeEventType) -> List[LogEntry]:
        return [e for e in self.entries if e.event_type == event_type]
    
    def get_entries_by_level(self, level: LogLevel) -> List[LogEntry]:
        return [e for e in self.entries if e.level == level]
    
    def get_time_range(self) -> tuple:
        timestamps = [e.timestamp for e in self.entries if e.timestamp]
        if not timestamps:
            return (None, None)
        return (min(timestamps), max(timestamps))
