"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime, date, time
from enum import Enum, auto
from typing import Optional, List, Dict, Any
from uuid import uuid4


class IssueType(Enum):
    """问题类型枚举"""
    OVERLAP = "排片重叠"
    WARMUP_INSUFFICIENT = "预热不足"
    LAMP_HOURS_EXCEEDED = "灯泡超时"
    MIDNIGHT_ASSIGNMENT_ERROR = "跨午夜归属错误"


class EventType(Enum):
    """时间线事件类型枚举"""
    SCREENING_START = "放映开始"
    SCREENING_END = "放映结束"
    PROJECTOR_ON = "放映机开机"
    PROJECTOR_OFF = "放映机关机"
    WARMUP_START = "预热开始"
    COOLDOWN_END = "冷却结束"
    LAMP_CHECK = "灯泡检查"


@dataclass
class Screening:
    """排片信息"""
    id: str
    hall_id: str
    hall_name: str
    film_name: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    date: date
    
    # 可选字段
    film_id: Optional[str] = None
    language: Optional[str] = None
    format_3d: bool = False
    is_midnight: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "hall_id": self.hall_id,
            "hall_name": self.hall_name,
            "film_name": self.film_name,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "duration_minutes": self.duration_minutes,
            "date": self.date.isoformat(),
            "film_id": self.film_id,
            "language": self.language,
            "format_3d": self.format_3d,
            "is_midnight": self.is_midnight
        }


@dataclass
class ProjectorLog:
    """放映机日志"""
    id: str
    hall_id: str
    event_time: datetime
    event_type: str
    status: str
    
    # 可选字段
    lamp_hours: Optional[float] = None
    temperature: Optional[float] = None
    message: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "hall_id": self.hall_id,
            "event_time": self.event_time.isoformat(),
            "event_type": self.event_type,
            "status": self.status,
            "lamp_hours": self.lamp_hours,
            "temperature": self.temperature,
            "message": self.message
        }


@dataclass
class LampHours:
    """灯泡小时数记录"""
    hall_id: str
    date: date
    start_hours: float
    end_hours: float
    used_hours: float
    
    # 可选字段
    projector_model: Optional[str] = None
    lamp_model: Optional[str] = None
    max_lamp_hours: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hall_id": self.hall_id,
            "date": self.date.isoformat(),
            "start_hours": self.start_hours,
            "end_hours": self.end_hours,
            "used_hours": self.used_hours,
            "projector_model": self.projector_model,
            "lamp_model": self.lamp_model,
            "max_lamp_hours": self.max_lamp_hours
        }


@dataclass
class HallRules:
    """影厅规则配置"""
    hall_id: str
    hall_name: str
    
    # 时间规则
    warmup_minutes: int = 15
    cooldown_minutes: int = 5
    cleanup_minutes: int = 10
    
    # 设备规则
    max_lamp_hours: float = 2000.0
    lamp_warning_threshold: float = 1800.0
    
    # 其他配置
    capacity: Optional[int] = None
    projector_id: Optional[str] = None
    audio_system: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hall_id": self.hall_id,
            "hall_name": self.hall_name,
            "warmup_minutes": self.warmup_minutes,
            "cooldown_minutes": self.cooldown_minutes,
            "cleanup_minutes": self.cleanup_minutes,
            "max_lamp_hours": self.max_lamp_hours,
            "lamp_warning_threshold": self.lamp_warning_threshold,
            "capacity": self.capacity,
            "projector_id": self.projector_id,
            "audio_system": self.audio_system
        }


@dataclass
class TimelineEvent:
    """时间线事件"""
    id: str = field(default_factory=lambda: str(uuid4()))
    event_type: EventType = EventType.SCREENING_START
    time: datetime = field(default_factory=datetime.now)
    hall_id: str = ""
    screening_id: Optional[str] = None
    description: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "event_type": self.event_type.value,
            "time": self.time.isoformat(),
            "hall_id": self.hall_id,
            "screening_id": self.screening_id,
            "description": self.description,
            "details": self.details
        }


@dataclass
class Issue:
    """检测到的问题"""
    id: str = field(default_factory=lambda: str(uuid4()))
    issue_type: IssueType = IssueType.OVERLAP
    hall_id: str = ""
    hall_name: str = ""
    screening_id: Optional[str] = None
    film_name: str = ""
    description: str = ""
    severity: str = "high"
    status: str = "new"
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    resolved_at: Optional[datetime] = None
    
    # 相关数据
    related_screening_ids: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "issue_type": self.issue_type.value,
            "hall_id": self.hall_id,
            "hall_name": self.hall_name,
            "screening_id": self.screening_id,
            "film_name": self.film_name,
            "description": self.description,
            "severity": self.severity,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "related_screening_ids": self.related_screening_ids,
            "details": self.details
        }


@dataclass
class ScreeningTimeline:
    """单个排片的完整时间线"""
    screening: Screening
    
    # 关键时间点
    warmup_start: Optional[datetime] = None
    projector_on_time: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    projector_off_time: Optional[datetime] = None
    cooldown_end: Optional[datetime] = None
    
    # 相关事件
    events: List[TimelineEvent] = field(default_factory=list)
    
    # 检测到的问题
    issues: List[Issue] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "screening": self.screening.to_dict(),
            "warmup_start": self.warmup_start.isoformat() if self.warmup_start else None,
            "projector_on_time": self.projector_on_time.isoformat() if self.projector_on_time else None,
            "actual_start": self.actual_start.isoformat() if self.actual_start else None,
            "actual_end": self.actual_end.isoformat() if self.actual_end else None,
            "projector_off_time": self.projector_off_time.isoformat() if self.projector_off_time else None,
            "cooldown_end": self.cooldown_end.isoformat() if self.cooldown_end else None,
            "events": [e.to_dict() for e in self.events],
            "issues": [i.to_dict() for i in self.issues]
        }


@dataclass
class ReviewState:
    """审核状态 - 用于持久化保存"""
    review_date: date
    hall_id: Optional[str] = None
    time_range_start: Optional[time] = None
    time_range_end: Optional[time] = None
    
    # 问题处理状态
    resolved_issue_ids: List[str] = field(default_factory=list)
    dismissed_issue_ids: List[str] = field(default_factory=list)
    issue_notes: Dict[str, str] = field(default_factory=dict)
    
    # 最后更新时间
    last_updated: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "review_date": self.review_date.isoformat(),
            "hall_id": self.hall_id,
            "time_range_start": self.time_range_start.isoformat() if self.time_range_start else None,
            "time_range_end": self.time_range_end.isoformat() if self.time_range_end else None,
            "resolved_issue_ids": self.resolved_issue_ids,
            "dismissed_issue_ids": self.dismissed_issue_ids,
            "issue_notes": self.issue_notes,
            "last_updated": self.last_updated.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReviewState":
        return cls(
            review_date=date.fromisoformat(data["review_date"]) if data.get("review_date") else date.today(),
            hall_id=data.get("hall_id"),
            time_range_start=time.fromisoformat(data["time_range_start"]) if data.get("time_range_start") else None,
            time_range_end=time.fromisoformat(data["time_range_end"]) if data.get("time_range_end") else None,
            resolved_issue_ids=data.get("resolved_issue_ids", []),
            dismissed_issue_ids=data.get("dismissed_issue_ids", []),
            issue_notes=data.get("issue_notes", {}),
            last_updated=datetime.fromisoformat(data["last_updated"]) if data.get("last_updated") else datetime.now()
        )
