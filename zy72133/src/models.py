from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class TrackStatus(Enum):
    MATCHED = "已匹配"
    UNMATCHED = "未匹配"
    DUPLICATE = "重复曲目"
    OLD_VERSION = "旧版母带"
    MISSING_LICENSE = "缺授权"
    RENAMED = "人工改名"
    CONFLICT = "数据冲突"


class ExceptionType(Enum):
    DUPLICATE = "重复曲目"
    OLD_VERSION = "旧版母带"
    MISSING_LICENSE = "缺授权"
    RENAMED = "人工改名"
    FILENAME_MISMATCH = "文件名不匹配"
    METADATA_MISMATCH = "元数据不匹配"


@dataclass
class TrackRecord:
    track_id: str
    title: str
    artist: str
    album: Optional[str] = None
    duration: Optional[float] = None
    bpm: Optional[float] = None
    energy_level: Optional[int] = None
    license_info: Optional[str] = None
    notes: Optional[str] = None
    source_file: str = ""
    source_row: int = 0
    imported_at: datetime = field(default_factory=datetime.now)


@dataclass
class AudioFile:
    file_path: str
    file_name: str
    file_size: int
    modified_at: datetime
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    duration: Optional[float] = None
    bpm: Optional[float] = None
    energy_score: Optional[float] = None
    md5_hash: Optional[str] = None


@dataclass
class MatchResult:
    track: TrackRecord
    audio_file: Optional[AudioFile]
    status: TrackStatus
    match_confidence: float = 0.0
    exceptions: List[ExceptionType] = field(default_factory=list)
    exception_details: Dict[str, Any] = field(default_factory=dict)
    matched_at: datetime = field(default_factory=datetime.now)
    match_notes: str = ""


@dataclass
class AuditEntry:
    entry_id: str
    timestamp: datetime
    operator: str
    action: str
    track_id: Optional[str] = None
    file_path: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: str = ""
    source: str = ""


@dataclass
class Conflict:
    conflict_id: str
    track_id: str
    field_name: str
    excel_value: str
    import_value: str
    detected_at: datetime = field(default_factory=datetime.now)
    suggested_action: str = ""
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: str = ""
