from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class TrackPoint:
    latitude: float
    longitude: float
    elevation: Optional[float] = None
    timestamp: Optional[datetime] = None
    raw_data: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "elevation": self.elevation,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


@dataclass
class TrackSegment:
    points: List[TrackPoint] = field(default_factory=list)
    name: Optional[str] = None

    @property
    def start_time(self) -> Optional[datetime]:
        if not self.points:
            return None
        return next(
            (p.timestamp for p in self.points if p.timestamp),
            None
        )

    @property
    def end_time(self) -> Optional[datetime]:
        if not self.points:
            return None
        return next(
            (p.timestamp for p in reversed(self.points) if p.timestamp),
            None
        )

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "points": [p.to_dict() for p in self.points],
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "point_count": len(self.points),
        }


@dataclass
class Track:
    name: str
    segments: List[TrackSegment] = field(default_factory=list)
    source_file: Optional[str] = None
    source_format: Optional[str] = None

    @property
    def all_points(self) -> List[TrackPoint]:
        points = []
        for segment in self.segments:
            points.extend(segment.points)
        return points

    @property
    def start_time(self) -> Optional[datetime]:
        if not self.segments:
            return None
        return self.segments[0].start_time

    @property
    def end_time(self) -> Optional[datetime]:
        if not self.segments:
            return None
        return self.segments[-1].end_time

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "source_file": self.source_file,
            "source_format": self.source_format,
            "segments": [s.to_dict() for s in self.segments],
            "total_points": len(self.all_points),
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
        }
