from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
from enum import Enum
import uuid


class OcclusionType(str, Enum):
    SKYLINE = "天际线遮挡"
    BUILDING = "建筑物遮挡"
    OTHER = "其他遮挡"


@dataclass
class OcclusionRecord:
    record_id: str
    point_id: str
    occlusion_type: OcclusionType
    description: str
    is_confirmed: bool = False
    confirmed_by: str = ""
    confirmed_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)

    @classmethod
    def create(cls, point_id: str, occlusion_type: OcclusionType,
               description: str, created_by: str = "小陶") -> "OcclusionRecord":
        return cls(
            record_id=str(uuid.uuid4()),
            point_id=point_id,
            occlusion_type=occlusion_type,
            description=description
        )


@dataclass
class OcclusionList:
    list_id: str
    batch_id: str
    records: List[OcclusionRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""
    updated_at: datetime = field(default_factory=datetime.now)

    @classmethod
    def create(cls, batch_id: str, created_by: str = "小陶") -> "OcclusionList":
        return cls(
            list_id=str(uuid.uuid4()),
            batch_id=batch_id,
            created_by=created_by
        )
