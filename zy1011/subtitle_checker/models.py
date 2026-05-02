from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import timedelta


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class IssueType(Enum):
    OVERLAP = "overlap"
    INVALID_TIME = "invalid_time"
    LONG_GAP = "long_gap"
    DUPLICATE = "duplicate"
    EMPTY_TEXT = "empty_text"
    CROSS_CHAPTER = "cross_chapter"
    PARSE_ERROR = "parse_error"


@dataclass
class SubtitleEntry:
    index: int
    start_time: timedelta
    end_time: timedelta
    text: str
    file_path: str
    line_number: int = 0
    original_index: int = 0

    def duration(self) -> timedelta:
        return self.end_time - self.start_time

    def to_milliseconds(self, td: timedelta) -> int:
        return int(td.total_seconds() * 1000)

    @property
    def start_ms(self) -> int:
        return self.to_milliseconds(self.start_time)

    @property
    def end_ms(self) -> int:
        return self.to_milliseconds(self.end_time)


@dataclass
class Chapter:
    title: str
    start_time: timedelta
    end_time: timedelta

    @property
    def start_ms(self) -> int:
        return int(self.start_time.total_seconds() * 1000)

    @property
    def end_ms(self) -> int:
        return int(self.end_time.total_seconds() * 1000)

    def contains(self, time_ms: int) -> bool:
        return self.start_ms <= time_ms <= self.end_ms


@dataclass
class Issue:
    issue_type: IssueType
    severity: Severity
    message: str
    file_path: str
    subtitle_index: Optional[int] = None
    subtitle_indices: List[int] = field(default_factory=list)
    line_number: Optional[int] = None
    suggestion: str = ""
    original: Optional[Dict[str, Any]] = None
    fixed: Optional[Dict[str, Any]] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SubtitleFile:
    file_path: str
    format: str
    entries: List[SubtitleEntry] = field(default_factory=list)
    parse_errors: List[Issue] = field(default_factory=list)

    def has_entries(self) -> bool:
        return len(self.entries) > 0


@dataclass
class ScanResult:
    files: List[SubtitleFile] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    chapters: List[Chapter] = field(default_factory=list)

    def get_issues_by_file(self) -> Dict[str, List[Issue]]:
        result: Dict[str, List[Issue]] = {}
        for issue in self.issues:
            if issue.file_path not in result:
                result[issue.file_path] = []
            result[issue.file_path].append(issue)
        return result

    def get_issues_by_type(self) -> Dict[IssueType, List[Issue]]:
        result: Dict[IssueType, List[Issue]] = {}
        for issue in self.issues:
            if issue.issue_type not in result:
                result[issue.issue_type] = []
            result[issue.issue_type].append(issue)
        return result

    def count_issues_by_severity(self) -> Dict[Severity, int]:
        result: Dict[Severity, int] = {
            Severity.ERROR: 0,
            Severity.WARNING: 0,
            Severity.INFO: 0,
        }
        for issue in self.issues:
            result[issue.severity] += 1
        return result

    def total_entries(self) -> int:
        return sum(len(f.entries) for f in self.files)

    def total_files(self) -> int:
        return len(self.files)
