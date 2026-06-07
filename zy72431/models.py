from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "normal"
    LEAVE_CONSUMED = "leave_consumed"
    SUPPLEMENTED = "supplemented"
    PENDING_REVIEW = "pending_review"
    CORRECTED = "corrected"


class DataSource(str, Enum):
    TUNER_MESSAGE = "tuner_message"
    GROUP_SIGNUP = "group_signup"
    MANUAL = "manual"


@dataclass
class TunerMessage:
    id: str
    date: str
    band_name: str
    room: str
    start_time: str
    end_time: str
    hours: float
    tuner_name: str
    notes: str = ""
    raw_content: str = ""
    imported_at: datetime = field(default_factory=datetime.now)


@dataclass
class GroupSignup:
    id: str
    date: str
    band_name: str
    members: List[str]
    song_list: List[str]
    remarks: str = ""
    raw_content: str = ""
    imported_at: datetime = field(default_factory=datetime.now)


@dataclass
class RehearsalRecord:
    id: str
    date: str
    band_name: str
    room: str
    start_time: str
    end_time: str
    hours: float
    tuner_name: str
    song_list: List[str] = field(default_factory=list)
    members: List[str] = field(default_factory=list)
    status: RecordStatus = RecordStatus.NORMAL
    source: DataSource = DataSource.TUNER_MESSAGE
    is_leave: bool = False
    is_consumed: bool = False
    needs_review: bool = False
    review_note: str = ""
    tuner_note: str = ""
    group_remark: str = ""
    corrections: List[Dict] = field(default_factory=list)
    run_count: int = 1
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class SongChecklist:
    id: str
    band_name: str
    song_name: str
    planned: bool = True
    actually_performed: bool = False
    note: str = ""
    source: str = ""


@dataclass
class ProcessingLog:
    id: str
    record_id: str
    action: str
    detail: str
    timestamp: datetime = field(default_factory=datetime.now)
    operator: str = ""
