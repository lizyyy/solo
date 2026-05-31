from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class IssueType(Enum):
    MUTE_SEGMENT = "静音段"
    MISSPEAK = "口误"
    AD_SCRIPT_MISMATCH = "广告口播不符"
    GUEST_NAME_ERROR = "嘉宾名错误"
    UNKNOWN = "未知问题"


class IssueStatus(Enum):
    PENDING = "待处理"
    CONFIRMED = "已确认"
    RESOLVED = "已解决"
    IGNORED = "已忽略"


class NextAction(Enum):
    CHECK_AUDIO = "核对原始音轨"
    EDIT_SUBTITLE = "修改字幕"
    CONFIRM_WITH_PRODUCER = "确认制作人"
    RE_RECORD = "重录片段"
    NO_ACTION = "无需处理"


@dataclass
class TimeSegment:
    start_time: float
    end_time: float
    duration: float = field(init=False)

    def __post_init__(self):
        self.duration = self.end_time - self.start_time


@dataclass
class SubtitleLine:
    index: int
    time_segment: TimeSegment
    text: str
    speaker: Optional[str] = None


@dataclass
class Guest:
    name: str
    role: Optional[str] = None
    segment_notes: Optional[str] = None


@dataclass
class Issue:
    issue_id: str
    issue_type: IssueType
    time_segment: TimeSegment
    description: str
    reason: str
    next_action: NextAction
    status: IssueStatus = IssueStatus.PENDING
    subtitle_line: Optional[SubtitleLine] = None
    confidence: float = 1.0
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class AdScript:
    time_segment: TimeSegment
    expected_text: str
    actual_text: Optional[str] = None


@dataclass
class EpisodeContext:
    episode_id: str
    episode_title: str
    subtitle_path: str
    audio_path: Optional[str] = None
    guest_list: List[Guest] = field(default_factory=list)
    ad_scripts: List[AdScript] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class CheckResult:
    episode_id: str
    check_version: int
    issues: List[Issue]
    total_issues: int = field(init=False)
    checked_at: datetime = field(default_factory=datetime.now)
    notes: Optional[str] = None

    def __post_init__(self):
        self.total_issues = len(self.issues)


@dataclass
class HistoryRecord:
    episode_id: str
    check_version: int
    check_time: datetime
    issue_count: int
    resolved_count: int
    diff_summary: Optional[str] = None


@dataclass
class GuestDiff:
    guest_name: str
    change_type: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None


@dataclass
class ExportItem:
    time_range: str
    issue_type: str
    description: str
    reason: str
    next_action: str
    status: str
