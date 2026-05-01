from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))


class ImportStatus(Enum):
    PENDING = "待处理"
    PARSING = "解析中"
    VALIDATING = "校验中"
    PARTIAL = "部分成功"
    COMPLETED = "已完成"
    FAILED = "失败"
    CANCELLED = "已取消"
    
    @classmethod
    def from_string(cls, value: str) -> 'ImportStatus':
        value = value.strip()
        mapping = {
            '待处理': cls.PENDING,
            '解析中': cls.PARSING,
            '校验中': cls.VALIDATING,
            '部分成功': cls.PARTIAL,
            '已完成': cls.COMPLETED,
            '失败': cls.FAILED,
            '已取消': cls.CANCELLED,
        }
        return mapping.get(value, cls.PENDING)
    
    def __str__(self) -> str:
        return self.value


@dataclass
class ImportBatch:
    id: Optional[int] = None
    drill_id: Optional[int] = None
    
    file_name: str = ""
    file_path: str = ""
    file_type: str = "csv"
    file_hash: str = ""
    
    source_name: str = ""
    time_offset_seconds: int = 0
    
    status: ImportStatus = ImportStatus.PENDING
    total_records: int = 0
    valid_records: int = 0
    invalid_records: int = 0
    
    error_message: str = ""
    warnings: List[str] = field(default_factory=list)
    
    imported_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    created_by: str = ""
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if isinstance(self.status, str):
            self.status = ImportStatus.from_string(self.status)
        
        date_fields = ['imported_at', 'completed_at']
        for field_name in date_fields:
            value = getattr(self, field_name)
            if isinstance(value, str):
                try:
                    setattr(self, field_name, datetime.fromisoformat(value))
                except (ValueError, TypeError):
                    if field_name == 'imported_at':
                        setattr(self, field_name, datetime.now())
                    else:
                        setattr(self, field_name, None)
        
        if isinstance(self.warnings, str):
            try:
                import json
                self.warnings = json.loads(self.warnings)
            except (ValueError, TypeError):
                self.warnings = []
    
    def to_dict(self) -> Dict[str, Any]:
        def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
            return dt.isoformat() if dt else None
        
        return {
            'id': self.id,
            'drill_id': self.drill_id,
            'file_name': self.file_name,
            'file_path': self.file_path,
            'file_type': self.file_type,
            'file_hash': self.file_hash,
            'source_name': self.source_name,
            'time_offset_seconds': self.time_offset_seconds,
            'status': self.status.value,
            'total_records': self.total_records,
            'valid_records': self.valid_records,
            'invalid_records': self.invalid_records,
            'error_message': self.error_message,
            'warnings': self.warnings,
            'imported_at': serialize_datetime(self.imported_at),
            'completed_at': serialize_datetime(self.completed_at),
            'created_by': self.created_by,
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ImportBatch':
        return cls(
            id=data.get('id'),
            drill_id=data.get('drill_id'),
            file_name=data.get('file_name', ''),
            file_path=data.get('file_path', ''),
            file_type=data.get('file_type', 'csv'),
            file_hash=data.get('file_hash', ''),
            source_name=data.get('source_name', ''),
            time_offset_seconds=data.get('time_offset_seconds', 0),
            status=data.get('status', ImportStatus.PENDING),
            total_records=data.get('total_records', 0),
            valid_records=data.get('valid_records', 0),
            invalid_records=data.get('invalid_records', 0),
            error_message=data.get('error_message', ''),
            warnings=data.get('warnings', []),
            imported_at=data.get('imported_at'),
            completed_at=data.get('completed_at'),
            created_by=data.get('created_by', ''),
            metadata=data.get('metadata', {}),
        )
    
    @property
    def success_rate(self) -> float:
        if self.total_records == 0:
            return 0.0
        return self.valid_records / self.total_records
    
    def __str__(self) -> str:
        return f"ImportBatch: {self.file_name} - {self.status} ({self.valid_records}/{self.total_records} valid)"
