"""
数据模型定义
包含窑烧曲线复盘台的核心数据结构
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Dict, Optional, Any


class RiskLevel(Enum):
    """风险级别"""
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"
    CRITICAL = "严重"


class RiskType(Enum):
    """风险类型"""
    RATE_EXCEEDED = "升温速率超限"
    INSULATION_INSUFFICIENT = "保温时间不足"
    TEMPERATURE_DIFFERENCE = "层间温差过大"
    BATCH_MISMATCH = "釉料批次不匹配"
    TEMPERATURE_DEVIATION = "温度偏离计划"
    COOLING_RATE = "降温速率异常"
    OTHER = "其他"


class ReviewStatus(Enum):
    """复核状态"""
    PENDING = "待复核"
    CONFIRMED = "已确认"
    DISMISSED = "已忽略"
    RESOLVED = "已解决"


@dataclass
class TemperaturePoint:
    """温度数据点"""
    timestamp: datetime
    temperatures: Dict[str, float]  # 层名 -> 温度
    note: Optional[str] = None
    
    @property
    def avg_temperature(self) -> float:
        """平均温度"""
        if not self.temperatures:
            return 0.0
        return sum(self.temperatures.values()) / len(self.temperatures)
    
    @property
    def max_temperature(self) -> float:
        """最高温度"""
        if not self.temperatures:
            return 0.0
        return max(self.temperatures.values())
    
    @property
    def min_temperature(self) -> float:
        """最低温度"""
        if not self.temperatures:
            return 0.0
        return min(self.temperatures.values())
    
    @property
    def temperature_difference(self) -> float:
        """温差"""
        return self.max_temperature - self.min_temperature


@dataclass
class FiringSegment:
    """烧成计划段"""
    segment_id: str
    name: str
    start_temperature: float
    end_temperature: float
    rate: float  # 升温速率 (°C/hour)
    hold_time: Optional[timedelta] = None  # 保温时间
    description: Optional[str] = None
    
    @property
    def temperature_range(self) -> float:
        """温度范围"""
        return abs(self.end_temperature - self.start_temperature)
    
    @property
    def estimated_duration(self) -> timedelta:
        """预计持续时间"""
        if self.rate <= 0:
            return timedelta(hours=0)
        
        duration_hours = self.temperature_range / self.rate
        total_duration = timedelta(hours=duration_hours)
        
        if self.hold_time:
            total_duration += self.hold_time
        
        return total_duration


@dataclass
class FiringPlan:
    """烧成计划"""
    plan_id: str
    name: str
    description: Optional[str] = None
    segments: List[FiringSegment] = field(default_factory=list)
    created_at: Optional[datetime] = None
    
    @property
    def total_segments(self) -> int:
        """总段数"""
        return len(self.segments)
    
    @property
    def estimated_total_duration(self) -> timedelta:
        """预计总时长"""
        total = timedelta()
        for segment in self.segments:
            total += segment.estimated_duration
        return total
    
    @property
    def max_temperature(self) -> float:
        """最高温度"""
        if not self.segments:
            return 0.0
        return max(seg.end_temperature for seg in self.segments)


@dataclass
class GlazeBatch:
    """釉料批次"""
    batch_id: str
    glaze_name: str
    formula: Optional[str] = None
    quantity: Optional[float] = None
    unit: str = "g"
    created_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    notes: Optional[str] = None
    status: str = "可用"  # 可用, 已用完, 已过期


@dataclass
class WorkPiece:
    """作品"""
    work_id: str
    title: Optional[str] = None
    artist: Optional[str] = None
    glaze_batch_id: Optional[str] = None  # 关联的釉料批次
    shelf_layer: Optional[str] = None  # 放置层位
    notes: Optional[str] = None
    status: str = "待烧成"  # 待烧成, 烧成中, 已完成, 有问题


@dataclass
class Observation:
    """观察备注"""
    observation_id: str
    timestamp: datetime
    content: str
    author: Optional[str] = None
    category: Optional[str] = None  # 升温, 保温, 降温, 其他
    related_work_ids: List[str] = field(default_factory=list)


@dataclass
class Risk:
    """风险/问题"""
    risk_id: str
    risk_type: RiskType
    level: RiskLevel
    title: str
    description: str
    timestamp: Optional[datetime] = None
    related_data: Dict[str, Any] = field(default_factory=dict)
    review_status: ReviewStatus = ReviewStatus.PENDING
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "risk_id": self.risk_id,
            "risk_type": self.risk_type.value,
            "level": self.level.value,
            "title": self.title,
            "description": self.description,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "related_data": self.related_data,
            "review_status": self.review_status.value,
            "review_notes": self.review_notes,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None
        }


@dataclass
class TimelineEvent:
    """时间线事件"""
    event_id: str
    timestamp: datetime
    event_type: str  # temperature_reading, plan_segment, observation, risk
    title: str
    description: Optional[str] = None
    related_objects: Dict[str, List[str]] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FiringRecord:
    """烧成记录 - 整合所有数据的主记录"""
    record_id: str
    name: str
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    # 原始数据
    temperature_data: List[TemperaturePoint] = field(default_factory=list)
    firing_plan: Optional[FiringPlan] = None
    glaze_batches: List[GlazeBatch] = field(default_factory=list)
    work_pieces: List[WorkPiece] = field(default_factory=list)
    observations: List[Observation] = field(default_factory=list)
    
    # 分析结果
    risks: List[Risk] = field(default_factory=list)
    timeline: List[TimelineEvent] = field(default_factory=list)
    
    # 人工复核
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    
    @property
    def start_time(self) -> Optional[datetime]:
        """开始时间"""
        if not self.temperature_data:
            return None
        return min(p.timestamp for p in self.temperature_data)
    
    @property
    def end_time(self) -> Optional[datetime]:
        """结束时间"""
        if not self.temperature_data:
            return None
        return max(p.timestamp for p in self.temperature_data)
    
    @property
    def duration(self) -> Optional[timedelta]:
        """持续时间"""
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return None
    
    @property
    def max_temperature(self) -> float:
        """最高温度"""
        if not self.temperature_data:
            return 0.0
        return max(p.max_temperature for p in self.temperature_data)
    
    @property
    def risk_summary(self) -> Dict[RiskLevel, int]:
        """风险统计"""
        summary = {level: 0 for level in RiskLevel}
        for risk in self.risks:
            summary[risk.level] += 1
        return summary
    
    def get_risks_by_type(self, risk_type: RiskType) -> List[Risk]:
        """按类型获取风险"""
        return [r for r in self.risks if r.risk_type == risk_type]
    
    def get_pending_risks(self) -> List[Risk]:
        """获取待复核的风险"""
        return [r for r in self.risks if r.review_status == ReviewStatus.PENDING]
    
    def get_work_by_id(self, work_id: str) -> Optional[WorkPiece]:
        """根据ID获取作品"""
        for work in self.work_pieces:
            if work.work_id == work_id:
                return work
        return None
    
    def get_glaze_batch_by_id(self, batch_id: str) -> Optional[GlazeBatch]:
        """根据ID获取釉料批次"""
        for batch in self.glaze_batches:
            if batch.batch_id == batch_id:
                return batch
        return None
