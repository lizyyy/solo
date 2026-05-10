"""数据模型定义"""
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import List, Optional


class DamageLevel(Enum):
    """破损等级：决定修复优先级和所需修复师能力"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RepairSkill(Enum):
    """修复师技能类型"""
    PAPER_REPAIR = "paper_repair"
    BINDING = "binding"
    COLOR_RESTORATION = "color_restoration"
    DIGITALIZATION = "digitalization"
    DEACIDIFICATION = "deacidification"


@dataclass
class RareBook:
    """善本信息"""
    book_id: str
    title: str
    damage_level: DamageLevel
    required_skills: List[RepairSkill]
    estimated_repair_days: int
    import_source: str
    line_number: int
    notes: Optional[str] = None


@dataclass
class Restorer:
    """修复师信息"""
    restorer_id: str
    name: str
    skills: List[RepairSkill]
    max_damage_level: DamageLevel
    vacation_days: List[date] = field(default_factory=list)
    import_source: str = ""
    line_number: int = 0


@dataclass
class Exhibition:
    """展览借调信息"""
    exhibition_id: str
    book_id: str
    start_date: date
    end_date: date
    import_source: str = ""
    line_number: int = 0


@dataclass
class ScheduleEntry:
    """排程结果"""
    book_id: str
    title: str
    restorer_id: str
    restorer_name: str
    start_date: date
    end_date: date
    damage_level: DamageLevel
    notes: Optional[str] = None


@dataclass
class ValidationIssue:
    """验证问题记录"""
    issue_type: str
    source: str
    line_number: int
    field_name: Optional[str]
    raw_value: Optional[str]
    message: str
    requires_manual_review: bool = False


@dataclass
class ConflictInfo:
    """冲突信息"""
    conflict_type: str
    book_id: str
    conflicting_item_id: str
    description: str
    affected_date_range: Optional[tuple] = None


@dataclass
class ImportResult:
    """导入结果汇总"""
    source: str
    total_rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    issues: List[ValidationIssue] = field(default_factory=list)
    records: List = field(default_factory=list)


@dataclass
class ScheduleResult:
    """排程结果汇总"""
    scheduled_count: int = 0
    unscheduled_count: int = 0
    manual_review_count: int = 0
    conflicts: List[ConflictInfo] = field(default_factory=list)
    schedule: List[ScheduleEntry] = field(default_factory=list)
    manual_review_items: List = field(default_factory=list)
