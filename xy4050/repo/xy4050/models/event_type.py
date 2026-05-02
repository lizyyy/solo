from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any
from .risk_level import RiskLevel


@dataclass
class EventType:
    id: Optional[int] = None
    name: str = ""
    code: str = ""
    description: str = ""
    default_risk_level: RiskLevel = RiskLevel.LOW
    is_key_node: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if isinstance(self.default_risk_level, str):
            self.default_risk_level = RiskLevel.from_string(self.default_risk_level) or RiskLevel.LOW
        if isinstance(self.created_at, str):
            try:
                self.created_at = datetime.fromisoformat(self.created_at)
            except (ValueError, TypeError):
                self.created_at = datetime.now()
        if isinstance(self.updated_at, str):
            try:
                self.updated_at = datetime.fromisoformat(self.updated_at)
            except (ValueError, TypeError):
                self.updated_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'default_risk_level': self.default_risk_level.value,
            'is_key_node': self.is_key_node,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EventType':
        return cls(
            id=data.get('id'),
            name=data.get('name', ''),
            code=data.get('code', ''),
            description=data.get('description', ''),
            default_risk_level=data.get('default_risk_level', RiskLevel.LOW),
            is_key_node=data.get('is_key_node', False),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            metadata=data.get('metadata', {}),
        )
    
    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


DEFAULT_EVENT_TYPES = [
    EventType(name="报警响起", code="ALARM_START", description="演练开始，报警信号发出", is_key_node=True, default_risk_level=RiskLevel.HIGH),
    EventType(name="开始疏散", code="EVAC_START", description="区域人员开始疏散", is_key_node=True, default_risk_level=RiskLevel.MEDIUM),
    EventType(name="完成疏散", code="EVAC_COMPLETE", description="区域人员疏散完成", is_key_node=True, default_risk_level=RiskLevel.LOW),
    EventType(name="通道拥堵", code="CONGESTION", description="疏散通道出现拥堵", default_risk_level=RiskLevel.HIGH),
    EventType(name="人员折返", code="TURN_BACK", description="人员返回原区域", default_risk_level=RiskLevel.HIGH),
    EventType(name="发现伤员", code="CASUALTY_FOUND", description="发现需要救助的伤员", default_risk_level=RiskLevel.CRITICAL),
    EventType(name="伤员处置", code="CASUALTY_TREAT", description="伤员得到医疗处置", default_risk_level=RiskLevel.MEDIUM),
    EventType(name="伤员转移", code="CASUALTY_TRANSFER", description="伤员转移至安全区域", default_risk_level=RiskLevel.MEDIUM),
    EventType(name="集合点到达", code="ASSEMBLY_ARRIVE", description="人员到达集合点", default_risk_level=RiskLevel.LOW),
    EventType(name="集合点清点", code="ASSEMBLY_COUNT", description="集合点人员清点", is_key_node=True, default_risk_level=RiskLevel.LOW),
    EventType(name="演练结束", code="DRILL_END", description="演练正式结束", is_key_node=True, default_risk_level=RiskLevel.LOW),
    EventType(name="设备故障", code="EQUIPMENT_FAIL", description="消防设备或通讯设备故障", default_risk_level=RiskLevel.HIGH),
    EventType(name="通讯中断", code="COMM_FAIL", description="通讯联系中断", default_risk_level=RiskLevel.HIGH),
    EventType(name="人员失联", code="PERSON_MISSING", description="发现人员失联", default_risk_level=RiskLevel.CRITICAL),
    EventType(name="二次报警", code="ALARM_SECONDARY", description="二次报警或误报", default_risk_level=RiskLevel.MEDIUM),
    EventType(name="其他事件", code="OTHER", description="其他未分类事件", default_risk_level=RiskLevel.LOW),
]
