from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime, timedelta


class CheckStatus(Enum):
    PENDING = "pending"
    CHECKED = "checked"
    ISSUE = "issue"


class AlertType(Enum):
    PROP_CONFLICT = "prop_conflict"
    ACTOR_MISSING = "actor_missing"
    PHOTO_MISSING = "photo_missing"
    TRANSITION_SHORT = "transition_short"


@dataclass
class Actor:
    id: str
    name: str
    is_present: bool = True
    notes: str = ""


@dataclass
class Prop:
    id: str
    name: str
    photo_path: Optional[str] = None
    notes: str = ""


@dataclass
class PropUsage:
    prop_id: str
    prop_name: str
    usage_type: str  # "上场" or "撤场"
    scene_id: str
    scene_name: str
    time_offset: int = 0  # 相对于场景开始的秒数
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    notes: str = ""
    check_status: CheckStatus = CheckStatus.PENDING


@dataclass
class Cue:
    id: str
    scene_id: str
    cue_type: str  # "灯光", "音效", "道具", "演员", "其他"
    content: str
    time_offset: int = 0
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    notes: str = ""


@dataclass
class Scene:
    id: str
    name: str
    act: int  # 第几幕
    scene_number: int  # 第几场
    start_time: Optional[datetime] = None
    duration: int = 0  # 预计时长（分钟）
    props: List[PropUsage] = field(default_factory=list)
    cues: List[Cue] = field(default_factory=list)
    notes: str = ""


@dataclass
class Transition:
    from_scene_id: str
    to_scene_id: str
    transition_time: int = 0  # 换场时间（秒）
    props_to_remove: List[str] = field(default_factory=list)
    props_to_add: List[str] = field(default_factory=list)


@dataclass
class Alert:
    alert_type: AlertType
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    scene_id: Optional[str] = None
    prop_id: Optional[str] = None
    actor_id: Optional[str] = None
    check_status: CheckStatus = CheckStatus.PENDING
    resolved: bool = False


@dataclass
class ShowData:
    show_name: str = ""
    show_date: Optional[datetime] = None
    actors: Dict[str, Actor] = field(default_factory=dict)
    props: Dict[str, Prop] = field(default_factory=dict)
    scenes: Dict[str, Scene] = field(default_factory=dict)
    transitions: List[Transition] = field(default_factory=list)
    alerts: List[Alert] = field(default_factory=list)
    prop_photos_dir: Optional[str] = None
    last_updated: Optional[datetime] = None
