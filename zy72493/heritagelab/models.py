"""
文化遗产视廊控制系统 - 数据模型
"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class OpinionStatus(Enum):
    """居民意见状态"""
    SUMMARY_ONLY = "只剩汇总无原文"
    WITH_SOURCE = "有原文可追溯"
    VERIFIED = "已复核确认"


class ConflictLevel(Enum):
    """冲突级别"""
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


class NextAction(Enum):
    """下一步处理人"""
    COMMUNITY_SECRETARY = "社区书记复核"
    TRAFFIC_MA = "交通协管老马补充"
    COMPLETED = "处理完成"


@dataclass
class ResidentOpinion:
    """居民意见"""
    id: str
    location: str
    summary: str
    original_text: Optional[str] = None
    reporter: str = ""
    report_time: Optional[datetime] = None
    status: OpinionStatus = OpinionStatus.SUMMARY_ONLY
    source_type: Optional[str] = None
    source_id: Optional[str] = None


@dataclass
class InspectionRecord:
    """网格员巡查表记录"""
    id: str
    inspector: str
    inspection_date: datetime
    location: str
    heritage_site: str
    opinions: List[ResidentOpinion] = field(default_factory=list)
    notes: str = ""


@dataclass
class ConstructionNotice:
    """施工告示"""
    id: str
    project_name: str
    location: str
    start_date: datetime
    end_date: datetime
    construction_type: str
    impact_on_heritage: str
    publisher: str
    related_opinion_ids: List[str] = field(default_factory=list)


@dataclass
class ConflictItem:
    """冲突复核表条目"""
    id: str
    opinion_id: str
    opinion_summary: str
    location: str
    conflict_reason: str
    missing_materials: List[str]
    next_action: NextAction
    conflict_level: ConflictLevel
    is_resolved: bool = False
    resolution_note: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class HeritageCorridorControl:
    """文化遗产视廊控制主数据"""
    inspections: Dict[str, InspectionRecord] = field(default_factory=dict)
    notices: Dict[str, ConstructionNotice] = field(default_factory=dict)
    conflicts: Dict[str, ConflictItem] = field(default_factory=dict)
