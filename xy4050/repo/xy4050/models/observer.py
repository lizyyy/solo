from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List


@dataclass
class Observer:
    id: Optional[int] = None
    name: str = ""
    code: str = ""
    role: str = ""
    assigned_area_codes: List[str] = field(default_factory=list)
    contact: str = ""
    is_active: bool = True
    time_offset_seconds: int = 0
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
        if isinstance(self.assigned_area_codes, str):
            try:
                import json
                self.assigned_area_codes = json.loads(self.assigned_area_codes)
            except (ValueError, TypeError):
                self.assigned_area_codes = []
    
    def to_dict(self) -> Dict[str, Any]:
        import json
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'role': self.role,
            'assigned_area_codes': self.assigned_area_codes,
            'contact': self.contact,
            'is_active': self.is_active,
            'time_offset_seconds': self.time_offset_seconds,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Observer':
        return cls(
            id=data.get('id'),
            name=data.get('name', ''),
            code=data.get('code', ''),
            role=data.get('role', ''),
            assigned_area_codes=data.get('assigned_area_codes', []),
            contact=data.get('contact', ''),
            is_active=data.get('is_active', True),
            time_offset_seconds=data.get('time_offset_seconds', 0),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            metadata=data.get('metadata', {}),
        )
    
    def __str__(self) -> str:
        return f"{self.name} ({self.code}) - {self.role}"


DEFAULT_OBSERVERS = [
    Observer(name="张观察员", code="OBS_ZHANG", role="楼层观察员", assigned_area_codes=["BUILDING_A"]),
    Observer(name="李观察员", code="OBS_LI", role="楼层观察员", assigned_area_codes=["BUILDING_B", "R&D_BUILDING"]),
    Observer(name="王观察员", code="OBS_WANG", role="楼层观察员", assigned_area_codes=["DORM_1", "DORM_2"]),
    Observer(name="东门岗值班", code="GATE_EAST_OBS", role="门岗观察员", assigned_area_codes=["GATE_EAST"]),
    Observer(name="西门岗值班", code="GATE_WEST_OBS", role="门岗观察员", assigned_area_codes=["GATE_WEST"]),
    Observer(name="刘医生", code="MED_OBS_LIU", role="医务观察员", assigned_area_codes=["MEDICAL"]),
    Observer(name="赵护士", code="MED_OBS_ZHAO", role="医务观察员", assigned_area_codes=["MEDICAL"]),
    Observer(name="监控中心", code="MONITOR_OBS", role="监控观察员", assigned_area_codes=["MONITOR"]),
    Observer(name="集合点A", code="ASSEMBLY_A_OBS", role="集合点观察员", assigned_area_codes=["ASSEMBLY_A"]),
    Observer(name="集合点B", code="ASSEMBLY_B_OBS", role="集合点观察员", assigned_area_codes=["ASSEMBLY_B"]),
]
