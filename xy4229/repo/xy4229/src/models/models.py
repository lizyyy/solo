"""数据模型定义"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional, Dict, Any
import json


class IssueType(Enum):
    """问题类型枚举"""
    SUBTITLE_DELAY = "字幕延迟"
    SPEAKER_MISSING = "说话人漏标"
    SOUND_EFFECT_MISSING = "音效提示缺失"
    READING_SPEED_TOO_FAST = "阅读速度过快"
    TIMELINE_OVERLAP = "时间轴重叠"
    SUBTITLE_TOO_EARLY = "字幕过早"


class IssueSeverity(Enum):
    """问题严重程度"""
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"
    CRITICAL = "严重"


@dataclass
class Subtitle:
    """字幕条目数据模型"""
    index: int
    start_time: timedelta
    end_time: timedelta
    text: str
    speaker: Optional[str] = None
    sound_effect: bool = False
    offset_applied: timedelta = field(default_factory=lambda: timedelta(seconds=0))
    original_start_time: Optional[timedelta] = None
    original_end_time: Optional[timedelta] = None

    def __post_init__(self):
        if self.original_start_time is None:
            self.original_start_time = self.start_time
        if self.original_end_time is None:
            self.original_end_time = self.end_time

    @property
    def duration(self) -> timedelta:
        return self.end_time - self.start_time

    @property
    def word_count(self) -> int:
        return len(self.text.replace('\n', ' ').strip())

    @property
    def reading_speed(self) -> float:
        """计算阅读速度（字/秒）"""
        duration_seconds = self.duration.total_seconds()
        if duration_seconds <= 0:
            return float('inf')
        return self.word_count / duration_seconds

    def apply_offset(self, offset: timedelta):
        """应用时间偏移"""
        self.offset_applied += offset
        self.start_time = self.original_start_time + self.offset_applied
        self.end_time = self.original_end_time + self.offset_applied


@dataclass
class TimecodeEntry:
    """视频时间码条目"""
    index: int
    timecode: timedelta
    description: str
    scene_type: str = "dialogue"  # dialogue, action, sound_effect, transition


@dataclass
class AudioAnnotation:
    """环境音标注"""
    index: int
    start_time: timedelta
    end_time: timedelta
    sound_type: str  # music, dialogue, effect, ambient, silence
    description: str
    volume: str = "normal"  # loud, normal, quiet


@dataclass
class FeedbackRecord:
    """观众反馈记录"""
    index: int
    timestamp: timedelta
    issue_type: str
    description: str
    reporter: str = ""
    severity: str = "medium"


@dataclass
class Issue:
    """检测到的问题"""
    issue_type: IssueType
    subtitle_index: Optional[int] = None
    start_time: Optional[timedelta] = None
    end_time: Optional[timedelta] = None
    severity: IssueSeverity = IssueSeverity.MEDIUM
    description: str = ""
    suggested_fix: str = ""
    resolved: bool = False
    resolution_note: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type.value,
            "subtitle_index": self.subtitle_index,
            "start_time": str(self.start_time) if self.start_time else "",
            "end_time": str(self.end_time) if self.end_time else "",
            "severity": self.severity.value,
            "description": self.description,
            "suggested_fix": self.suggested_fix,
            "resolved": self.resolved,
            "resolution_note": self.resolution_note
        }


@dataclass
class CalibrationProject:
    """校准项目"""
    name: str = "未命名项目"
    created_at: datetime = field(default_factory=datetime.now)
    modified_at: datetime = field(default_factory=datetime.now)
    
    subtitles: List[Subtitle] = field(default_factory=list)
    timecodes: List[TimecodeEntry] = field(default_factory=list)
    audio_annotations: List[AudioAnnotation] = field(default_factory=list)
    feedback_records: List[FeedbackRecord] = field(default_factory=list)
    
    issues: List[Issue] = field(default_factory=list)
    global_offset: timedelta = field(default_factory=lambda: timedelta(seconds=0))
    
    notes: str = ""

    def apply_global_offset(self, offset: timedelta):
        """应用全局偏移到所有字幕"""
        self.global_offset = offset
        for subtitle in self.subtitles:
            # 重置为原始时间，然后应用新的全局偏移
            subtitle.start_time = subtitle.original_start_time + offset
            subtitle.end_time = subtitle.original_end_time + offset
            subtitle.offset_applied = offset

    def get_subtitle_by_index(self, index: int) -> Optional[Subtitle]:
        for sub in self.subtitles:
            if sub.index == index:
                return sub
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "modified_at": self.modified_at.isoformat(),
            "notes": self.notes,
            "global_offset_seconds": self.global_offset.total_seconds()
        }


def timedelta_to_srt_format(td: timedelta) -> str:
    """将 timedelta 转换为 SRT 时间格式 HH:MM:SS,mmm"""
    total_seconds = td.total_seconds()
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)
    milliseconds = int((total_seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def parse_srt_time(time_str: str) -> timedelta:
    """解析 SRT 时间格式为 timedelta"""
    time_str = time_str.strip().replace(',', '.')
    if ':' in time_str:
        parts = time_str.split(':')
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return timedelta(hours=hours, minutes=minutes, seconds=seconds)
    return timedelta(seconds=float(time_str))
