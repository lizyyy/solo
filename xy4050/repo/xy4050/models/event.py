from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum
from .risk_level import RiskLevel


class ReviewTag(Enum):
    CONFIRMED = "已确认"
    SUSPICIOUS = "存疑"
    WRONG = "错误"
    IMPORTANT = "重要"
    MINOR = "次要"
    DUPLICATE = "重复"
    
    @classmethod
    def from_string(cls, value: str) -> Optional['ReviewTag']:
        value = value.strip()
        mapping = {
            '已确认': cls.CONFIRMED,
            '存疑': cls.SUSPICIOUS,
            '错误': cls.WRONG,
            '重要': cls.IMPORTANT,
            '次要': cls.MINOR,
            '重复': cls.DUPLICATE,
        }
        return mapping.get(value)
    
    def __str__(self) -> str:
        return self.value


class MergeStatus(Enum):
    RAW = "原始"
    MERGED = "已合并"
    SPLIT = "已拆分"
    MANUAL = "人工调整"
    
    @classmethod
    def from_string(cls, value: str) -> 'MergeStatus':
        value = value.strip()
        mapping = {
            '原始': cls.RAW,
            '已合并': cls.MERGED,
            '已拆分': cls.SPLIT,
            '人工调整': cls.MANUAL,
        }
        return mapping.get(value, cls.RAW)
    
    def __str__(self) -> str:
        return self.value


