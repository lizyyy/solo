"""
数据模型定义

包含 CUE、灯具、修改记录、问题等核心数据模型。
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any


class TriggerType(Enum):
    """触发类型枚举"""
    TIME = "time"
    AUTO = "auto"
    MANUAL = "manual"


class FixtureType(Enum):
    """灯具类型枚举"""
    SPOT = "spot"
    WASH = "wash"
    MOVING_HEAD = "moving_head"
    HAZER = "hazer"
    FOGGER = "fogger"
    LIFT = "lift"
    OTHER = "other"


class IssueType(Enum):
    """问题类型枚举"""
    CHANNEL_CONFLICT = "channel_conflict"
    TIME_OVERLAP = "time_overlap"
    DANGEROUS_JUMP = "dangerous_jump"
    MISSING_CONFIRMATION = "missing_confirmation"


class Severity(Enum):
    """严重级别枚举"""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class ReviewDecision(Enum):
    """人工判定枚举"""
    ACCEPT = "accept"
    REJECT = "reject"
    PENDING = "pending"


@dataclass
class Cue:
    """CUE 数据模型"""
    cue_number: str
    description: str
    trigger_type: TriggerType
    trigger_value: float
    duration: float
    channels: Dict[int, int]
    
    def __post_init__(self):
        for ch, val in self.channels.items():
            if not isinstance(ch, int) or ch < 1 or ch > 512:
                raise ValueError(f"无效通道号: {ch}")
            if not isinstance(val, int) or val < 0 or val > 255:
                raise ValueError(f"无效通道值: {val} (通道 {ch})")
    
    @property
    def start_time(self) -> float:
        """获取开始时间"""
        if self.trigger_type == TriggerType.TIME:
            return self.trigger_value
        return self.trigger_value
    
    @property
    def end_time(self) -> float:
        """获取结束时间"""
        return self.start_time + self.duration
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "cue_number": self.cue_number,
            "description": self.description,
            "trigger_type": self.trigger_type.value,
            "trigger_value": self.trigger_value,
            "duration": self.duration,
            "channels": self.channels,
            "start_time": self.start_time,
            "end_time": self.end_time,
        }


@dataclass
class Fixture:
    """灯具数据模型"""
    id: str
    name: str
    type: FixtureType
    start_channel: int
    channel_count: int
    channels: Dict[str, int] = field(default_factory=dict)
    requires_confirmation: bool = False
    
    def __post_init__(self):
        if self.start_channel < 1 or self.start_channel > 512:
            raise ValueError(f"无效起始通道: {self.start_channel}")
        if self.channel_count < 1:
            raise ValueError(f"无效通道数: {self.channel_count}")
        end_channel = self.start_channel + self.channel_count - 1
        if end_channel > 512:
            raise ValueError(f"灯具通道超出范围: 结束通道 {end_channel} > 512")
    
    @property
    def end_channel(self) -> int:
        """获取结束通道号"""
        return self.start_channel + self.channel_count - 1
    
    def get_affected_channels(self) -> List[int]:
        """获取灯具影响的所有通道列表"""
        return list(range(self.start_channel, self.end_channel + 1))
    
    def has_channel(self, channel: int) -> bool:
        """检查是否包含指定通道"""
        return self.start_channel <= channel <= self.end_channel
    
    def is_safety_device(self) -> bool:
        """检查是否为需要安全确认的设备"""
        return self.requires_confirmation or self.type in [FixtureType.HAZER, FixtureType.FOGGER, FixtureType.LIFT]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type.value,
            "start_channel": self.start_channel,
            "channel_count": self.channel_count,
            "end_channel": self.end_channel,
            "channels": self.channels,
            "requires_confirmation": self.requires_confirmation,
            "is_safety_device": self.is_safety_device(),
        }


@dataclass
class ChannelChange:
    """通道修改记录"""
    channel: int
    old_value: int
    new_value: int
    reason: str = ""


@dataclass
class Modification:
    """修改记录数据模型"""
    id: str
    cue_number: str
    modified_at: datetime
    modified_by: str
    changes: List[ChannelChange]
    confirmed: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "cue_number": self.cue_number,
            "modified_at": self.modified_at.isoformat(),
            "modified_by": self.modified_by,
            "changes": [
                {
                    "channel": c.channel,
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "reason": c.reason,
                }
                for c in self.changes
            ],
            "confirmed": self.confirmed,
        }


@dataclass
class Issue:
    """检测到的问题数据模型"""
    id: str
    type: IssueType
    severity: Severity
    title: str
    description: str
    affected_cues: List[str]
    affected_channels: List[int]
    details: Dict[str, Any] = field(default_factory=dict)
    review_decision: ReviewDecision = ReviewDecision.PENDING
    review_comment: str = ""
    reviewed_at: Optional[datetime] = None
    reviewed_by: str = ""
    
    @property
    def is_resolved(self) -> bool:
        """检查问题是否已解决"""
        return self.review_decision != ReviewDecision.PENDING
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "affected_cues": self.affected_cues,
            "affected_channels": self.affected_channels,
            "details": self.details,
            "review_decision": self.review_decision.value,
            "review_comment": self.review_comment,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "reviewed_by": self.reviewed_by,
            "is_resolved": self.is_resolved,
        }


@dataclass
class TheaterConfig:
    """剧场配置数据模型"""
    name: str
    total_channels: int = 512
    created_at: datetime = field(default_factory=datetime.now)
    dangerous_jump_threshold: int = 150
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "total_channels": self.total_channels,
            "created_at": self.created_at.isoformat(),
            "dangerous_jump_threshold": self.dangerous_jump_threshold,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TheaterConfig":
        return cls(
            name=data["name"],
            total_channels=data.get("total_channels", 512),
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.now(),
            dangerous_jump_threshold=data.get("dangerous_jump_threshold", 150),
        )


@dataclass
class ProjectData:
    """项目完整数据模型"""
    config: TheaterConfig
    cues: List[Cue] = field(default_factory=list)
    fixtures: List[Fixture] = field(default_factory=list)
    modifications: List[Modification] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    
    def get_cue_by_number(self, cue_number: str) -> Optional[Cue]:
        """根据 CUE 编号获取 CUE"""
        for cue in self.cues:
            if cue.cue_number == cue_number:
                return cue
        return None
    
    def get_fixture_by_channel(self, channel: int) -> Optional[Fixture]:
        """根据通道号获取灯具"""
        for fixture in self.fixtures:
            if fixture.has_channel(channel):
                return fixture
        return None
    
    def get_modifications_for_cue(self, cue_number: str) -> List[Modification]:
        """获取指定 CUE 的所有修改记录"""
        return [m for m in self.modifications if m.cue_number == cue_number]
    
    def get_issue_by_id(self, issue_id: str) -> Optional[Issue]:
        """根据 ID 获取问题"""
        for issue in self.issues:
            if issue.id == issue_id:
                return issue
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "config": self.config.to_dict() if self.config else None,
            "cues": [c.to_dict() for c in self.cues],
            "fixtures": [f.to_dict() for f in self.fixtures],
            "modifications": [m.to_dict() for m in self.modifications],
            "issues": [i.to_dict() for i in self.issues],
        }
