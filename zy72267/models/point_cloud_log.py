from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
import uuid


@dataclass
class PointCloudLogRecord:
    record_id: str
    original_line_number: int
    point_id: str
    x: float
    y: float
    z: float
    raw_data: str
    is_manually_modified: bool = False
    original_x: Optional[float] = None
    original_y: Optional[float] = None
    original_z: Optional[float] = None
    import_batch_id: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    @classmethod
    def create(cls, original_line_number: int, point_id: str,
               x: float, y: float, z: float, raw_data: str,
               import_batch_id: str) -> "PointCloudLogRecord":
        return cls(
            record_id=str(uuid.uuid4()),
            original_line_number=original_line_number,
            point_id=point_id,
            x=x,
            y=y,
            z=z,
            raw_data=raw_data,
            import_batch_id=import_batch_id
        )


@dataclass
class PointCloudLog:
    log_id: str
    batch_id: str
    file_name: str
    records: List[PointCloudLogRecord] = field(default_factory=list)
    imported_at: datetime = field(default_factory=datetime.now)
    imported_by: str = ""
    is_duplicate: bool = False
    duplicate_of_batch: Optional[str] = None
    checksum: str = ""

    @classmethod
    def create(cls, file_name: str, imported_by: str = "小陶") -> "PointCloudLog":
        batch_id = f"PC-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        return cls(
            log_id=str(uuid.uuid4()),
            batch_id=batch_id,
            file_name=file_name,
            imported_by=imported_by
        )
