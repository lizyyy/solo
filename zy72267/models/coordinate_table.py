from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
import uuid


@dataclass
class CoordinateRecord:
    record_id: str
    original_line_number: int
    point_id: str
    x: float
    y: float
    z: float
    is_supplemented: bool = False
    supplemented_by: str = ""
    supplemented_at: Optional[datetime] = None
    raw_data: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    @classmethod
    def create(cls, original_line_number: int, point_id: str,
               x: float, y: float, z: float, raw_data: str) -> "CoordinateRecord":
        return cls(
            record_id=str(uuid.uuid4()),
            original_line_number=original_line_number,
            point_id=point_id,
            x=x,
            y=y,
            z=z,
            raw_data=raw_data
        )

    @classmethod
    def create_supplemented(cls, point_id: str, x: float, y: float, z: float,
                            supplemented_by: str = "小陶") -> "CoordinateRecord":
        now = datetime.now()
        return cls(
            record_id=str(uuid.uuid4()),
            original_line_number=-1,
            point_id=point_id,
            x=x,
            y=y,
            z=z,
            is_supplemented=True,
            supplemented_by=supplemented_by,
            supplemented_at=now,
            raw_data=f"SUPPLEMENTED:{point_id},{x},{y},{z}"
        )


@dataclass
class CoordinateTable:
    table_id: str
    batch_id: str
    file_name: str
    records: List[CoordinateRecord] = field(default_factory=list)
    imported_at: datetime = field(default_factory=datetime.now)
    imported_by: str = ""

    @classmethod
    def create(cls, file_name: str, batch_id: str,
               imported_by: str = "小陶") -> "CoordinateTable":
        return cls(
            table_id=str(uuid.uuid4()),
            batch_id=batch_id,
            file_name=file_name,
            imported_by=imported_by
        )
