"""数据模型定义"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any
import uuid
import json


def generate_id() -> str:
    return uuid.uuid4().hex[:12]


@dataclass
class AdSpot:
    """广告口播条目"""
    id: str = field(default_factory=generate_id)
    name: str = ""
    start_time: float = 0.0
    end_time: float = 0.0
    duration: float = 0.0
    content: str = ""
    speaker: str = ""
    source_file: str = ""
    notes: str = ""

    def __post_init__(self):
        if self.duration == 0 and self.end_time > self.start_time:
            self.duration = round(self.end_time - self.start_time, 3)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RawAudioTrack:
    """原始音轨条目"""
    id: str = field(default_factory=generate_id)
    name: str = ""
    start_time: float = 0.0
    end_time: float = 0.0
    duration: float = 0.0
    content: str = ""
    transcript: str = ""
    speaker: str = ""
    source_file: str = ""
    is_silence: bool = False
    silence_confidence: float = 0.0
    notes: str = ""

    def __post_init__(self):
        if self.duration == 0 and self.end_time > self.start_time:
            self.duration = round(self.end_time - self.start_time, 3)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AudioSlice:
    """音频切片结果"""
    id: str = field(default_factory=generate_id)
    name: str = ""
    start_time: float = 0.0
    end_time: float = 0.0
    duration: float = 0.0
    content: str = ""
    slice_type: str = "content"
    status: str = "pending"
    reviewed: bool = False
    reviewed_by: str = ""
    reviewed_at: Optional[datetime] = None
    source_type: str = ""
    source_id: str = ""
    source_ref: str = ""
    warnings: List[str] = field(default_factory=list)
    issues: List[str] = field(default_factory=list)
    subtitle_draft: str = ""
    subtitle_final: str = ""
    export_filename: str = ""
    notes: str = ""

    def __post_init__(self):
        if self.duration == 0 and self.end_time > self.start_time:
            self.duration = round(self.end_time - self.start_time, 3)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if self.reviewed_at:
            d["reviewed_at"] = self.reviewed_at.isoformat()
        return d


@dataclass
class HistoryRecord:
    """历史操作记录"""
    id: str = field(default_factory=generate_id)
    timestamp: datetime = field(default_factory=datetime.now)
    operation: str = ""
    operator: str = ""
    target_type: str = ""
    target_id: str = ""
    field_name: str = ""
    old_value: str = ""
    new_value: str = ""
    diff_summary: str = ""
    reason: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["timestamp"] = self.timestamp.isoformat()
        return d


@dataclass
class SilenceIssue:
    """静音段问题记录"""
    id: str = field(default_factory=generate_id)
    slice_id: str = ""
    start_time: float = 0.0
    end_time: float = 0.0
    duration: float = 0.0
    source_type: str = ""
    source_id: str = ""
    source_ref: str = ""
    detected_from: str = ""
    action_suggested: str = ""
    contact_person: str = ""
    status: str = "open"
    notes: str = ""

    def __post_init__(self):
        if self.duration == 0 and self.end_time > self.start_time:
            self.duration = round(self.end_time - self.start_time, 3)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Project:
    """项目容器"""
    id: str = field(default_factory=generate_id)
    name: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    ad_spots: List[AdSpot] = field(default_factory=list)
    raw_tracks: List[RawAudioTrack] = field(default_factory=list)
    slices: List[AudioSlice] = field(default_factory=list)
    history: List[HistoryRecord] = field(default_factory=list)
    silence_issues: List[SilenceIssue] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "ad_spots": [a.to_dict() for a in self.ad_spots],
            "raw_tracks": [t.to_dict() for t in self.raw_tracks],
            "slices": [s.to_dict() for s in self.slices],
            "history": [h.to_dict() for h in self.history],
            "silence_issues": [si.to_dict() for si in self.silence_issues],
            "metadata": self.metadata,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)