@dataclass
class Event:
    id: Optional[int] = None
    drill_id: Optional[int] = None
    import_batch_id: Optional[int] = None
    
    source: str = ""
    original_time_str: str = ""
    original_time: Optional[datetime] = None
    time_offset_seconds: int = 0
    
    area_code: str = ""
    event_type_code: str = ""
    risk_level: RiskLevel = RiskLevel.LOW
    
    description: str = ""
    person_count: Optional[int] = None
    photo_numbers: List[str] = field(default_factory=list)
    notes: str = ""
    
    review_tags: List[str] = field(default_factory=list)
    merge_status: MergeStatus = MergeStatus.RAW
    merged_event_id: Optional[int] = None
    
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)
    
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if isinstance(self.risk_level, str):
            self.risk_level = RiskLevel.from_string(self.risk_level) or RiskLevel.LOW
        
        if isinstance(self.merge_status, str):
            self.merge_status = MergeStatus.from_string(self.merge_status)
        
        if isinstance(self.original_time, str):
            try:
                self.original_time = datetime.fromisoformat(self.original_time)
            except (ValueError, TypeError):
                self.original_time = None
        
        for field_name in ['photo_numbers', 'review_tags', 'validation_errors']:
            value = getattr(self, field_name)
            if isinstance(value, str):
                try:
                    import json
                    setattr(self, field_name, json.loads(value))
                except (ValueError, TypeError):
                    setattr(self, field_name, [])
        
        for field_name in ['created_at', 'updated_at']:
            value = getattr(self, field_name)
            if isinstance(value, str):
                try:
                    setattr(self, field_name, datetime.fromisoformat(value))
                except (ValueError, TypeError):
                    setattr(self, field_name, datetime.now())
    
    @property
    def unified_time(self) -> Optional[datetime]:
        if self.original_time:
            return self.original_time + timedelta(seconds=self.time_offset_seconds)
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
            return dt.isoformat() if dt else None
        
        return {
            'id': self.id,
            'drill_id': self.drill_id,
            'import_batch_id': self.import_batch_id,
            'source': self.source,
            'original_time_str': self.original_time_str,
            'original_time': serialize_datetime(self.original_time),
            'time_offset_seconds': self.time_offset_seconds,
            'area_code': self.area_code,
            'event_type_code': self.event_type_code,
            'risk_level': self.risk_level.value,
            'description': self.description,
            'person_count': self.person_count,
            'photo_numbers': self.photo_numbers,
            'notes': self.notes,
            'review_tags': self.review_tags,
            'merge_status': self.merge_status.value,
            'merged_event_id': self.merged_event_id,
            'is_valid': self.is_valid,
            'validation_errors': self.validation_errors,
            'created_at': serialize_datetime(self.created_at),
            'updated_at': serialize_datetime(self.updated_at),
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Event':
        return cls(
            id=data.get('id'),
            drill_id=data.get('drill_id'),
            import_batch_id=data.get('import_batch_id'),
            source=data.get('source', ''),
            original_time_str=data.get('original_time_str', ''),
            original_time=data.get('original_time'),
            time_offset_seconds=data.get('time_offset_seconds', 0),
            area_code=data.get('area_code', ''),
            event_type_code=data.get('event_type_code', ''),
            risk_level=data.get('risk_level', RiskLevel.LOW),
            description=data.get('description', ''),
            person_count=data.get('person_count'),
            photo_numbers=data.get('photo_numbers', []),
            notes=data.get('notes', ''),
            review_tags=data.get('review_tags', []),
            merge_status=data.get('merge_status', MergeStatus.RAW),
            merged_event_id=data.get('merged_event_id'),
            is_valid=data.get('is_valid', True),
            validation_errors=data.get('validation_errors', []),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            metadata=data.get('metadata', {}),
        )
    
    def __str__(self) -> str:
        time_str = self.unified_time.strftime("%H:%M:%S") if self.unified_time else "未知时间"
        return f"[{time_str}] {self.source}: {self.description} ({self.risk_level})"


@dataclass
class MergedEvent:
    id: Optional[int] = None
    drill_id: Optional[int] = None
    
    unified_time: Optional[datetime] = None
    area_code: str = ""
    event_type_code: str = ""
    risk_level: RiskLevel = RiskLevel.LOW
    
    description: str = ""
    person_count: Optional[int] = None
    photo_numbers: List[str] = field(default_factory=list)
    notes: str = ""
    
    source_event_ids: List[int] = field(default_factory=list)
    sources: List[str] = field(default_factory=list)
    
    review_tags: List[str] = field(default_factory=list)
    is_confirmed: bool = False
    
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if isinstance(self.risk_level, str):
            self.risk_level = RiskLevel.from_string(self.risk_level) or RiskLevel.LOW
        
        if isinstance(self.unified_time, str):
            try:
                self.unified_time = datetime.fromisoformat(self.unified_time)
            except (ValueError, TypeError):
                self.unified_time = None
        
        for field_name in ['photo_numbers', 'review_tags', 'source_event_ids', 'sources']:
            value = getattr(self, field_name)
            if isinstance(value, str):
                try:
                    import json
                    setattr(self, field_name, json.loads(value))
                except (ValueError, TypeError):
                    setattr(self, field_name, [])
        
        for field_name in ['created_at', 'updated_at']:
            value = getattr(self, field_name)
            if isinstance(value, str):
                try:
                    setattr(self, field_name, datetime.fromisoformat(value))
                except (ValueError, TypeError):
                    setattr(self, field_name, datetime.now())
    
    def to_dict(self) -> Dict[str, Any]:
        def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
            return dt.isoformat() if dt else None
        
        return {
            'id': self.id,
            'drill_id': self.drill_id,
            'unified_time': serialize_datetime(self.unified_time),
            'area_code': self.area_code,
            'event_type_code': self.event_type_code,
            'risk_level': self.risk_level.value,
            'description': self.description,
            'person_count': self.person_count,
            'photo_numbers': self.photo_numbers,
            'notes': self.notes,
            'source_event_ids': self.source_event_ids,
            'sources': self.sources,
            'review_tags': self.review_tags,
            'is_confirmed': self.is_confirmed,
            'created_at': serialize_datetime(self.created_at),
            'updated_at': serialize_datetime(self.updated_at),
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MergedEvent':
        return cls(
            id=data.get('id'),
            drill_id=data.get('drill_id'),
            unified_time=data.get('unified_time'),
            area_code=data.get('area_code', ''),
            event_type_code=data.get('event_type_code', ''),
            risk_level=data.get('risk_level', RiskLevel.LOW),
            description=data.get('description', ''),
            person_count=data.get('person_count'),
            photo_numbers=data.get('photo_numbers', []),
            notes=data.get('notes', ''),
            source_event_ids=data.get('source_event_ids', []),
            sources=data.get('sources', []),
            review_tags=data.get('review_tags', []),
            is_confirmed=data.get('is_confirmed', False),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            metadata=data.get('metadata', {}),
        )
    
    def __str__(self) -> str:
        time_str = self.unified_time.strftime("%H:%M:%S") if self.unified_time else "未知时间"
        sources_str = ", ".join(self.sources) if self.sources else "未知来源"
        return f"[{time_str}] {sources_str}: {self.description}"
