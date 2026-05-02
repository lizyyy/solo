from dataclasses import dataclass, field
from datetime import timedelta
from typing import List, Dict, Optional, Any
from enum import Enum


class IssueSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IssueType(Enum):
    TIME_OVERLAP = "time_overlap"
    TOO_LONG_SUBTITLE = "too_long_subtitle"
    INVALID_TIMECODE = "invalid_timecode"
    SPEAKER_NOT_FOUND = "speaker_not_found"
    CHAPTER_DRIFT = "chapter_drift"
    EMPTY_SUBTITLE = "empty_subtitle"
    MISSING_SPEAKER = "missing_speaker"
    GAP_IN_TIMELINE = "gap_in_timeline"


@dataclass
class SubtitleItem:
    index: int
    start_time: timedelta
    end_time: timedelta
    text: str
    speaker: Optional[str] = None
    original_text: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def duration(self) -> timedelta:
        return self.end_time - self.start_time
    
    @property
    def duration_seconds(self) -> float:
        return self.duration.total_seconds()
    
    def to_srt_format(self) -> str:
        start_str = self._timedelta_to_srt_time(self.start_time)
        end_str = self._timedelta_to_srt_time(self.end_time)
        return f"{self.index}\n{start_str} --> {end_str}\n{self.text}\n"
    
    @staticmethod
    def _timedelta_to_srt_time(td: timedelta) -> str:
        total_seconds = td.total_seconds()
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        seconds = int(total_seconds % 60)
        milliseconds = int((total_seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"
    
    def overlaps_with(self, other: 'SubtitleItem') -> bool:
        return self.start_time < other.end_time and other.start_time < self.end_time
    
    def gap_after(self, other: 'SubtitleItem') -> Optional[timedelta]:
        if self.start_time > other.end_time:
            return self.start_time - other.end_time
        return None


@dataclass
class Speaker:
    name: str
    alias: List[str] = field(default_factory=list)
    role: Optional[str] = None
    is_guest: bool = False


@dataclass
class Chapter:
    title: str
    start_time: timedelta
    end_time: Optional[timelta] = None
    description: Optional[str] = None
    speaker: Optional[str] = None


@dataclass
class ValidationIssue:
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    subtitle_index: Optional[int] = None
    chapter_index: Optional[int] = None
    time_position: Optional[timedelta] = None
    suggested_fix: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "subtitle_index": self.subtitle_index,
            "chapter_index": self.chapter_index,
            "time_position": str(self.time_position) if self.time_position else None,
            "suggested_fix": self.suggested_fix,
            "metadata": self.metadata
        }


@dataclass
class ValidationResult:
    issues: List[ValidationIssue] = field(default_factory=list)
    is_valid: bool = True
    
    @property
    def critical_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == IssueSeverity.CRITICAL)
    
    @property
    def high_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == IssueSeverity.HIGH)
    
    @property
    def medium_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == IssueSeverity.MEDIUM)
    
    @property
    def low_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == IssueSeverity.LOW)
    
    @property
    def total_count(self) -> int:
        return len(self.issues)
    
    def add_issue(self, issue: ValidationIssue) -> None:
        self.issues.append(issue)
        if issue.severity in [IssueSeverity.HIGH, IssueSeverity.CRITICAL]:
            self.is_valid = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "total_count": self.total_count,
            "critical_count": self.critical_count,
            "high_count": self.high_count,
            "medium_count": self.medium_count,
            "low_count": self.low_count,
            "issues": [i.to_dict() for i in self.issues]
        }


@dataclass
class ReviewDecision:
    subtitle_index: int
    approved: bool
    comment: Optional[str] = None
    reviewer: Optional[str] = None
    reviewed_at: Optional[str] = None
    original_fix: Optional[Dict[str, Any]] = None


@dataclass
class FixAction:
    action_type: str
    subtitle_index: int
    before: Dict[str, Any]
    after: Dict[str, Any]
    reason: str
    auto_applied: bool = False
