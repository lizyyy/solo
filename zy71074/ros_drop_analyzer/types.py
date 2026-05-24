from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Tuple
from datetime import datetime


class SensorType(Enum):
    LIDAR = "lidar"
    CAMERA = "camera"
    IMU = "imu"
    UNKNOWN = "unknown"


class ExitCode(Enum):
    SUCCESS = 0
    INVALID_INPUT = 1
    BAG_READ_ERROR = 2
    ANALYSIS_ERROR = 3
    EXPORT_ERROR = 4
    NO_DATA_FOUND = 5


@dataclass
class TopicMapping:
    sensor_type: SensorType
    original_topics: List[str]
    normalized_name: str


@dataclass
class FrameRecord:
    timestamp: float
    topic: str
    sensor_type: SensorType
    seq: Optional[int] = None
    line_number: Optional[int] = None
    raw_content: Optional[str] = None


@dataclass
class DropGap:
    start_time: float
    end_time: float
    duration: float
    expected_frames: int
    missing_frames: int
    severity: str


@dataclass
class SensorAnalysisResult:
    sensor_name: str
    sensor_type: SensorType
    total_frames: int
    start_time: float
    end_time: float
    duration: float
    expected_fps: float
    actual_fps: float
    frame_drops: List[DropGap] = field(default_factory=list)
    total_drop_duration: float = 0.0
    total_missing_frames: int = 0
    max_gap_duration: float = 0.0
    timestamp_issues: List[Dict] = field(default_factory=list)
    topic_changes: List[Dict] = field(default_factory=list)
    invalid_records: List[Dict] = field(default_factory=list)


@dataclass
class AnalysisReport:
    bag_file: str
    analysis_time: datetime
    start_time: float
    end_time: float
    total_duration: float
    sensors: Dict[str, SensorAnalysisResult] = field(default_factory=dict)
    overall_drop_rate: float = 0.0
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
