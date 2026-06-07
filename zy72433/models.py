from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum


class TrackStatus(str, Enum):
    NORMAL = "正常"
    NEEDS_REWORK = "待返工"
    PENDING_REVIEW = "待复核"
    COMPLETED = "已完成"


class ChangeReason(str, Enum):
    WRONG_CALIBER = "错口径"
    SUPPLEMENT_REWORK = "补录返工"
    MANUAL_CORRECTION = "人工修正"
    RERUN = "重跑"


class NextStep(str, Enum):
    CONTACT_COPYRIGHT_OPS = "找版权运营"
    CONTACT_XIAOLU = "找版权运营小鹿"
    WAIT_FOR_REHEARSAL = "等排练"
    NO_ACTION = "无需处理"


@dataclass
class TunerComment:
    id: str
    song_name: str
    track_name: str
    comment: str
    import_time: datetime
    has_rework_reason: bool = False
    rework_reason: Optional[str] = None


@dataclass
class RehearsalSignup:
    id: str
    song_name: str
    signer: str
    remark: str
    signup_time: datetime


@dataclass
class RehearsalChangeRecord:
    id: str
    song_name: str
    track_name: str
    why_kept: str
    missing_materials: List[str]
    next_step: NextStep
    reason: ChangeReason
    created_at: datetime
    updated_at: datetime
    operator: str = "系统"


@dataclass
class ReviewReport:
    id: str
    song_name: str
    import_tuner_time: datetime
    supplement_signup_time: Optional[datetime] = None
    change_records: List[RehearsalChangeRecord] = field(default_factory=list)
    status: str = "进行中"
    notes: str = ""


@dataclass
class DemoReview:
    id: str
    song_name: str
    tuner_comment: Optional[TunerComment] = None
    rehearsal_signups: List[RehearsalSignup] = field(default_factory=list)
    change_records: List[RehearsalChangeRecord] = field(default_factory=list)
    review_report: Optional[ReviewReport] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
