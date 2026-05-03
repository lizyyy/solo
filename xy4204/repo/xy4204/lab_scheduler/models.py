"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime, date, time, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum


class RiskLevel(Enum):
    """风险等级"""
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


@dataclass
class Booking:
    """仪器预约记录"""
    id: str
    instrument_id: str
    instrument_name: str
    user_id: str
    user_name: str
    start_time: datetime
    end_time: datetime
    purpose: str = ""
    notes: str = ""
    
    @property
    def duration(self) -> timedelta:
        """预约时长"""
        return self.end_time - self.start_time
    
    @property
    def date(self) -> date:
        """预约日期"""
        return self.start_time.date()
    
    def overlaps_with(self, other: 'Booking') -> bool:
        """检查与另一个预约是否时间重叠"""
        return self.start_time < other.end_time and self.end_time > other.start_time
    
    def is_in_fault_period(self, fault: 'FaultRecord') -> bool:
        """检查预约是否在故障期内"""
        return self.start_time < fault.end_time and self.end_time > fault.start_time


@dataclass
class FaultRecord:
    """临时故障记录"""
    id: str
    instrument_id: str
    instrument_name: str
    start_time: datetime
    end_time: datetime
    description: str
    reported_by: str = ""
    severity: str = "中"


@dataclass
class TimeSlot:
    """时间段"""
    start_time: datetime
    end_time: datetime
    instrument_id: str
    instrument_name: str
    
    @property
    def duration(self) -> timedelta:
        return self.end_time - self.start_time


@dataclass
class RiskIssue:
    """风险问题"""
    issue_type: str
    risk_level: RiskLevel
    description: str
    affected_bookings: List[Booking] = field(default_factory=list)
    affected_faults: List[FaultRecord] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type,
            "risk_level": self.risk_level.value,
            "description": self.description,
            "affected_bookings": [b.id for b in self.affected_bookings],
            "affected_faults": [f.id for f in self.affected_faults],
            "details": self.details
        }


@dataclass
class AnalysisResult:
    """分析结果"""
    bookings: List[Booking] = field(default_factory=list)
    faults: List[FaultRecord] = field(default_factory=list)
    issues: List[RiskIssue] = field(default_factory=list)
    available_slots: List[TimeSlot] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    
    @property
    def has_issues(self) -> bool:
        return len(self.issues) > 0
    
    @property
    def high_risk_count(self) -> int:
        return sum(1 for i in self.issues if i.risk_level == RiskLevel.HIGH)
    
    @property
    def medium_risk_count(self) -> int:
        return sum(1 for i in self.issues if i.risk_level == RiskLevel.MEDIUM)
    
    @property
    def low_risk_count(self) -> int:
        return sum(1 for i in self.issues if i.risk_level == RiskLevel.LOW)
