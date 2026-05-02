"""数据模型定义"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class Language(str, Enum):
    ZH = "zh"
    EN = "en"
    JA = "ja"
    KO = "ko"
    ES = "es"
    FR = "fr"
    DE = "de"
    RU = "ru"


class SubtitleFormat(str, Enum):
    SRT = "srt"
    VTT = "vtt"


class IssueType(str, Enum):
    TIMECODE_FORMAT = "timecode_format"
    OVERLAP = "overlap"
    EMPTY_SUBTITLE = "empty_subtitle"
    SEQUENCE_GAP = "sequence_gap"
    MISSING_SEGMENT = "missing_segment"
    READING_SPEED = "reading_speed"
    PLACEHOLDER_MISSING = "placeholder_missing"
    SPEAKER_TAG_MISMATCH = "speaker_tag_mismatch"
    FILENAME_MISMATCH = "filename_mismatch"
    CURRENCY_MISMATCH = "currency_mismatch"


class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class ReviewAction(str, Enum):
    CONFIRM = "confirm"
    DISMISS = "dismiss"
    PENDING = "pending"


class Timecode(BaseModel):
    hours: int
    minutes: int
    seconds: int
    milliseconds: int

    def to_seconds(self) -> float:
        return self.hours * 3600 + self.minutes * 60 + self.seconds + self.milliseconds / 1000

    def to_timedelta(self) -> timedelta:
        return timedelta(seconds=self.to_seconds())

    def to_srt_format(self) -> str:
        return f"{self.hours:02d}:{self.minutes:02d}:{self.seconds:02d},{self.milliseconds:03d}"

    def to_vtt_format(self) -> str:
        return f"{self.hours:02d}:{self.minutes:02d}:{self.seconds:02d}.{self.milliseconds:03d}"

    @classmethod
    def from_seconds(cls, seconds: float) -> "Timecode":
        hours = int(seconds // 3600)
        remaining = seconds % 3600
        minutes = int(remaining // 60)
        remaining = remaining % 60
        secs = int(remaining // 1)
        milliseconds = int((remaining - secs) * 1000)
        return cls(hours=hours, minutes=minutes, seconds=secs, milliseconds=milliseconds)


class SubtitleEntry(BaseModel):
    index: int
    start: Timecode
    end: Timecode
    text: str
    speaker: Optional[str] = None
    original_text: Optional[str] = None

    def duration_seconds(self) -> float:
        return self.end.to_seconds() - self.start.to_seconds()

    def reading_speed(self, chars_per_second: float = None) -> float:
        if chars_per_second is None:
            return len(self.text.strip()) / self.duration_seconds() if self.duration_seconds() > 0 else 0
        return len(self.text.strip()) / self.duration_seconds() if self.duration_seconds() > 0 else 0


class SubtitleFile(BaseModel):
    filepath: str
    filename: str
    language: Language
    format: SubtitleFormat
    episode: Optional[int] = None
    entries: List[SubtitleEntry] = Field(default_factory=list)
    sha256: Optional[str] = None
    imported_at: Optional[datetime] = None


class ScriptEntry(BaseModel):
    index: int
    original_text: str
    translated_text: Optional[str] = None
    speaker: Optional[str] = None
    start_timecode: Optional[str] = None
    end_timecode: Optional[str] = None


class ScriptFile(BaseModel):
    filepath: str
    filename: str
    language: Language
    episode: Optional[int] = None
    entries: List[ScriptEntry] = Field(default_factory=list)
    sha256: Optional[str] = None
    imported_at: Optional[datetime] = None


class ManifestItem(BaseModel):
    episode: int
    original_filename: str
    expected_filename: str
    languages: List[Language]
    platform: str


class ManifestFile(BaseModel):
    filepath: str
    filename: str
    items: List[ManifestItem] = Field(default_factory=list)
    sha256: Optional[str] = None
    imported_at: Optional[datetime] = None


class Issue(BaseModel):
    id: str
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    language: Optional[Language] = None
    episode: Optional[int] = None
    subtitle_index: Optional[int] = None
    filename: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    review_action: ReviewAction = ReviewAction.PENDING
    review_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)


class Quarantine(BaseModel):
    issues: List[Issue] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.now)


class AlignmentPair(BaseModel):
    source_index: int
    target_index: int
    source_text: str
    target_text: str
    confidence: float
    language_pair: str


class AlignmentResult(BaseModel):
    source_language: Language
    target_language: Language
    episode: Optional[int] = None
    pairs: List[AlignmentPair] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.now)


class FixAction(str, Enum):
    REINDEX = "reindex"
    ADJUST_TIMECODE = "adjust_timecode"
    RENAME_FILE = "rename_file"
    ADD_MISSING = "add_missing"
    FLAG_FOR_TRANSLATION = "flag_for_translation"


class FixPlanItem(BaseModel):
    id: str
    action: FixAction
    description: str
    language: Optional[Language] = None
    episode: Optional[int] = None
    filename: Optional[str] = None
    current_value: Optional[str] = None
    proposed_value: Optional[str] = None
    requires_manual: bool = False
    issue_ids: List[str] = Field(default_factory=list)


class FixPlan(BaseModel):
    items: List[FixPlanItem] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.now)
    is_dry_run: bool = True


class ChangeLogEntry(BaseModel):
    id: str
    action: str
    description: str
    language: Optional[Language] = None
    episode: Optional[int] = None
    filename: Optional[str] = None
    before: Optional[str] = None
    after: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class ChangeLog(BaseModel):
    entries: List[ChangeLogEntry] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.now)


class HistoryRecord(BaseModel):
    id: str
    episode: Optional[int] = None
    language: Optional[Language] = None
    issue_type: Optional[IssueType] = None
    issue_count: int
    check_timestamp: datetime
    summary: str


class ProjectConfig(BaseModel):
    languages: List[Language] = Field(default=[Language.ZH, Language.EN])
    frame_rate: float = Field(default=25.0)
    max_reading_speed_zh: float = Field(default=6.0)
    max_reading_speed_en: float = Field(default=12.0)
    min_subtitle_gap_ms: int = Field(default=40)
    placeholder_patterns: List[str] = Field(default=[r"\{[^}]+\}", r"\[[^\]]+\]"])
    platform_name_templates: Dict[str, str] = Field(default_factory=dict)
    output_directory: str = Field(default="dist")
    quarantine_directory: str = Field(default="quarantine")
    import_directory: str = Field(default="imports")
    history_directory: str = Field(default="history")
