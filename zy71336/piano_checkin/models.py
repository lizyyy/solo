"""数据模型定义"""
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from enum import Enum
import uuid
import json
import os


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
AUDIO_DIR = os.path.join(DATA_DIR, "audio")
STUDENTS_FILE = os.path.join(DATA_DIR, "students.json")
RECORDS_FILE = os.path.join(DATA_DIR, "records.json")
SCHEDULE_FILE = os.path.join(DATA_DIR, "schedule.json")
COMMENTS_FILE = os.path.join(DATA_DIR, "comments.json")
HISTORY_DIR = os.path.join(DATA_DIR, "history")


class RecordStatus(str, Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    PENDING = "pending"
    MERGED = "merged"


class AbnormalType(str, Enum):
    BLANK_AUDIO = "blank_audio"
    SHORT_AUDIO = "short_audio"
    MAKEUP_OVERDUE = "makeup_overdue"
    DUPLICATE = "duplicate"
    INVALID_REASON = "invalid_reason"
    LOW_QUALITY = "low_quality"


@dataclass
class Student:
    student_id: str
    name: str
    level: str
    teacher: str
    parent_phone: str
    join_date: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Student":
        return cls(**data)


@dataclass
class AudioInfo:
    file_path: str
    file_name: str
    duration_seconds: float
    sample_rate: int
    channels: int
    avg_volume: float
    is_blank: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AudioInfo":
        return cls(**data)


@dataclass
class MakeupInfo:
    is_makeup: bool
    original_date: Optional[str] = None
    reason: Optional[str] = None
    submit_date: Optional[str] = None
    approved: Optional[bool] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MakeupInfo":
        return cls(**data)


@dataclass
class CheckinRecord:
    record_id: str
    student_id: str
    checkin_date: str
    checkin_time: str
    audio: AudioInfo
    makeup: MakeupInfo
    status: RecordStatus = RecordStatus.PENDING
    abnormal_types: List[AbnormalType] = field(default_factory=list)
    abnormal_details: List[str] = field(default_factory=list)
    merged_into: Optional[str] = None
    merged_from: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["audio"] = self.audio.to_dict()
        data["makeup"] = self.makeup.to_dict()
        data["status"] = self.status.value
        data["abnormal_types"] = [t.value for t in self.abnormal_types]
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CheckinRecord":
        audio = AudioInfo.from_dict(data.pop("audio"))
        makeup = MakeupInfo.from_dict(data.pop("makeup"))
        data["status"] = RecordStatus(data["status"])
        data["abnormal_types"] = [AbnormalType(t) for t in data["abnormal_types"]]
        return cls(audio=audio, makeup=makeup, **data)


@dataclass
class Comment:
    comment_id: str
    record_id: str
    teacher: str
    content: str
    created_at: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Comment":
        return cls(**data)


@dataclass
class Schedule:
    schedule_id: str
    student_id: str
    day_of_week: int
    start_time: str
    end_time: str
    course_type: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Schedule":
        return cls(**data)


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def ensure_dirs():
    for d in [DATA_DIR, AUDIO_DIR, HISTORY_DIR]:
        os.makedirs(d, exist_ok=True)


def load_json(file_path: str, default: Any) -> Any:
    if not os.path.exists(file_path):
        return default
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return default


def save_json(file_path: str, data: Any, save_history: bool = True):
    ensure_dirs()
    if save_history and os.path.exists(file_path):
        history_file = os.path.join(
            HISTORY_DIR,
            f"{os.path.basename(file_path)}.{datetime.now().strftime('%Y%m%d_%H%M%S')}.bak"
        )
        with open(file_path, "r", encoding="utf-8") as src:
            with open(history_file, "w", encoding="utf-8") as dst:
                dst.write(src.read())
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
