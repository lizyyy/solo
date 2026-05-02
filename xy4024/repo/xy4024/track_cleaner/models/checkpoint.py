from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Checkpoint:
    name: str
    latitude: float
    longitude: float
    elevation: Optional[float] = None
    radius_meters: float = 30.0
    planned_time: Optional[datetime] = None
    visited: bool = False
    visited_time: Optional[datetime] = None
    visited_point_index: Optional[int] = None
    distance_to_checkpoint: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "elevation": self.elevation,
            "radius_meters": self.radius_meters,
            "planned_time": self.planned_time.isoformat() if self.planned_time else None,
            "visited": self.visited,
            "visited_time": self.visited_time.isoformat() if self.visited_time else None,
            "distance_to_checkpoint": self.distance_to_checkpoint,
        }
