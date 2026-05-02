import re
from pathlib import Path
from typing import List, Optional, Pattern, Tuple
from datetime import datetime

from meeting_screen_inspector.models.models import (
    SerialLog,
    SerialLogEntry,
    SerialPortInfo,
)


class SerialLogParser:
    LOG_LINE_PATTERNS: List[Tuple[Pattern, str]] = [
        (
            re.compile(r'^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(\w+)\s+(\w+):\s*(.*)$'),
            "full_format"
        ),
        (
            re.compile(r'^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(\w+)\s+(\w+):\s*(.*)$'),
            "time_only_format"
        ),
        (
            re.compile(r'^\[(.*?)\]\s*(\w+):?\s*(.*)$'),
            "bracket_format"
        ),
    ]
    
    REBOOT_PATTERNS: List[Pattern] = [
        re.compile(r'(?:reboot|restart|reset|power\s*on|booting|system\s*start|starting\s+up)', re.IGNORECASE),
        re.compile(r'(?:内核|重启|开机|启动)', re.UNICODE),
    ]
    
    VERSION_PATTERNS: List[Pattern] = [
        re.compile(r'(?:version|ver|firmware|fw)\s*[:=]\s*([\d\w\.\-]+)', re.IGNORECASE),
        re.compile(r'(?:V|v)(\d+\.\d+\.\d+(?:\.\d+)?)'),
        re.compile(r'(?:版本|固件)\s*[:：]\s*([\d\w\.\-]+)', re.UNICODE),
    ]
    
    BAUDRATE_PATTERNS: List[Pattern] = [
        re.compile(r'(?:baud\s*rate|baudrate|波特率)\s*[:=]\s*(\d+)', re.IGNORECASE),
    ]

    def __init__(self):
        self.detected_baudrate: Optional[int] = None
        self.detected_version: Optional[str] = None
        self.reboot_count: int = 0
        self.last_reboot_time: Optional[str] = None

    def parse_file(self, file_path: Path, expected_baudrate: Optional[int] = None) -> SerialLog:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        return self.parse_content(content, file_path.name, expected_baudrate)

    def parse_content(self, content: str, filename: str, expected_baudrate: Optional[int] = None) -> SerialLog:
        self._reset()
        
        lines = content.splitlines()
        entries: List[SerialLogEntry] = []
        
        for line in lines:
            entry = self._parse_line(line)
            if entry:
                entries.append(entry)
                self._analyze_entry(entry)
        
        port_info = None
        if expected_baudrate or self.detected_baudrate:
            port_info = SerialPortInfo(
                baud_rate=expected_baudrate if expected_baudrate else (self.detected_baudrate or 115200),
                detected_baud_rate=self.detected_baudrate,
            )
        
        return SerialLog(
            filename=filename,
            raw_content=content,
            entries=entries,
            port_info=port_info,
            detected_version=self.detected_version,
            reboot_count=self.reboot_count,
            last_reboot_time=self.last_reboot_time,
        )

    def _reset(self):
        self.detected_baudrate = None
        self.detected_version = None
        self.reboot_count = 0
        self.last_reboot_time = None

    def _parse_line(self, line: str) -> Optional[SerialLogEntry]:
        stripped_line = line.strip()
        if not stripped_line:
            return None
        
        for pattern, fmt_type in self.LOG_LINE_PATTERNS:
            match = pattern.match(stripped_line)
            if match:
                if fmt_type == "full_format":
                    timestamp, level, module, message = match.groups()
                    return SerialLogEntry(
                        timestamp=timestamp,
                        level=level,
                        module=module,
                        message=message,
                        raw_line=stripped_line,
                    )
                elif fmt_type == "time_only_format":
                    timestamp, level, module, message = match.groups()
                    return SerialLogEntry(
                        timestamp=timestamp,
                        level=level,
                        module=module,
                        message=message,
                        raw_line=stripped_line,
                    )
                elif fmt_type == "bracket_format":
                    bracket_content, identifier, message = match.groups()
                    return SerialLogEntry(
                        timestamp=bracket_content,
                        module=identifier,
                        message=message,
                        raw_line=stripped_line,
                    )
        
        return SerialLogEntry(
            message=stripped_line,
            raw_line=stripped_line,
        )

    def _analyze_entry(self, entry: SerialLogEntry):
        for pattern in self.REBOOT_PATTERNS:
            if pattern.search(entry.message) or pattern.search(entry.raw_line):
                entry.reboot_indicator = True
                self.reboot_count += 1
                self.last_reboot_time = entry.timestamp
        
        for pattern in self.VERSION_PATTERNS:
            match = pattern.search(entry.message) or pattern.search(entry.raw_line)
            if match:
                version = match.group(1)
                entry.version_indicator = version
                if not self.detected_version:
                    self.detected_version = version
        
        for pattern in self.BAUDRATE_PATTERNS:
            match = pattern.search(entry.message) or pattern.search(entry.raw_line)
            if match:
                try:
                    baud = int(match.group(1))
                    self.detected_baudrate = baud
                except ValueError:
                    pass
