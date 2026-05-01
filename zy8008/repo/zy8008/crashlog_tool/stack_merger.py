"""
堆栈归并模块

负责将相似的崩溃堆栈进行归类，生成摘要。
支持多种归并策略，按异常类型、堆栈特征等进行分组。
"""

import re
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict

from .log_parser import CrashEntry, StackFrame, LogEntry


@dataclass
class CrashGroup:
    """崩溃分组"""
    group_id: str
    signature: str
    exception_type: str
    exception_message: str
    count: int = 0
    crashes: List[CrashEntry] = field(default_factory=list)
    representative_stack: List[str] = field(default_factory=list)
    first_seen: Any = None
    last_seen: Any = None


@dataclass
class SuspiciousStack:
    """可疑堆栈摘要"""
    rank: int
    confidence: float
    signature: str
    exception_type: str
    key_frames: List[Dict[str, Any]]
    occurrence_count: int
    sample_stack: str


class StackMerger:
    """堆栈归并器"""

    FRAME_NORMALIZE_PATTERNS = [
        (re.compile(r'0x[0-9a-fA-F]+'), '0xADDR'),
        (re.compile(r'\+\s+\d+'), '+ OFFSET'),
        (re.compile(r':\d+'), ':LINE'),
        (re.compile(r'\$\d+'), '$VAR'),
    ]

    LIBRARY_FILTERS = [
        'libsystem_kernel.dylib',
        'libsystem_pthread.dylib',
        'libsystem_malloc.dylib',
        'libobjc.A.dylib',
        'libc++.1.dylib',
        'libdispatch.dylib',
        'CoreFoundation',
        'Foundation',
        'UIKitCore',
        'libart.so',
        'libc.so',
        'libm.so',
        'liblog.so',
        'libandroid_runtime.so',
        'Zygote',
    ]

    SUSPICIOUS_PATTERNS = [
        re.compile(r'NullPointerException|NPE|null', re.IGNORECASE),
        re.compile(r'IndexOutOfBounds|ArrayIndex|OutOfBounds', re.IGNORECASE),
        re.compile(r'IllegalArgument|IllegalState', re.IGNORECASE),
        re.compile(r'NetworkError|IOException|SocketTimeout', re.IGNORECASE),
        re.compile(r'JSONException|ParseError|Deserialization', re.IGNORECASE),
        re.compile(r'OutOfMemory|OOM|MemoryError', re.IGNORECASE),
        re.compile(r'SecurityException|Permission', re.IGNORECASE),
        re.compile(r'Deadlock|ANR|NotResponding', re.IGNORECASE),
    ]

    def __init__(self):
        self._groups: Dict[str, CrashGroup] = {}

    def merge_crashes(self, crashes: List[CrashEntry]) -> List[CrashGroup]:
        """
        归并崩溃列表

        根据堆栈特征将相似的崩溃分组
        """
        self._groups.clear()

        for crash in crashes:
            signature = self._generate_signature(crash)
            group_id = self._hash_signature(signature)

            if group_id not in self._groups:
                group = CrashGroup(
                    group_id=group_id,
                    signature=signature,
                    exception_type=crash.exception_type,
                    exception_message=crash.exception_message,
                    representative_stack=crash.raw_stack.copy() if crash.raw_stack else [],
                    first_seen=crash.timestamp,
                    last_seen=crash.timestamp
                )
                self._groups[group_id] = group

            group = self._groups[group_id]
            group.count += 1
            group.crashes.append(crash)

            if crash.timestamp:
                if group.first_seen is None or crash.timestamp < group.first_seen:
                    group.first_seen = crash.timestamp
                if group.last_seen is None or crash.timestamp > group.last_seen:
                    group.last_seen = crash.timestamp

        sorted_groups = sorted(
            self._groups.values(),
            key=lambda g: g.count,
            reverse=True
        )

        return sorted_groups

    def extract_suspicious_stacks(
        self,
        groups: List[CrashGroup],
        top_n: int = 10
    ) -> List[SuspiciousStack]:
        """
        提取可疑堆栈摘要

        基于规则和出现频率识别最可疑的崩溃
        """
        suspicious = []

        for group in groups:
            confidence = self._calculate_suspicion_confidence(group)
            if confidence > 0:
                key_frames = self._extract_key_frames(group)

                suspicious.append(SuspiciousStack(
                    rank=0,
                    confidence=confidence,
                    signature=group.signature,
                    exception_type=group.exception_type,
                    key_frames=key_frames,
                    occurrence_count=group.count,
                    sample_stack='\n'.join(group.representative_stack[:10])
                ))

        suspicious.sort(key=lambda s: (s.confidence, s.occurrence_count), reverse=True)

        for i, s in enumerate(suspicious[:top_n]):
            s.rank = i + 1

        return suspicious[:top_n]

    def build_timeline(self, crashes: List[CrashEntry]) -> List[Dict[str, Any]]:
        """
        构建崩溃时间线

        按时间顺序排列所有崩溃事件
        """
        timeline = []

        for crash in crashes:
            event = {
                "timestamp": crash.timestamp,
                "exception_type": crash.exception_type,
                "message": crash.exception_message,
                "source": crash.log_source,
                "crash_id": crash.crash_id,
                "stack_preview": '\n'.join(crash.raw_stack[:3]) if crash.raw_stack else ""
            }
            timeline.append(event)

        timeline.sort(key=lambda x: x["timestamp"] if x["timestamp"] else datetime.min)

        return timeline

    def _generate_signature(self, crash: CrashEntry) -> str:
        """
        生成崩溃签名

        基于异常类型和关键堆栈帧生成唯一标识
        """
        parts = []

        if crash.exception_type:
            parts.append(crash.exception_type)

        key_frames = self._get_key_stack_frames(crash)
        for frame in key_frames[:5]:
            normalized = self._normalize_frame(frame)
            if normalized:
                parts.append(normalized)

        return '|'.join(parts)

    def _get_key_stack_frames(self, crash: CrashEntry) -> List[StackFrame]:
        """
        获取关键堆栈帧

        过滤掉系统库帧，返回应用相关的帧
        """
        key_frames = []

        for frame in crash.stack_frames:
            if not self._is_system_frame(frame):
                key_frames.append(frame)

        if not key_frames and crash.stack_frames:
            key_frames = crash.stack_frames[:3]

        return key_frames

    def _is_system_frame(self, frame: StackFrame) -> bool:
        """判断是否为系统库帧"""
        lib_lower = frame.library.lower() if frame.library else ""
        func_lower = frame.function.lower() if frame.function else ""

        for sys_lib in self.LIBRARY_FILTERS:
            if sys_lib.lower() in lib_lower:
                return True

        if frame.function:
            if any(pattern in func_lower for pattern in [
                'objc_exception_throw',
                'pthread_kill',
                'mach_msg',
                'semaphore_wait',
                '__pthread_',
                'objc_msgSend',
                'objc_retain',
                'objc_release',
            ]):
                return True

        return False

    def _normalize_frame(self, frame: StackFrame) -> str:
        """
        规范化堆栈帧

        移除地址、行号等可变部分，生成稳定的标识
        """
        parts = []

        if frame.library and not self._is_system_frame(frame):
            lib = frame.library
            for pattern, replacement in self.FRAME_NORMALIZE_PATTERNS:
                lib = pattern.sub(replacement, lib)
            parts.append(lib)

        if frame.function:
            func = frame.function
            for pattern, replacement in self.FRAME_NORMALIZE_PATTERNS:
                func = pattern.sub(replacement, func)
            parts.append(func)

        return '::'.join(parts) if parts else ""

    def _hash_signature(self, signature: str) -> str:
        """对签名进行哈希处理"""
        return hashlib.md5(signature.encode('utf-8')).hexdigest()[:12]

    def _calculate_suspicion_confidence(self, group: CrashGroup) -> float:
        """
        计算可疑度置信分

        基于多个因素评估崩溃的可疑程度:
        - 异常类型匹配已知问题模式
        - 出现频率
        - 堆栈中是否包含应用代码
        """
        confidence = 0.0

        combined_text = f"{group.exception_type} {group.exception_message}"
        for pattern in self.SUSPICIOUS_PATTERNS:
            if pattern.search(combined_text):
                confidence += 0.3
                break

        if group.count >= 5:
            confidence += 0.2
        elif group.count >= 2:
            confidence += 0.1

        has_app_frames = False
        for crash in group.crashes:
            for frame in crash.stack_frames:
                if not self._is_system_frame(frame) and frame.function:
                    if any(marker in frame.function.lower() for marker in [
                        'com.', 'net.', 'org.', 'myapp', 'example'
                    ]) or frame.file:
                        has_app_frames = True
                        break
            if has_app_frames:
                break

        if has_app_frames:
            confidence += 0.2

        return min(confidence, 1.0)

    def _extract_key_frames(self, group: CrashGroup) -> List[Dict[str, Any]]:
        """
        提取关键帧信息用于摘要
        """
        key_frames = []

        if group.representative_stack:
            for i, line in enumerate(group.representative_stack[:5]):
                key_frames.append({
                    "index": i,
                    "frame": line.strip()
                })

        return key_frames


def merge_log_entries(entries: List[LogEntry]) -> Tuple[List[CrashGroup], List[SuspiciousStack], List[Dict]]:
    """
    从日志条目中归并崩溃

    便捷函数，整合提取崩溃、归并、生成摘要的流程
    """
    crashes = []
    for entry in entries:
        if entry.is_crash and entry.crash_entry:
            crashes.append(entry.crash_entry)

    merger = StackMerger()
    groups = merger.merge_crashes(crashes)
    suspicious = merger.extract_suspicious_stacks(groups)
    timeline = merger.build_timeline(crashes)

    return groups, suspicious, timeline
