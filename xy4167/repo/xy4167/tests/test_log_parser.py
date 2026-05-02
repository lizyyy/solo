import pytest
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.log_parser import LogParser, LogEntry, LogLevel, UpgradeEventType


class TestLogParser:
    def setup_method(self):
        self.parser = LogParser()
    
    def test_parse_timestamp_format1(self):
        line = "2024-01-15 09:30:00.123 [INFO] Test message"
        entry = self.parser._parse_line(line, 1)
        
        assert entry is not None
        assert entry.timestamp is not None
        assert entry.timestamp.hour == 9
        assert entry.timestamp.minute == 30
    
    def test_parse_timestamp_format2(self):
        line = "[2024-01-15 09:30:00.123] [INFO] Test message"
        entry = self.parser._parse_line(line, 1)
        
        assert entry is not None
        assert entry.timestamp is not None
    
    def test_parse_level_info(self):
        line = "2024-01-15 09:30:00.123 [INFO] Test message"
        entry = self.parser._parse_line(line, 1)
        
        assert entry.level == LogLevel.INFO
    
    def test_parse_level_error(self):
        line = "2024-01-15 09:30:00.123 [ERROR] Something went wrong"
        entry = self.parser._parse_line(line, 1)
        
        assert entry.level == LogLevel.ERROR
    
    def test_parse_event_handshake(self):
        line = "2024-01-15 09:30:00.123 [INFO] 开始设备连接 - 握手"
        entry = self.parser._parse_line(line, 1)
        
        assert entry.event_type == UpgradeEventType.HANDSHAKE
    
    def test_parse_event_crc_fail(self):
        line = "2024-01-15 09:30:00.123 [ERROR] CRC校验失败"
        entry = self.parser._parse_line(line, 1)
        
        assert entry.event_type == UpgradeEventType.CRC_FAIL
    
    def test_parse_version_extraction(self):
        line = "2024-01-15 09:30:00.123 [INFO] 当前版本 VER: 1.2.0"
        entry = self.parser._parse_line(line, 1)
        
        assert entry.get('version') == '1.2.0'
    
    def test_parse_progress_extraction(self):
        line = "2024-01-15 09:30:00.123 [INFO] 传输进度: 50%"
        entry = self.parser._parse_line(line, 1)
        
        assert entry.get('progress') == 50
    
    def test_parse_crc_extraction(self):
        line = "2024-01-15 09:30:00.123 [INFO] CRC: A1B2C3D4"
        entry = self.parser._parse_line(line, 1)
        
        assert entry.get('crc') == 'A1B2C3D4'
    
    def test_parse_multiple_entries(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:01.000 [INFO] 版本 1.2.0
2024-01-15 09:30:05.000 [INFO] 传输进度: 25%
2024-01-15 09:30:20.000 [INFO] CRC: A1B2C3D4 校验通过
"""
        entries = self.parser.parse_string(content)
        
        assert len(entries) == 4
        assert entries[0].event_type == UpgradeEventType.HANDSHAKE
        assert entries[3].event_type == UpgradeEventType.CRC_PASS
    
    def test_empty_line(self):
        entry = self.parser._parse_line("", 1)
        
        assert entry is None
    
    def test_get_entries_by_event(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:01.000 [INFO] 版本 1.2.0
2024-01-15 09:30:20.000 [INFO] CRC: A1B2C3D4 校验通过
"""
        self.parser.parse_string(content)
        
        handshake_entries = self.parser.get_entries_by_event(UpgradeEventType.HANDSHAKE)
        assert len(handshake_entries) == 1
    
    def test_get_time_range(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:01.000 [INFO] 版本 1.2.0
2024-01-15 09:30:20.000 [INFO] 完成
"""
        self.parser.parse_string(content)
        
        start, end = self.parser.get_time_range()
        assert start is not None
        assert end is not None
        assert start < end
