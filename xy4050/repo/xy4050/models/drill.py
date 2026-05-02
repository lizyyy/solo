from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum


class DrillStatus(Enum):
    DRAFT = "草稿"
    IMPORTING = "导入中"
    MERGING = "合并中"
    REVIEWING = "复盘中"
    COMPLETED = "已完成"
    ARCHIVED = "已归档"
    
    @classmethod
    def from_string(cls, value: str) -> 'DrillStatus':
        value = value.strip()
        mapping = {
            '草稿': cls.DRAFT,
            '导入中': cls.IMPORTING,
            '合并中': cls.MERGING,
            '复盘中': cls.REVIEWING,
            '已完成': cls.COMPLETED,
            '已归档': cls.ARCHIVED,
        }
        return mapping.get(value, cls.DRAFT)
    
    def __str__(self) -> str:
        return self.value


@dataclass
class Drill:
    id: Optional[int] = None
    name: str = ""
    code: str = ""
    drill_type: str = ""
    description: str = ""
    planned_start_time: Optional[datetime] = None
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    status: DrillStatus = DrillStatus.DRAFT
    standard_timeline_code: str = ""
    area_codes: List[str] = field(default_factory=list)
    observer_codes: List[str] = field(default_factory=list)
    event_type_codes: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if isinstance(self.status, str):
            self.status = DrillStatus.from_string(self.status)
        
        date_fields = [
            'planned_start_time',
            'actual_start_time',
            'actual_end_time',
            'created_at',
            'updated_at',
        ]
        for field_name in date_fields:
            value = getattr(self, field_name)
            if isinstance(value, str):
                try:
                    setattr(self, field_name, datetime.fromisoformat(value))
                except (ValueError, TypeError):
                    setattr(self, field_name, None)
        
        for field_name in ['area_codes', 'observer_codes', 'event_type_codes']:
            value = getattr(self, field_name)
            if isinstance(value, str):
                try:
                    import json
                    setattr(self, field_name, json.loads(value))
                except (ValueError, TypeError):
                    setattr(self, field_name, [])
    
    def to_dict(self) -> Dict[str, Any]:
        def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
            return dt.isoformat() if dt else None
        
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'drill_type': self.drill_type,
            'description': self.description,
            'planned_start_time': serialize_datetime(self.planned_start_time),
            'actual_start_time': serialize_datetime(self.actual_start_time),
            'actual_end_time': serialize_datetime(self.actual_end_time),
            'status': self.status.value,
            'standard_timeline_code': self.standard_timeline_code,
            'area_codes': self.area_codes,
            'observer_codes': self.observer_codes,
            'event_type_codes': self.event_type_codes,
            'created_at': serialize_datetime(self.created_at),
            'updated_at': serialize_datetime(self.updated_at),
            'created_by': self.created_by,
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Drill':
        return cls(
            id=data.get('id'),
            name=data.get('name', ''),
            code=data.get('code', ''),
            drill_type=data.get('drill_type', ''),
            description=data.get('description', ''),
            planned_start_time=data.get('planned_start_time'),
            actual_start_time=data.get('actual_start_time'),
            actual_end_time=data.get('actual_end_time'),
            status=data.get('status', DrillStatus.DRAFT),
            standard_timeline_code=data.get('standard_timeline_code', ''),
            area_codes=data.get('area_codes', []),
            observer_codes=data.get('observer_codes', []),
            event_type_codes=data.get('event_type_codes', []),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            created_by=data.get('created_by', ''),
            metadata=data.get('metadata', {}),
        )
    
    def __str__(self) -> str:
        return f"{self.name} ({self.code}) - {self.status}"
