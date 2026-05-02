from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass
class Area:
    id: Optional[int] = None
    name: str = ""
    code: str = ""
    description: str = ""
    parent_id: Optional[int] = None
    sort_order: int = 0
    is_active: bool = True
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
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'parent_id': self.parent_id,
            'sort_order': self.sort_order,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Area':
        return cls(
            id=data.get('id'),
            name=data.get('name', ''),
            code=data.get('code', ''),
            description=data.get('description', ''),
            parent_id=data.get('parent_id'),
            sort_order=data.get('sort_order', 0),
            is_active=data.get('is_active', True),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            metadata=data.get('metadata', {}),
        )
    
    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


DEFAULT_AREAS = [
    Area(name="办公楼A座", code="BUILDING_A", description="主办公楼A座", sort_order=1),
    Area(name="办公楼B座", code="BUILDING_B", description="办公楼B座", sort_order=2),
    Area(name="研发楼", code="R&D_BUILDING", description="研发中心大楼", sort_order=3),
    Area(name="食堂", code="CANTEEN", description="员工食堂", sort_order=4),
    Area(name="宿舍1号楼", code="DORM_1", description="员工宿舍1号楼", sort_order=5),
    Area(name="宿舍2号楼", code="DORM_2", description="员工宿舍2号楼", sort_order=6),
    Area(name="地下停车场", code="PARKING_B1", description="地下一层停车场", sort_order=7),
    Area(name="东门岗", code="GATE_EAST", description="园区东门岗亭", sort_order=8),
    Area(name="西门岗", code="GATE_WEST", description="园区西门岗亭", sort_order=9),
    Area(name="北门岗", code="GATE_NORTH", description="园区北门岗亭", sort_order=10),
    Area(name="南门岗", code="GATE_SOUTH", description="园区南门岗亭", sort_order=11),
    Area(name="医疗点", code="MEDICAL", description="园区医疗急救点", sort_order=12),
    Area(name="集合点A", code="ASSEMBLY_A", description="疏散集合点A - 园区广场", sort_order=13),
    Area(name="集合点B", code="ASSEMBLY_B", description="疏散集合点B - 停车场西侧", sort_order=14),
    Area(name="监控中心", code="MONITOR", description="园区监控指挥中心", sort_order=15),
    Area(name="其他区域", code="OTHER", description="其他未定义区域", sort_order=99),
]
