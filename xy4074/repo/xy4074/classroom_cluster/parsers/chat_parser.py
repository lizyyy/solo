import csv
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
import re

from classroom_cluster.models import (
    QuestionItem, TimeRange, SourceType, QuestionType, generate_id
)


@dataclass
class ChatMessage:
    id: str
    timestamp: Optional[datetime]
    speaker: str
    content: str
    time_seconds: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "speaker": self.speaker,
            "content": self.content,
            "time_seconds": self.time_seconds,
        }


class ChatParser:
    TIME_PATTERNS = [
        re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$"),
        re.compile(r"^(\d{1,2})时(\d{2})分(?::(\d{2})秒)?$"),
    ]
    
    def __init__(
        self, 
        file_path: Path, 
        source_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
    ):
        self.file_path = file_path
        self.source_id = source_id or generate_id()
        self.start_time = start_time
        self._messages: List[ChatMessage] = []
    
    def parse(self) -> List[ChatMessage]:
        if self._messages:
            return self._messages
        
        ext = self.file_path.suffix.lower()
        
        if ext == ".csv":
            self._parse_csv()
        elif ext == ".txt":
            self._parse_txt()
        else:
            raise ValueError(f"不支持的聊天记录格式: {ext}")
        
        return self._messages
    
    def _parse_csv(self) -> None:
        with open(self.file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        for i, row in enumerate(rows):
            timestamp = self._extract_timestamp(row)
            speaker = self._extract_speaker(row)
            content = self._extract_content(row)
            time_seconds = self._calculate_seconds(timestamp)
            
            if content and content.strip():
                message = ChatMessage(
                    id=f"chat_{self.source_id}_{i}",
                    timestamp=timestamp,
                    speaker=speaker,
                    content=content.strip(),
                    time_seconds=time_seconds,
                )
                self._messages.append(message)
    
    def _parse_txt(self) -> None:
        content = self.file_path.read_text(encoding="utf-8")
        lines = content.splitlines()
        
        current_message: Optional[ChatMessage] = None
        message_index = 0
        
        for line in lines:
            line = line.rstrip()
            if not line:
                continue
            
            parsed = self._try_parse_txt_line(line)
            if parsed:
                if current_message and current_message.content:
                    self._messages.append(current_message)
                
                timestamp, speaker, content_start = parsed
                time_seconds = self._calculate_seconds(timestamp)
                
                current_message = ChatMessage(
                    id=f"chat_{self.source_id}_{message_index}",
                    timestamp=timestamp,
                    speaker=speaker,
                    content=content_start,
                    time_seconds=time_seconds,
                )
                message_index += 1
            elif current_message:
                current_message.content += " " + line
        
        if current_message and current_message.content:
            self._messages.append(current_message)
    
    def _try_parse_txt_line(self, line: str) -> Optional[tuple]:
        patterns = [
            re.compile(r"^\[?(\d{2}:\d{2}(?::\d{2})?)\]?\s+([^:：]+)[:：]\s*(.*)$"),
            re.compile(r"^(\d{2}:\d{2}(?::\d{2})?)\s+([^:：]+)[:：]\s*(.*)$"),
            re.compile(r"^([^:：\s]+)\s+(\d{2}:\d{2}(?::\d{2})?)[:：]\s*(.*)$"),
        ]
        
        for pattern in patterns:
            match = pattern.match(line)
            if match:
                time_str = match.group(1)
                if re.match(r"^\d{2}:\d{2}", time_str):
                    speaker = match.group(2)
                    content = match.group(3)
                else:
                    speaker = match.group(1)
                    time_str = match.group(2)
                    content = match.group(3)
                
                timestamp = self._parse_time_string(time_str)
                return (timestamp, speaker, content)
        
        return None
    
    def _extract_timestamp(self, row: Dict[str, str]) -> Optional[datetime]:
        timestamp_keys = ["timestamp", "time", "时间", "发送时间", "日期", "date"]
        for key in timestamp_keys:
            if key in row and row[key].strip():
                return self._parse_time_string(row[key].strip())
        return None
    
    def _extract_speaker(self, row: Dict[str, str]) -> str:
        speaker_keys = ["speaker", "name", "用户", "姓名", "发送者", "from"]
        for key in speaker_keys:
            if key in row and row[key].strip():
                return row[key].strip()
        return "未知用户"
    
    def _extract_content(self, row: Dict[str, str]) -> str:
        content_keys = ["content", "message", "内容", "消息", "text"]
        for key in content_keys:
            if key in row:
                return row[key]
        for key, value in row.items():
            if key not in ["timestamp", "time", "时间", "speaker", "name", "用户", "姓名"]:
                return value
        return ""
    
    def _parse_time_string(self, time_str: str) -> Optional[datetime]:
        if not time_str:
            return None
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%m-%d %H:%M:%S",
            "%m/%d %H:%M:%S",
            "%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M",
            "%m-%d %H:%M",
            "%m/%d %H:%M",
            "%H:%M",
        ]
        
        time_str = time_str.strip()
        
        for fmt in formats:
            try:
                parsed = datetime.strptime(time_str, fmt)
                if parsed.year == 1900:
                    now = datetime.now()
                    parsed = parsed.replace(year=now.year, month=now.month, day=now.day)
                return parsed
            except ValueError:
                continue
        
        match = re.match(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$", time_str)
        if match:
            hours = int(match.group(1))
            minutes = int(match.group(2))
            seconds = int(match.group(3)) if match.group(3) else 0
            now = datetime.now()
            return datetime(now.year, now.month, now.day, hours, minutes, seconds)
        
        return None
    
    def _calculate_seconds(self, timestamp: Optional[datetime]) -> Optional[float]:
        if timestamp is None:
            return None
        
        if self.start_time is None:
            if self._messages:
                self.start_time = self._messages[0].timestamp
            else:
                self.start_time = timestamp
        
        if self.start_time:
            delta = timestamp - self.start_time
            return max(0.0, delta.total_seconds())
        
        return None
    
    def extract_questions(self) -> List[QuestionItem]:
        questions: List[QuestionItem] = []
        
        for message in self._messages:
            if self._is_likely_question(message.content):
                question_type = self._classify_question_type(message.content)
                
                time_range = None
                if message.time_seconds is not None:
                    time_range = TimeRange(
                        start_seconds=message.time_seconds,
                        end_seconds=message.time_seconds + 5.0,
                    )
                
                question = QuestionItem(
                    content=message.content,
                    source_type=SourceType.CHAT,
                    source_id=self.source_id,
                    time_range=time_range,
                    speaker=message.speaker,
                    timestamp=message.timestamp,
                    question_type=question_type,
                    raw_text=message.content,
                    metadata={
                        "chat_id": message.id,
                        "file_path": str(self.file_path),
                    },
                )
                questions.append(question)
        
        return questions
    
    def _is_likely_question(self, text: str) -> bool:
        if not text or len(text.strip()) < 2:
            return False
        
        text_lower = text.lower()
        
        if "?" in text or "？" in text:
            return True
        
        question_indicators = [
            "请问", "什么", "怎么", "如何", "为什么", "为何", "哪",
            "谁", "多少", "几", "能否", "可以", "麻烦问一下", "请教",
            "不明白", "不懂", "不清楚", "没理解", "没搞懂",
        ]
        
        for indicator in question_indicators:
            if indicator in text_lower:
                return True
        
        return False
    
    def _classify_question_type(self, text: str) -> QuestionType:
        text_lower = text.lower()
        
        if "?" in text or "？" in text:
            explicit_indicators = ["请问", "我想问", "想请教", "咨询一下", "有个问题"]
            for indicator in explicit_indicators:
                if indicator in text_lower:
                    return QuestionType.EXPLICIT
            return QuestionType.EXPLICIT
        
        clarification_indicators = ["不明白", "不懂", "不清楚", "没理解", "没搞懂", "不知道"]
        for indicator in clarification_indicators:
            if indicator in text_lower:
                return QuestionType.CLARIFICATION
        
        return QuestionType.IMPLICIT
    
    def get_all_messages(self) -> List[ChatMessage]:
        return self._messages
