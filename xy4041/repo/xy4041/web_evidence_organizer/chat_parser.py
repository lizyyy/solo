#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
聊天记录解析器
从文本文件中提取聊天消息、时间戳等信息
"""

import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .config import TimeTrustLevel


class ChatParser:
    """聊天记录解析器"""

    TIME_PATTERNS = [
        (
            r"(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
        ),
        (
            r"(\d{4})/(\d{2})/(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
        ),
        (
            r"(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})时(\d{1,2})分(?::?(\d{1,2})秒?)?",
            "%Y年%m月%d日 %H时%M分%S秒",
            "%Y年%m月%d日 %H时%M分",
        ),
        (
            r"\[(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
        ),
        (
            r"\[(\d{4})/(\d{2})/(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
        ),
    ]

    SPEAKER_PATTERNS = [
        r"^([^:：\n]+?)\s*[:：]\s*(.+)$",
        r"^【([^】]+)】\s*(.+)$",
        r"^「([^」]+)」\s*(.+)$",
        r"^([A-Za-z0-9_\u4e00-\u9fa5]+)\s+\d{1,2}:\d{2}\s*[:：]?\s*(.+)$",
    ]

    def __init__(self, file_path: str):
        self.file_path = file_path
        self._lines: List[str] = []
        self._messages: List[Dict] = []

    def parse(self) -> Dict:
        """
        解析聊天记录文件

        Returns:
            解析结果字典
        """
        path = Path(self.file_path)
        if not path.exists():
            raise ValueError(f"文件不存在: {self.file_path}")

        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        self._lines = content.split("\n")
        self._messages = self._parse_messages()

        return {
            "file_path": self.file_path,
            "total_lines": len(self._lines),
            "message_count": len(self._messages),
            "speakers": self._get_speakers(),
            "time_range": self._get_time_range(),
            "messages": self._messages,
        }

    def _parse_messages(self) -> List[Dict]:
        """解析消息"""
        messages = []
        current_message: Optional[Dict] = None
        current_time: Optional[datetime] = None

        for i, line in enumerate(self._lines):
            line = line.strip()
            if not line:
                continue

            parsed_time = self._extract_time_from_line(line)
            if parsed_time:
                current_time = parsed_time

            speaker_match = self._extract_speaker_and_content(line)
            if speaker_match:
                if current_message:
                    messages.append(current_message)

                current_message = {
                    "line_number": i + 1,
                    "speaker": speaker_match["speaker"],
                    "content": speaker_match["content"],
                    "timestamp": current_time,
                    "time_str": self._get_time_str_from_line(line) if current_time else None,
                    "raw_line": line,
                }
            elif current_message:
                current_message["content"] += "\n" + line
                current_message["raw_line"] += "\n" + line

        if current_message:
            messages.append(current_message)

        return messages

    def _extract_time_from_line(self, line: str) -> Optional[datetime]:
        """从行中提取时间"""
        for pattern_group in self.TIME_PATTERNS:
            pattern = pattern_group[0]
            fmt_with_sec = pattern_group[1]
            fmt_without_sec = pattern_group[2]

            match = re.search(pattern, line)
            if match:
                try:
                    time_str = match.group(0)
                    if "年" in time_str or "月" in time_str or "日" in time_str:
                        normalized = time_str.replace("年", "-").replace("月", "-").replace("日", " ")
                        normalized = normalized.replace("时", ":").replace("分", ":").replace("秒", "")
                        normalized = normalized.replace("[", "").replace("]", "")
                    else:
                        normalized = time_str.replace("[", "").replace("]", "")

                    try:
                        return datetime.strptime(normalized.strip(), fmt_with_sec)
                    except ValueError:
                        return datetime.strptime(normalized.strip(), fmt_without_sec)
                except (ValueError, TypeError):
                    continue

        return None

    def _get_time_str_from_line(self, line: str) -> Optional[str]:
        """从行中获取时间字符串"""
        for pattern_group in self.TIME_PATTERNS:
            pattern = pattern_group[0]
            match = re.search(pattern, line)
            if match:
                return match.group(0)
        return None

    def _extract_speaker_and_content(self, line: str) -> Optional[Dict]:
        """提取发言人和内容"""
        for pattern in self.SPEAKER_PATTERNS:
            match = re.match(pattern, line)
            if match:
                speaker = match.group(1).strip()
                content = match.group(2).strip()

                if self._is_valid_speaker(speaker):
                    return {
                        "speaker": speaker,
                        "content": content,
                    }

        return None

    def _is_valid_speaker(self, speaker: str) -> bool:
        """检查是否是有效的发言人"""
        if not speaker:
            return False

        if re.match(r"^\d+$", speaker):
            return False

        if re.match(r"^\d{1,2}:\d{2}(:\d{2})?$", speaker):
            return False

        if len(speaker) > 50:
            return False

        return True

    def _get_speakers(self) -> Dict[str, int]:
        """获取所有发言人及其消息数量"""
        speakers = {}
        for msg in self._messages:
            speaker = msg.get("speaker", "unknown")
            speakers[speaker] = speakers.get(speaker, 0) + 1
        return speakers

    def _get_time_range(self) -> Dict:
        """获取时间范围"""
        times = [
            msg["timestamp"]
            for msg in self._messages
            if msg.get("timestamp")
        ]

        if not times:
            return {"start": None, "end": None}

        return {
            "start": min(times),
            "end": max(times),
        }

    def get_messages(self, speaker: str = None) -> List[Dict]:
        """
        获取消息列表

        Args:
            speaker: 过滤指定发言人（可选）

        Returns:
            消息列表
        """
        if not self._messages:
            self.parse()

        if speaker:
            return [
                msg for msg in self._messages
                if msg.get("speaker") == speaker
            ]

        return self._messages

    def get_events(self) -> List[Dict]:
        """
        从聊天记录中提取事件（用于时间线）

        Returns:
            事件列表
        """
        events = []

        if not self._messages:
            self.parse()

        file_stat = Path(self.file_path).stat()
        file_modified_time = datetime.fromtimestamp(file_stat.st_mtime)

        for i, msg in enumerate(self._messages):
            timestamp = msg.get("timestamp")
            speaker = msg.get("speaker", "unknown")
            content = msg.get("content", "")

            if timestamp:
                trust_level = TimeTrustLevel.MEDIUM
                time_source = "chat_message_time"
            else:
                timestamp = file_modified_time
                trust_level = TimeTrustLevel.LOW
                time_source = "file_modified_time"

            events.append({
                "source": "chat_log",
                "source_file": self.file_path,
                "timestamp": timestamp,
                "time_source": time_source,
                "trust_level": trust_level,
                "event_type": "chat_message",
                "summary": f"[{speaker}] {content[:100]}{'...' if len(content) > 100 else ''}",
                "details": {
                    "speaker": speaker,
                    "content": content,
                    "line_number": msg.get("line_number"),
                    "time_str": msg.get("time_str"),
                    "message_index": i,
                },
            })

        return events

    def check_page_breaks(self) -> List[Dict]:
        """
        检查聊天记录是否有缺页迹象

        Returns:
            缺页问题列表
        """
        if not self._messages:
            self.parse()

        issues = []

        for i in range(1, len(self._messages)):
            prev_msg = self._messages[i - 1]
            curr_msg = self._messages[i]

            prev_time = prev_msg.get("timestamp")
            curr_time = curr_msg.get("timestamp")

            if prev_time and curr_time:
                time_diff = curr_time - prev_time
                if time_diff.total_seconds() > 3600:
                    issues.append({
                        "type": "large_time_gap",
                        "message_index": i,
                        "prev_message": prev_msg.get("content", "")[:50],
                        "curr_message": curr_msg.get("content", "")[:50],
                        "time_gap_seconds": time_diff.total_seconds(),
                        "description": f"消息之间存在超过1小时的时间间隔: {time_diff}",
                    })

        line_numbers = [msg.get("line_number", 0) for msg in self._messages]
        for i in range(1, len(line_numbers)):
            if line_numbers[i] - line_numbers[i - 1] > 10:
                issues.append({
                    "type": "line_gap",
                    "message_index": i,
                    "prev_line": line_numbers[i - 1],
                    "curr_line": line_numbers[i],
                    "line_gap": line_numbers[i] - line_numbers[i - 1],
                    "description": f"消息之间存在较多空行，可能存在缺页",
                })

        return issues

    def get_summary(self) -> Dict:
        """
        获取聊天记录摘要

        Returns:
            摘要信息字典
        """
        if not self._messages:
            self.parse()

        time_range = self._get_time_range()
        page_issues = self.check_page_breaks()

        return {
            "file_path": self.file_path,
            "total_messages": len(self._messages),
            "speakers": self._get_speakers(),
            "time_range": {
                "start": time_range["start"].isoformat() if time_range["start"] else None,
                "end": time_range["end"].isoformat() if time_range["end"] else None,
            },
            "has_timestamp_gaps": len(page_issues) > 0,
            "potential_missing_pages": len([p for p in page_issues if p["type"] == "line_gap"]) > 0,
            "issues": page_issues,
        }
