from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import uuid4


class SourceType(str, Enum):
    SUBTITLE = "subtitle"
    CHAT = "chat"
    OUTLINE = "outline"


class QuestionType(str, Enum):
    EXPLICIT = "explicit"
    IMPLICIT = "implicit"
    CLARIFICATION = "clarification"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    MERGED = "merged"
    SPLIT = "split"
    RESOLVED = "resolved"
    DISCARDED = "discarded"


def generate_id() -> str:
    return uuid4().hex[:12]


@dataclass
class TimeRange:
    start_seconds: float
    end_seconds: Optional[float] = None
    
    @classmethod
    def from_srt_timestamp(cls, timestamp: str) -> "TimeRange":
        parts = timestamp.split(" --> ")
        start_str = parts[0].strip()
        end_str = parts[1].strip() if len(parts) > 1 else None
        
        start_seconds = cls._parse_time(start_str)
        end_seconds = cls._parse_time(end_str) if end_str else None
        
        return cls(start_seconds=start_seconds, end_seconds=end_seconds)
    
    @staticmethod
    def _parse_time(time_str: str) -> float:
        time_str = time_str.replace(",", ".")
        parts = time_str.split(":")
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        elif len(parts) == 2:
            minutes = int(parts[0])
            seconds = float(parts[1])
            return minutes * 60 + seconds
        return float(time_str)
    
    def to_srt_format(self) -> str:
        start = self._format_time(self.start_seconds)
        if self.end_seconds is not None:
            end = self._format_time(self.end_seconds)
            return f"{start} --> {end}"
        return start
    
    @staticmethod
    def _format_time(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{secs:06.3f}".replace(".", ",")
    
    def overlaps_with(self, other: "TimeRange", tolerance: float = 0.0) -> bool:
        if self.end_seconds is None or other.end_seconds is None:
            return abs(self.start_seconds - other.start_seconds) <= tolerance
        return not (self.end_seconds + tolerance < other.start_seconds or 
                   other.end_seconds + tolerance < self.start_seconds)


@dataclass
class Chapter:
    id: str = field(default_factory=generate_id)
    title: str = ""
    description: str = ""
    time_range: Optional[TimeRange] = None
    order: int = 0
    keywords: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.time_range:
            data["time_range"] = {
                "start_seconds": self.time_range.start_seconds,
                "end_seconds": self.time_range.end_seconds,
                "srt_format": self.time_range.to_srt_format(),
            }
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Chapter":
        time_range_data = data.get("time_range")
        time_range = None
        if time_range_data:
            time_range = TimeRange(
                start_seconds=time_range_data["start_seconds"],
                end_seconds=time_range_data.get("end_seconds"),
            )
        return cls(
            id=data.get("id", generate_id()),
            title=data.get("title", ""),
            description=data.get("description", ""),
            time_range=time_range,
            order=data.get("order", 0),
            keywords=data.get("keywords", []),
            metadata=data.get("metadata", {}),
        )


@dataclass
class QuestionItem:
    id: str = field(default_factory=generate_id)
    content: str = ""
    source_type: SourceType = SourceType.SUBTITLE
    source_id: str = ""
    time_range: Optional[TimeRange] = None
    speaker: str = ""
    timestamp: Optional[datetime] = None
    question_type: QuestionType = QuestionType.IMPLICIT
    raw_text: str = ""
    chapter_id: Optional[str] = None
    chapter_title: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["source_type"] = self.source_type.value
        data["question_type"] = self.question_type.value
        if self.time_range:
            data["time_range"] = {
                "start_seconds": self.time_range.start_seconds,
                "end_seconds": self.time_range.end_seconds,
                "srt_format": self.time_range.to_srt_format(),
            }
        if self.timestamp:
            data["timestamp"] = self.timestamp.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "QuestionItem":
        time_range_data = data.get("time_range")
        time_range = None
        if time_range_data:
            time_range = TimeRange(
                start_seconds=time_range_data["start_seconds"],
                end_seconds=time_range_data.get("end_seconds"),
            )
        
        timestamp = data.get("timestamp")
        if timestamp:
            timestamp = datetime.fromisoformat(timestamp)
        
        return cls(
            id=data.get("id", generate_id()),
            content=data.get("content", ""),
            source_type=SourceType(data.get("source_type", "subtitle")),
            source_id=data.get("source_id", ""),
            time_range=time_range,
            speaker=data.get("speaker", ""),
            timestamp=timestamp,
            question_type=QuestionType(data.get("question_type", "implicit")),
            raw_text=data.get("raw_text", ""),
            chapter_id=data.get("chapter_id"),
            chapter_title=data.get("chapter_title", ""),
            metadata=data.get("metadata", {}),
        )


@dataclass
class QuestionCluster:
    id: str = field(default_factory=generate_id)
    representative_question: str = ""
    questions: List[str] = field(default_factory=list)
    chapter_id: Optional[str] = None
    chapter_title: str = ""
    confidence: float = 0.0
    avg_time_start: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    review_status: ReviewStatus = ReviewStatus.PENDING
    review_notes: str = ""
    review_timestamp: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["review_status"] = self.review_status.value
        if self.review_timestamp:
            data["review_timestamp"] = self.review_timestamp.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "QuestionCluster":
        review_timestamp = data.get("review_timestamp")
        if review_timestamp:
            review_timestamp = datetime.fromisoformat(review_timestamp)
        
        return cls(
            id=data.get("id", generate_id()),
            representative_question=data.get("representative_question", ""),
            questions=data.get("questions", []),
            chapter_id=data.get("chapter_id"),
            chapter_title=data.get("chapter_title", ""),
            confidence=data.get("confidence", 0.0),
            avg_time_start=data.get("avg_time_start"),
            metadata=data.get("metadata", {}),
            review_status=ReviewStatus(data.get("review_status", "pending")),
            review_notes=data.get("review_notes", ""),
            review_timestamp=review_timestamp,
        )
