from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Optional, List

from .geo import Point


class IssueType(Enum):
    GAP = "gap"
    OVERLAP = "overlap"
    SPEED_SPIKE = "speed_spike"
    OUT_OF_ORDER = "out_of_order"
    NO_DATA = "no_data"
    EXCLUDED_ZONE = "excluded_zone"


class IssueSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SurveyLine:
    line_id: str
    start_point: Point
    end_point: Point
    planned_swath_left: float = 0.0
    planned_swath_right: float = 0.0
    planned_speed: float = 0.0
    priority: int = 1
    notes: str = ""
    
    def bearing(self) -> float:
        from .geo import bearing
        return bearing(self.start_point, self.end_point)
    
    def length(self) -> float:
        from .geo import haversine_distance
        return haversine_distance(self.start_point, self.end_point)


@dataclass
class TrackPoint:
    timestamp: datetime
    point: Point
    speed: float = 0.0
    heading: float = 0.0
    depth: float = 0.0
    source: str = ""
    
    def time_diff_seconds(self, other: 'TrackPoint') -> float:
        from .time_utils import time_diff_seconds
        return time_diff_seconds(self.timestamp, other.timestamp)


@dataclass
class SonarParameters:
    frequency: float = 100.0
    swath_width_left: float = 100.0
    swath_width_right: float = 100.0
    range_scale: float = 100.0
    tvg: float = 0.0
    gain: float = 0.0
    unit: str = "meters"
    along_track_resolution: float = 0.5
    across_track_resolution: float = 0.1
    
    def total_swath_width(self) -> float:
        return self.swath_width_left + self.swath_width_right


@dataclass
class ExclusionZone:
    zone_id: str
    name: str
    polygon: List[Point]
    reason: str = ""
    priority: int = 1


@dataclass
class CoverageSegment:
    segment_id: str
    survey_line: SurveyLine
    track_points: List[TrackPoint] = field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    actual_swath_left: float = 0.0
    actual_swath_right: float = 0.0
    avg_speed: float = 0.0
    coverage_percentage: float = 0.0
    status: str = "unknown"
    
    def length(self) -> float:
        if not self.track_points:
            return 0.0
        from .geo import haversine_distance
        total = 0.0
        for i in range(1, len(self.track_points)):
            total += haversine_distance(
                self.track_points[i-1].point,
                self.track_points[i].point
            )
        return total


@dataclass
class Issue:
    issue_id: str
    issue_type: IssueType
    severity: IssueSeverity
    description: str
    location: Optional[Point] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    related_line: Optional[str] = None
    related_track_index: List[int] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)
    
    def to_csv_row(self) -> dict:
        return {
            "issue_id": self.issue_id,
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "description": self.description,
            "latitude": self.location.lat if self.location else "",
            "longitude": self.location.lon if self.location else "",
            "start_time": self.start_time.isoformat() if self.start_time else "",
            "end_time": self.end_time.isoformat() if self.end_time else "",
            "related_line": self.related_line or "",
            "track_indices": ",".join(str(i) for i in self.related_track_index),
            "metrics": str(self.metrics),
        }
