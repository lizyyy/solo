from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
import uuid


@dataclass
class PhotoPoint:
    point_id: str
    photo_id: str
    x_in_photo: float
    y_in_photo: float
    has_point: bool = True
    marked_by: str = ""
    marked_at: datetime = field(default_factory=datetime.now)
    remark: str = ""

    @classmethod
    def create(cls, point_id: str, photo_id: str,
               x_in_photo: float, y_in_photo: float,
               marked_by: str = "小陶") -> "PhotoPoint":
        return cls(
            point_id=point_id,
            photo_id=photo_id,
            x_in_photo=x_in_photo,
            y_in_photo=y_in_photo,
            marked_by=marked_by
        )
