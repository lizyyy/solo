from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any


class IssueSeverity(Enum):
    CRITICAL = "critical"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class IssueCategory(Enum):
    ENCODING = "encoding"
    TIMELINE = "timeline"
    SYNC = "sync"
    FONT = "font"
    FORMAT = "format"
    CONTENT = "content"
    CONSISTENCY = "consistency"


@dataclass
class SubtitleEntry:
    index: int
    start_time: timedelta
    end_time: timedelta
    text: str
    raw_text: str
    style: Optional[str] = None
    speaker: Optional[str] = None
    scene: Optional[str] = None
    language: Optional[str] = None
    
    @property
    def duration(self) -> timedelta:
        return self.end_time - self.start_time


@dataclass
class SubtitleFile:
    path: Path
    format: str
    encoding: str
    language: str
    entries: List[SubtitleEntry] = field(default_factory=list)
    styles: Dict[str, Dict] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProgramItem:
    scene_number: str
    scene_name: str
    start_timecode: timedelta
    end_timecode: timedelta
    speaker: Optional[str] = None
    language: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ProgramList:
    path: Path
    items: List[ProgramItem] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FontInfo:
    path: Path
    family: str
    style: str
    weight: int
    supported_chars: List[str] = field(default_factory=list)
    missing_chars: List[str] = field(default_factory=list)


@dataclass
class Issue:
    id: str
    category: IssueCategory
    severity: IssueSeverity
    title: str
    description: str
    file: Optional[Path] = None
    line: Optional[int] = None
    position: Optional[timedelta] = None
    context: Dict[str, Any] = field(default_factory=dict)
    suggested_fix: Optional[str] = None


@dataclass
class ScanResult:
    subtitle_files: List[SubtitleFile] = field(default_factory=list)
    program_list: Optional[ProgramList] = None
    font_files: List[FontInfo] = field(default_factory=list)
    timecode_log: Optional[Dict] = None
    summary: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CheckResult:
    issues: List[Issue] = field(default_factory=list)
    stats: Dict[str, Any] = field(default_factory=dict)
    language_alignment: Dict[str, Dict] = field(default_factory=dict)


@dataclass
class FixSuggestion:
    issue_id: str
    original: Any
    suggestion: Any
    file: Path
    line: Optional[int] = None
    description: str = ""


@dataclass
class FixPlan:
    suggestions: List[FixSuggestion] = field(default_factory=list)
    temp_dir: Optional[Path] = None
    summary: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Report:
    scan_result: ScanResult
    check_result: CheckResult
    fix_plan: Optional[FixPlan] = None
    generated_at: datetime = field(default_factory=datetime.now)
