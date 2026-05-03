from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import Optional, List

from .base import BaseEntity


@dataclass
class Scene(BaseEntity):
    act_number: int = 1
    scene_number: int = 1
    title: str = ""
    description: str = ""
    location: str = ""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: int = 0
    sort_order: int = 0
    notes: str = ""

    def __post_init__(self):
        super().__post_init__()
        if self.duration_minutes == 0 and self.start_time and self.end_time:
            self.duration_minutes = int((self.end_time - self.start_time).total_seconds() / 60)

    @classmethod
    def from_csv_row(cls, row: dict, id_prefix: str = "scene"):
        try:
            act_number = int(row.get("act_number", 1))
        except (ValueError, TypeError):
            act_number = 1

        try:
            scene_number = int(row.get("scene_number", 1))
        except (ValueError, TypeError):
            scene_number = 1

        try:
            duration_minutes = int(row.get("duration_minutes", 0))
        except (ValueError, TypeError):
            duration_minutes = 0

        try:
            sort_order = int(row.get("sort_order", 0))
        except (ValueError, TypeError):
            sort_order = 0

        start_time = None
        end_time = None
        if row.get("start_time"):
            try:
                start_time = datetime.fromisoformat(row.get("start_time"))
            except (ValueError, TypeError):
                pass
        if row.get("end_time"):
            try:
                end_time = datetime.fromisoformat(row.get("end_time"))
            except (ValueError, TypeError):
                pass

        return cls(
            id=row.get("scene_id") or f"{id_prefix}_{act_number}_{scene_number}",
            act_number=act_number,
            scene_number=scene_number,
            title=row.get("title", ""),
            description=row.get("description", ""),
            location=row.get("location", ""),
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration_minutes,
            sort_order=sort_order,
            notes=row.get("notes", ""),
        )

    @property
    def full_title(self) -> str:
        title_parts = [f"第{self.act_number}幕", f"第{self.scene_number}场"]
        if self.title:
            title_parts.append(self.title)
        return " - ".join(title_parts)

    def overlaps_with(self, other: "Scene") -> bool:
        if not self.start_time or not self.end_time:
            return False
        if not other.start_time or not other.end_time:
            return False
        return (self.start_time < other.end_time) and (other.start_time < self.end_time)
