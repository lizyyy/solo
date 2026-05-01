from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from .event_type import EventType


@dataclass
class TimelineNode:
    id: Optional[int] = None
    event_type_code: str = ""
    expected_offset_seconds: int = 0
    description: str = ""
    is_required: bool = True
    sort_order: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'event_type_code': self.event_type_code,
            'expected_offset_seconds': self.expected_offset_seconds,
            'description': self.description,
            'is_required': self.is_required,
            'sort_order': self.sort_order,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TimelineNode':
        return cls(
            id=data.get('id'),
            event_type_code=data.get('event_type_code', ''),
            expected_offset_seconds=data.get('expected_offset_seconds', 0),
            description=data.get('description', ''),
            is_required=data.get('is_required', True),
            sort_order=data.get('sort_order', 0),
        )


@dataclass
class StandardTimeline:
    id: Optional[int] = None
    name: str = ""
    code: str = ""
    description: str = ""
    drill_type: str = ""
    nodes: List[TimelineNode] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
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
        if self.nodes and isinstance(self.nodes[0], dict):
            self.nodes = [TimelineNode.from_dict(node) for node in self.nodes]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'drill_type': self.drill_type,
            'nodes': [node.to_dict() for node in self.nodes],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'StandardTimeline':
        return cls(
            id=data.get('id'),
            name=data.get('name', ''),
            code=data.get('code', ''),
            description=data.get('description', ''),
            drill_type=data.get('drill_type', ''),
            nodes=data.get('nodes', []),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            metadata=data.get('metadata', {}),
        )
    
    def __str__(self) -> str:
        return f"{self.name} ({self.drill_type})"


DEFAULT_STANDARD_TIMELINES = [
    StandardTimeline(
        name="消防疏散标准时间轴",
        code="FIRE_EVAC",
        drill_type="消防疏散",
        description="标准消防疏散演练时间轴模板",
        nodes=[
            TimelineNode(event_type_code="ALARM_START", expected_offset_seconds=0, description="报警响起", is_required=True, sort_order=1),
            TimelineNode(event_type_code="EVAC_START", expected_offset_seconds=60, description="开始疏散", is_required=True, sort_order=2),
            TimelineNode(event_type_code="EVAC_COMPLETE", expected_offset_seconds=300, description="完成疏散", is_required=True, sort_order=3),
            TimelineNode(event_type_code="ASSEMBLY_ARRIVE", expected_offset_seconds=360, description="到达集合点", is_required=True, sort_order=4),
            TimelineNode(event_type_code="ASSEMBLY_COUNT", expected_offset_seconds=480, description="集合点清点", is_required=True, sort_order=5),
            TimelineNode(event_type_code="DRILL_END", expected_offset_seconds=600, description="演练结束", is_required=True, sort_order=6),
        ]
    ),
    StandardTimeline(
        name="反恐演练标准时间轴",
        code="ANTI_TERROR",
        drill_type="反恐演练",
        description="反恐应急演练时间轴模板",
        nodes=[
            TimelineNode(event_type_code="ALARM_START", expected_offset_seconds=0, description="警情通报", is_required=True, sort_order=1),
            TimelineNode(event_type_code="EVAC_START", expected_offset_seconds=120, description="开始疏散", is_required=True, sort_order=2),
            TimelineNode(event_type_code="ASSEMBLY_ARRIVE", expected_offset_seconds=300, description="到达集合点", is_required=True, sort_order=3),
            TimelineNode(event_type_code="ASSEMBLY_COUNT", expected_offset_seconds=420, description="集合点清点", is_required=True, sort_order=4),
            TimelineNode(event_type_code="DRILL_END", expected_offset_seconds=600, description="演练结束", is_required=True, sort_order=5),
        ]
    ),
    StandardTimeline(
        name="医疗救援标准时间轴",
        code="MEDICAL_RESCUE",
        drill_type="医疗救援",
        description="医疗救援演练时间轴模板",
        nodes=[
            TimelineNode(event_type_code="ALARM_START", expected_offset_seconds=0, description="伤员发现", is_required=True, sort_order=1),
            TimelineNode(event_type_code="CASUALTY_FOUND", expected_offset_seconds=30, description="报告伤情", is_required=True, sort_order=2),
            TimelineNode(event_type_code="CASUALTY_TREAT", expected_offset_seconds=120, description="现场处置", is_required=True, sort_order=3),
            TimelineNode(event_type_code="CASUALTY_TRANSFER", expected_offset_seconds=300, description="伤员转移", is_required=True, sort_order=4),
            TimelineNode(event_type_code="DRILL_END", expected_offset_seconds=600, description="演练结束", is_required=True, sort_order=5),
        ]
    ),
]
