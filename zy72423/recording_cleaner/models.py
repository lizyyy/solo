from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class SongStatus(str, Enum):
    PENDING_REVIEW = "待音乐老师复核"
    PENDING_CONTRACT = "待补合同页截图"
    COMPLETED = "已完成"
    NORMAL = "正常（无同名）"


@dataclass
class Track:
    track_id: str
    track_name: str
    song_name_raw: str
    song_name_scene: Optional[str] = None
    song_name_copyright: Optional[str] = None
    remark: str = ""
    source: str = ""


@dataclass
class Song:
    song_id: str
    scene_name: str
    copyright_name: Optional[str] = None
    tracks: List[Track] = field(default_factory=list)
    status: SongStatus = SongStatus.NORMAL
    has_dual_name: bool = False
    contract_screenshot: Optional[str] = None
    review_note: str = ""
    reviewer: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class WechatSignup:
    signup_id: str
    raw_text: str
    date: str
    songs_raw: List[dict] = field(default_factory=list)


@dataclass
class ReviewLog:
    log_id: str
    song_id: str
    action: str
    operator: str
    note: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class WeeklyReportItem:
    song_scene_name: str
    song_copyright_name: Optional[str]
    status: SongStatus
    why_kept: str
    missing_materials: List[str]
    next_step_person: str
    next_step_detail: str
