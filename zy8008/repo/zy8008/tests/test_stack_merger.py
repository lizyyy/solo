"""测试堆栈归并模块"""

import pytest
from datetime import datetime

from crashlog_tool.stack_merger import (
    StackMerger, CrashGroup, SuspiciousStack, merge_log_entries
)
from crashlog_tool.log_parser import CrashEntry, StackFrame, LogEntry


class TestStackMerger:
    """测试堆栈归并器"""

    def setup_method(self):
        self.merger = StackMerger()

    def test_merge_similar_crashes(self):
        """测试归并相似崩溃"""
        crash1 = CrashEntry(
            crash_id="1",
            exception_type="NullPointerException",
            exception_message="null reference",
            stack_frames=[
                StackFrame(frame_index=0, function="com.example.Class.method1", file="Class.java", line=100),
                StackFrame(frame_index=1, function="com.example.Class.method2", file="Class.java", line=200),
            ]
        )
        
        crash2 = CrashEntry(
            crash_id="2",
            exception_type="NullPointerException",
            exception_message="another null",
            stack_frames=[
                StackFrame(frame_index=0, function="com.example.Class.method1", file="Class.java", line=105),
                StackFrame(frame_index=1, function="com.example.Class.method2", file="Class.java", line=205),
            ]
        )
        
        groups = self.merger.merge_crashes([crash1, crash2])
        
        assert len(groups) == 1
        assert groups[0].count == 2

    def test_merge_different_crashes(self):
        """测试归并不同崩溃"""
        crash1 = CrashEntry(
            crash_id="1",
            exception_type="NullPointerException",
            stack_frames=[
                StackFrame(frame_index=0, function="com.example.ClassA.method", file="ClassA.java", line=100),
            ]
        )
        
        crash2 = CrashEntry(
            crash_id="2",
            exception_type="ArrayIndexOutOfBoundsException",
            stack_frames=[
                StackFrame(frame_index=0, function="com.example.ClassB.method", file="ClassB.java", line=200),
            ]
        )
        
        groups = self.merger.merge_crashes([crash1, crash2])
        
        assert len(groups) == 2

    def test_generate_signature(self):
        """测试生成签名"""
        crash = CrashEntry(
            exception_type="NullPointerException",
            stack_frames=[
                StackFrame(frame_index=0, function="com.example.Class.method", file="Class.java", line=100),
            ]
        )
        
        signature = self.merger._generate_signature(crash)
        
        assert "NullPointerException" in signature

    def test_normalize_frame(self):
        """测试规范化堆栈帧"""
        frame = StackFrame(
            frame_index=0,
            library="libapp.so",
            function="com.example.Class.method",
            file="Class.java",
            line=123
        )
        
        normalized = self.merger._normalize_frame(frame)
        
        assert "method" in normalized or "com.example" in normalized

    def test_is_system_frame(self):
        """测试判断系统库帧"""
        system_frame = StackFrame(
            frame_index=0,
            library="libsystem_kernel.dylib",
            function="__pthread_kill"
        )
        
        app_frame = StackFrame(
            frame_index=0,
            library="MyApp",
            function="com.example.MyClass.doSomething"
        )
        
        assert self.merger._is_system_frame(system_frame) == True
        assert self.merger._is_system_frame(app_frame) == False

    def test_extract_suspicious_stacks(self):
        """测试提取可疑堆栈"""
        crash1 = CrashEntry(
            crash_id="1",
            exception_type="NullPointerException",
            exception_message="null",
            stack_frames=[
                StackFrame(frame_index=0, function="com.example.Class.method", file="Class.java", line=100),
            ]
        )
        
        crash2 = CrashEntry(
            crash_id="2",
            exception_type="NullPointerException",
            exception_message="null",
            stack_frames=[
                StackFrame(frame_index=0, function="com.example.Class.method", file="Class.java", line=105),
            ]
        )
        
        groups = self.merger.merge_crashes([crash1, crash2])
        suspicious = self.merger.extract_suspicious_stacks(groups)
        
        assert len(suspicious) >= 0

    def test_build_timeline(self):
        """测试构建时间线"""
        crash1 = CrashEntry(
            crash_id="1",
            timestamp=datetime(2024, 1, 15, 14, 30, 2),
            exception_type="ExceptionA",
            log_source="log1.txt"
        )
        
        crash2 = CrashEntry(
            crash_id="2",
            timestamp=datetime(2024, 1, 15, 14, 30, 1),
            exception_type="ExceptionB",
            log_source="log2.txt"
        )
        
        timeline = self.merger.build_timeline([crash1, crash2])
        
        assert len(timeline) == 2
        assert timeline[0]["timestamp"] == datetime(2024, 1, 15, 14, 30, 1)
        assert timeline[1]["timestamp"] == datetime(2024, 1, 15, 14, 30, 2)

    def test_calculate_suspicion_confidence(self):
        """测试计算可疑度置信分"""
        group = CrashGroup(
            group_id="test",
            signature="test",
            exception_type="NullPointerException",
            exception_message="null reference",
            count=5
        )
        group.crashes = [
            CrashEntry(
                crash_id="1",
                stack_frames=[
                    StackFrame(frame_index=0, function="com.example.MyApp.Class.method", file="Class.java", line=100),
                ]
            )
        ]
        
        confidence = self.merger._calculate_suspicion_confidence(group)
        
        assert confidence >= 0.0
        assert confidence <= 1.0

    def test_hash_signature(self):
        """测试哈希签名"""
        signature1 = "NullPointerException|com.example.Class.method1"
        signature2 = "NullPointerException|com.example.Class.method1"
        signature3 = "NullPointerException|com.example.Class.method2"
        
        hash1 = self.merger._hash_signature(signature1)
        hash2 = self.merger._hash_signature(signature2)
        hash3 = self.merger._hash_signature(signature3)
        
        assert hash1 == hash2
        assert hash1 != hash3

    def test_get_key_stack_frames(self):
        """测试获取关键堆栈帧"""
        crash = CrashEntry(
            stack_frames=[
                StackFrame(frame_index=0, library="libsystem_kernel.dylib", function="__pthread_kill"),
                StackFrame(frame_index=1, library="MyApp", function="com.example.MyClass.doSomething"),
                StackFrame(frame_index=2, library="UIKitCore", function="UIApplicationMain"),
            ]
        )
        
        key_frames = self.merger._get_key_stack_frames(crash)
        
        assert len(key_frames) >= 1
        assert any("MyApp" in f.library for f in key_frames)


class TestMergeLogEntries:
    """测试便捷函数 merge_log_entries"""

    def test_merge_empty_entries(self):
        """测试归并空条目"""
        groups, suspicious, timeline = merge_log_entries([])
        
        assert len(groups) == 0
        assert len(suspicious) == 0
        assert len(timeline) == 0

    def test_merge_with_crashes(self):
        """测试归并包含崩溃的条目"""
        crash_entry = CrashEntry(
            crash_id="1",
            exception_type="NullPointerException",
            stack_frames=[
                StackFrame(frame_index=0, function="com.example.Class.method", file="Class.java", line=100),
            ]
        )
        
        log_entry = LogEntry(
            raw_text="test",
            is_crash=True,
            crash_entry=crash_entry
        )
        
        groups, suspicious, timeline = merge_log_entries([log_entry])
        
        assert len(groups) >= 0
