"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from uuid import UUID


class ConflictType(Enum):
    ID_COLLISION = "样本编号撞车"
    COORDINATE_DRIFT = "经纬度漂移"
    TIME_OUT_OF_ORDER = "采样时间倒序"
    PHOTO_MISSING = "照片漏关联"
    MODIFIED_OVERWRITE = "后改记录被覆盖"
    FIELD_MISMATCH = "字段不一致"


class ReviewDecision(Enum):
    KEEP_FIRST = "保留先到记录"
    KEEP_LAST = "保留后改记录"
    KEEP_SPECIFIC = "保留指定记录"
    CREATE_NEW = "创建新记录"
    MARK_DUPLICATE = "标记为重复"


class ValidationStatus(Enum):
    VALID = "有效"
    INVALID = "无效"
    WARNING = "警告"


@dataclass
class GeoSample:
    sample_id: str
    latitude: float
    longitude: float
    sample_time: datetime
    collector: str
    photo_paths: List[str] = field(default_factory=list)
    rock_type: Optional[str] = None
    description: Optional[str] = None
    depth: Optional[float] = None
    hash_value: str = ""
    package_name: str = ""
    create_time: Optional[datetime] = None
    modify_time: Optional[datetime] = None
    custom_fields: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "sample_id": self.sample_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "sample_time": self.sample_time.isoformat() if self.sample_time else None,
            "collector": self.collector,
            "photo_paths": self.photo_paths,
            "rock_type": self.rock_type,
            "description": self.description,
            "depth": self.depth,
            "hash_value": self.hash_value,
            "package_name": self.package_name,
            "create_time": self.create_time.isoformat() if self.create_time else None,
            "modify_time": self.modify_time.isoformat() if self.modify_time else None,
            "custom_fields": self.custom_fields,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "GeoSample":
        sample = cls(
            sample_id=data["sample_id"],
            latitude=data["latitude"],
            longitude=data["longitude"],
            sample_time=datetime.fromisoformat(data["sample_time"]) if data.get("sample_time") else None,
            collector=data["collector"],
            photo_paths=data.get("photo_paths", []),
            rock_type=data.get("rock_type"),
            description=data.get("description"),
            depth=data.get("depth"),
            hash_value=data.get("hash_value", ""),
            package_name=data.get("package_name", ""),
            create_time=datetime.fromisoformat(data["create_time"]) if data.get("create_time") else None,
            modify_time=datetime.fromisoformat(data["modify_time"]) if data.get("modify_time") else None,
            custom_fields=data.get("custom_fields", {}),
        )
        return sample


@dataclass
class PackageInfo:
    name: str
    path: str
    format: str
    checksum: str = ""
    file_count: int = 0
    sample_count: int = 0
    created_at: Optional[datetime] = None
    source_device: str = ""
    collector: str = ""


@dataclass
class ConflictRecord:
    conflict_id: str
    conflict_type: ConflictType
    samples: List[GeoSample]
    description: str
    is_resolved: bool = False
    decision: Optional[ReviewDecision] = None
    resolved_at: Optional[datetime] = None
    resolved_by: str = ""
    notes: str = ""

    def to_dict(self) -> Dict:
        return {
            "conflict_id": self.conflict_id,
            "conflict_type": self.conflict_type.value,
            "samples": [s.to_dict() for s in self.samples],
            "description": self.description,
            "is_resolved": self.is_resolved,
            "decision": self.decision.value if self.decision else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolved_by": self.resolved_by,
            "notes": self.notes,
        }


@dataclass
class ValidationResult:
    sample_id: str
    status: ValidationStatus
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class AuditRecord:
    action: str
    timestamp: datetime
    user: str
    details: Dict[str, Any]
    before_state: Optional[Dict] = None
    after_state: Optional[Dict] = None


@dataclass
class MergeResult:
    total_packages: int = 0
    total_samples: int = 0
    merged_samples: int = 0
    conflicts_found: int = 0
    conflicts_resolved: int = 0
    conflicts_pending: int = 0
    photos_linked: int = 0
    photos_missing: int = 0
    warnings: int = 0
    errors: int = 0
    final_sample_count: int = 0
