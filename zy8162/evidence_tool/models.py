from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum


class AnomalyType(Enum):
    MISSING_SEGMENT = "missing_segment"
    CLOCK_DRIFT = "clock_drift"
    GPS_JUMP = "gps_jump"
    DUPLICATE_SEGMENT = "duplicate_segment"
    HASH_CONFLICT = "hash_conflict"


class AnomalySeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class VideoSegment:
    filename: str
    file_path: str
    start_time: datetime
    end_time: datetime
    duration: timedelta
    device_id: str
    file_size: int = 0
    sha256_hash: Optional[str] = None
    original_index: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def overlaps_with(self, other: 'VideoSegment') -> bool:
        return self.start_time < other.end_time and self.end_time > other.start_time
    
    def is_adjacent_to(self, other: 'VideoSegment', threshold: timedelta = timedelta(seconds=1)) -> bool:
        gap = abs(self.start_time - other.end_time)
        return gap <= threshold or abs(self.end_time - other.start_time) <= threshold


@dataclass
class GPSPoint:
    timestamp: datetime
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    speed: Optional[float] = None
    satellites: Optional[int] = None
    quality: Optional[str] = None
    raw_data: Optional[str] = None


@dataclass
class ClockCalibration:
    calibration_time: datetime
    device_time: datetime
    reference_time: datetime
    drift_seconds: float
    calibration_type: str = "gps"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Anomaly:
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    timestamp: Optional[datetime] = None
    description: str = ""
    affected_files: List[str] = field(default_factory=list)
    affected_time_range: Optional[tuple] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Timeline:
    start_time: datetime
    end_time: datetime
    video_segments: List[VideoSegment] = field(default_factory=list)
    gps_points: List[GPSPoint] = field(default_factory=list)
    clock_calibrations: List[ClockCalibration] = field(default_factory=list)
    
    def sort_all(self):
        self.video_segments.sort(key=lambda x: x.start_time)
        self.gps_points.sort(key=lambda x: x.timestamp)
        self.clock_calibrations.sort(key=lambda x: x.calibration_time)
        
        if self.video_segments:
            self.start_time = min(self.start_time, self.video_segments[0].start_time)
            self.end_time = max(self.end_time, self.video_segments[-1].end_time)
        
        if self.gps_points:
            self.start_time = min(self.start_time, self.gps_points[0].timestamp)
            self.end_time = max(self.end_time, self.gps_points[-1].timestamp)


@dataclass
class EvidencePackage:
    package_id: str
    generated_at: datetime
    tool_version: str
    source_directory: str
    timeline: Optional[Timeline] = None
    anomalies: List[Anomaly] = field(default_factory=list)
    hash_manifest: Dict[str, str] = field(default_factory=dict)
    file_index: Dict[str, VideoSegment] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
