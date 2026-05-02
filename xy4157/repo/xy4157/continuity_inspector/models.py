"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class ShotStatus(Enum):
    SHOT = "已拍摄"
    SKIPPED = "跳过"
    RESHOOT = "补拍"


class IssueSeverity(Enum):
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


class IssueCategory(Enum):
    SCENE_ORDER = "场次顺序"
    COSTUME_CONTINUITY = "服装连续性"
    PROP_CONTINUITY = "道具连续性"
    MISSING_SCREENSHOT = "缺失截图"
    DUPLICATE_SHOT = "重复镜号"
    RESHOOT_CONFLICT = "补拍冲突"
    NAMING_INCONSISTENCY = "命名不一致"


@dataclass
class CostumeRule:
    character: str
    scene_id: str
    description: str
    accessories: List[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class PropRule:
    prop_name: str
    scene_id: str
    required: bool = True
    state: str = ""
    notes: str = ""


@dataclass
class CallSheetEntry:
    scene_id: str
    shot_number: str
    description: str
    characters: List[str]
    props: List[str]
    scheduled_time: Optional[str] = None
    location: str = ""
    page_count: float = 0.0


@dataclass
class ScriptNote:
    scene_id: str
    shot_number: str
    take: int
    status: ShotStatus
    characters: List[str]
    costumes: Dict[str, str]
    props: List[str]
    notes: str = ""
    shot_date: Optional[str] = None
    camera_angle: str = ""
    lens: str = ""
    duration: Optional[str] = None


@dataclass
class ScreenshotItem:
    file_path: str
    scene_id: str
    shot_number: str
    take: Optional[int] = None
    timestamp: Optional[str] = None


@dataclass
class ContinuityIssue:
    issue_id: str
    category: IssueCategory
    severity: IssueSeverity
    scene_id: str
    shot_number: Optional[str]
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    related_shots: List[str] = field(default_factory=list)
    approved: bool = False
    approval_notes: str = ""
    approved_by: str = ""
    approved_at: Optional[str] = None


@dataclass
class AuditEntry:
    action: str
    timestamp: str
    user: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProjectData:
    project_name: str
    production_day: str
    call_sheet_entries: List[CallSheetEntry] = field(default_factory=list)
    script_notes: List[ScriptNote] = field(default_factory=list)
    screenshots: List[ScreenshotItem] = field(default_factory=list)
    costume_rules: List[CostumeRule] = field(default_factory=list)
    prop_rules: List[PropRule] = field(default_factory=list)
    issues: List[ContinuityIssue] = field(default_factory=list)
    audit_trail: List[AuditEntry] = field(default_factory=list)
