from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from enum import Enum


class RiskType(Enum):
    """
    风险类型
    """
    HYPOTHERMIA = "低体温"
    HYPOTHERMIA_SEVERE = "严重低体温"
    SPO2_DROP = "血氧掉点"
    SPO2_LOW = "低血氧"
    HYPERTENSION = "高血压"
    HYPOTENSION = "低血压"
    TACHYCARDIA = "心动过速"
    BRADYCARDIA = "心动过缓"
    MEDICATION_OVERDUE = "追加用药超时"
    RECOVERY_SCORE_MISMATCH = "复苏评分不符"
    OTHER = "其他"


class RiskSeverity(Enum):
    """
    风险严重程度
    """
    MILD = "轻度"
    MODERATE = "中度"
    SEVERE = "严重"
    CRITICAL = "危急"


class RiskStatus(Enum):
    """
    风险状态
    """
    PENDING = "待复核"
    CONFIRMED = "已确认"
    DISMISSED = "已驳回"


@dataclass
class RiskSegment:
    """
    风险片段 - 描述一个连续的风险事件时间段
    """
    start_time: datetime
    end_time: datetime
    min_value: Optional[float] = None  # 该时间段内的最小值
    max_value: Optional[float] = None  # 该时间段内的最大值
    avg_value: Optional[float] = None  # 该时间段内的平均值
    trigger_value: Optional[float] = None  # 触发阈值
    parameter: Optional[str] = None  # 相关参数名
    
    def get_duration(self) -> timedelta:
        """
        获取风险持续时间
        """
        return self.end_time - self.start_time
    
    def to_dict(self) -> Dict:
        """
        转换为字典
        """
        return {
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.get_duration().total_seconds(),
            "min_value": self.min_value,
            "max_value": self.max_value,
            "avg_value": self.avg_value,
            "trigger_value": self.trigger_value,
            "parameter": self.parameter
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'RiskSegment':
        """
        从字典创建对象
        """
        start_time = datetime.fromisoformat(data["start_time"]) if data.get("start_time") else None
        end_time = datetime.fromisoformat(data["end_time"]) if data.get("end_time") else None
        
        return cls(
            start_time=start_time,
            end_time=end_time,
            min_value=data.get("min_value"),
            max_value=data.get("max_value"),
            avg_value=data.get("avg_value"),
            trigger_value=data.get("trigger_value"),
            parameter=data.get("parameter")
        )


@dataclass
class Risk:
    """
    风险对象 - 包含风险的完整信息
    """
    risk_id: str
    case_id: str
    risk_type: RiskType
    severity: RiskSeverity
    status: RiskStatus = RiskStatus.PENDING
    segments: List[RiskSegment] = field(default_factory=list)
    description: str = ""
    recommendation: str = ""
    detected_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None
    metadata: Dict = field(default_factory=dict)
    
    def add_segment(self, segment: RiskSegment):
        """
        添加风险片段
        """
        self.segments.append(segment)
    
    def get_total_duration(self) -> timedelta:
        """
        获取总风险持续时间
        """
        total = timedelta()
        for segment in self.segments:
            total += segment.get_duration()
        return total
    
    def confirm(self, reviewer: str = None, notes: str = None):
        """
        确认风险
        """
        self.status = RiskStatus.CONFIRMED
        self.reviewed_at = datetime.now()
        self.reviewed_by = reviewer
        self.review_notes = notes
    
    def dismiss(self, reviewer: str = None, notes: str = None):
        """
        驳回风险
        """
        self.status = RiskStatus.DISMISSED
        self.reviewed_at = datetime.now()
        self.reviewed_by = reviewer
        self.review_notes = notes
    
    def to_dict(self) -> Dict:
        """
        转换为字典
        """
        return {
            "risk_id": self.risk_id,
            "case_id": self.case_id,
            "risk_type": self.risk_type.value,
            "risk_type_code": self.risk_type.name,
            "severity": self.severity.value,
            "severity_code": self.severity.name,
            "status": self.status.value,
            "status_code": self.status.name,
            "description": self.description,
            "recommendation": self.recommendation,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "reviewed_by": self.reviewed_by,
            "review_notes": self.review_notes,
            "segments": [seg.to_dict() for seg in self.segments],
            "total_duration_seconds": self.get_total_duration().total_seconds(),
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Risk':
        """
        从字典创建对象
        """
        # 解析风险类型
        type_code = data.get("risk_type_code", data.get("risk_type", "OTHER"))
        try:
            risk_type = RiskType[type_code]
        except KeyError:
            risk_type = RiskType.OTHER
        
        # 解析严重程度
        severity_code = data.get("severity_code", data.get("severity", "MODERATE"))
        try:
            severity = RiskSeverity[severity_code]
        except KeyError:
            severity = RiskSeverity.MODERATE
        
        # 解析状态
        status_code = data.get("status_code", data.get("status", "PENDING"))
        try:
            status = RiskStatus[status_code]
        except KeyError:
            status = RiskStatus.PENDING
        
        # 解析时间
        detected_at = datetime.fromisoformat(data["detected_at"]) if data.get("detected_at") else None
        reviewed_at = datetime.fromisoformat(data["reviewed_at"]) if data.get("reviewed_at") else None
        
        # 解析片段
        segments = []
        for seg_data in data.get("segments", []):
            segments.append(RiskSegment.from_dict(seg_data))
        
        return cls(
            risk_id=data["risk_id"],
            case_id=data["case_id"],
            risk_type=risk_type,
            severity=severity,
            status=status,
            description=data.get("description", ""),
            recommendation=data.get("recommendation", ""),
            detected_at=detected_at,
            reviewed_at=reviewed_at,
            reviewed_by=data.get("reviewed_by"),
            review_notes=data.get("review_notes"),
            segments=segments,
            metadata=data.get("metadata", {})
        )
