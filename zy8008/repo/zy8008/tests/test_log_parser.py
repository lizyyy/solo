"""测试日志解析模块"""

import pytest
import tempfile
import os
from datetime import datetime

from crashlog_tool.log_parser import (
    LogParser, LogEntry, LogLevel, CrashEntry, StackFrame
)


class TestLogParser:
    """测试日志解析器"""

    def setup_method(self):
        self.parser = LogParser()

    def test_parse_simple_log_line(self):
        """测试解析简单日志行"""
        test_content = "2024-01-15 14:30:00 INFO: Test message"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.log', delete=False) as f:
            f.write(test_content)
            temp_path = f.name
        
        try:
            entries = self.parser.parse_file(temp_path)
            
            assert len(entries) == 1
            assert entries[0].level == LogLevel.INFO
            assert "Test message" in entries[0].message
        finally:
            os.unlink(temp_path)

    def test_parse_android_logcat(self):
        """测试解析 Android Logcat 格式"""
        test_content = """2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: FATAL EXCEPTION: main
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: java.lang.NullPointerException: Test
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at com.example.Test.method(Test.java:123)
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(test_content)
            temp_path = f.name
        
        try:
            entries = self.parser.parse_file(temp_path)
            
            assert len(entries) >= 1
            crash_entries = [e for e in entries if e.is_crash]
            assert len(crash_entries) >= 1
            assert crash_entries[0].crash_entry is not None
        finally:
            os.unlink(temp_path)

    def test_parse_json_log(self):
        """测试解析 JSON 格式日志"""
        test_content = '{"timestamp": "2024-01-15T14:30:00Z", "level": "ERROR", "message": "Test error", "exception": {"type": "NullPointerException", "message": "test"}}'
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write(test_content)
            temp_path = f.name
        
        try:
            entries = self.parser.parse_file(temp_path)
            
            assert len(entries) == 1
            assert entries[0].json_data is not None
            assert entries[0].json_data.get("level") == "ERROR"
        finally:
            os.unlink(temp_path)

    def test_sort_by_time(self):
        """测试按时间排序"""
        entries = [
            LogEntry(raw_text="3", timestamp=datetime(2024, 1, 15, 14, 30, 3)),
            LogEntry(raw_text="1", timestamp=datetime(2024, 1, 15, 14, 30, 1)),
            LogEntry(raw_text="2", timestamp=datetime(2024, 1, 15, 14, 30, 2)),
        ]
        
        sorted_entries = self.parser.sort_by_time(entries)
        
        assert sorted_entries[0].timestamp == datetime(2024, 1, 15, 14, 30, 1)
        assert sorted_entries[1].timestamp == datetime(2024, 1, 15, 14, 30, 2)
        assert sorted_entries[2].timestamp == datetime(2024, 1, 15, 14, 30, 3)

    def test_parse_multiline_stack(self):
        """测试解析多行堆栈"""
        test_content = """2024-01-15 14:30:00 ERROR: Exception occurred
java.lang.RuntimeException: Test exception
    at com.example.ClassA.methodA(ClassA.java:100)
    at com.example.ClassB.methodB(ClassB.java:200)
    at com.example.ClassC.main(ClassC.java:50)
Caused by: java.lang.NullPointerException: null
    at com.example.Helper.getValue(Helper.java:15)
    ... 2 more
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.log', delete=False) as f:
            f.write(test_content)
            temp_path = f.name
        
        try:
            entries = self.parser.parse_file(temp_path)
            
            assert len(entries) >= 1
            crash_entries = [e for e in entries if e.is_crash]
            assert len(crash_entries) >= 1
            assert crash_entries[0].crash_entry is not None
            assert "RuntimeException" in crash_entries[0].crash_entry.exception_type
        finally:
            os.unlink(temp_path)

    def test_parse_directory(self):
        """测试解析目录"""
        with tempfile.TemporaryDirectory() as temp_dir:
            log1 = os.path.join(temp_dir, "log1.txt")
            log2 = os.path.join(temp_dir, "log2.log")
            
            with open(log1, 'w') as f:
                f.write("2024-01-15 14:30:00 INFO: Log 1\n")
            
            with open(log2, 'w') as f:
                f.write("2024-01-15 14:31:00 INFO: Log 2\n")
            
            entries = self.parser.parse_directory(temp_dir)
            
            assert len(entries) == 2

    def test_parse_timestamp(self):
        """测试时间戳解析"""
        test_cases = [
            ("2024-01-15 14:30:00", True),
            ("2024-01-15 14:30:00.123", True),
            ("2024-01-15T14:30:00Z", True),
            ("14:30:00", True),
            ("invalid", False),
        ]
        
        for ts_str, should_parse in test_cases:
            result = self.parser._parse_timestamp(ts_str)
            if should_parse:
                assert result is not None, f"Should parse: {ts_str}"
            else:
                assert result is None or isinstance(result, datetime)


class TestLogLevel:
    """测试日志级别"""

    def test_level_parsing(self):
        """测试日志级别解析"""
        parser = LogParser()
        
        test_cases = [
            ("V", LogLevel.VERBOSE),
            ("VERBOSE", LogLevel.VERBOSE),
            ("D", LogLevel.DEBUG),
            ("DEBUG", LogLevel.DEBUG),
            ("I", LogLevel.INFO),
            ("INFO", LogLevel.INFO),
            ("W", LogLevel.WARN),
            ("WARN", LogLevel.WARN),
            ("WARNING", LogLevel.WARN),
            ("E", LogLevel.ERROR),
            ("ERROR", LogLevel.ERROR),
            ("F", LogLevel.FATAL),
            ("FATAL", LogLevel.FATAL),
            ("UNKNOWN", LogLevel.UNKNOWN),
        ]
        
        for level_str, expected in test_cases:
            result = parser._parse_level(level_str)
            assert result == expected, f"Expected {expected} for {level_str}, got {result}"
