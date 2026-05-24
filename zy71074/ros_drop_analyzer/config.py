import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import yaml

from .types import SensorType


DEFAULT_THRESHOLDS = {
    SensorType.LIDAR: 0.2,
    SensorType.CAMERA: 0.1,
    SensorType.IMU: 0.01,
}

DEFAULT_EXPECTED_FPS = {
    SensorType.LIDAR: 10.0,
    SensorType.CAMERA: 30.0,
    SensorType.IMU: 200.0,
}

DEFAULT_TOPIC_PATTERNS = {
    SensorType.LIDAR: [
        r"/lidar\d?/pointcloud\d?",
        r"/rslidar_\d+/points",
        r"/velodyne_points",
        r"/cloud",
        r"/points",
    ],
    SensorType.CAMERA: [
        r"/camera\d?/image_raw",
        r"/camera\d?/image_color",
        r"/cam\d+/image",
        r"/image_raw",
    ],
    SensorType.IMU: [
        r"/imu\d?/data",
        r"/imu\d?/imu_raw",
        r"/gx5/imu/data",
        r"/imu",
    ],
}


@dataclass
class AnalyzerConfig:
    input_file: str
    output_dir: str = "./output"
    thresholds: Dict[SensorType, float] = field(
        default_factory=lambda: DEFAULT_THRESHOLDS.copy()
    )
    expected_fps: Dict[SensorType, float] = field(
        default_factory=lambda: DEFAULT_EXPECTED_FPS.copy()
    )
    topic_patterns: Dict[SensorType, List[str]] = field(
        default_factory=lambda: {k: v.copy() for k, v in DEFAULT_TOPIC_PATTERNS.items()}
    )
    topic_aliases: Dict[str, str] = field(default_factory=dict)
    specific_topics: List[str] = field(default_factory=list)
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    export_json: bool = True
    export_markdown: bool = True
    verbose: bool = False
    detect_timestamp_rollback: bool = True
    merge_related_topics: bool = True

    @classmethod
    def from_yaml(cls, config_file: str) -> "AnalyzerConfig":
        with open(config_file, "r") as f:
            data = yaml.safe_load(f)

        config = cls(input_file="")

        if "thresholds" in data:
            for sensor_type, value in data["thresholds"].items():
                config.thresholds[SensorType(sensor_type)] = value

        if "expected_fps" in data:
            for sensor_type, value in data["expected_fps"].items():
                config.expected_fps[SensorType(sensor_type)] = value

        if "topic_patterns" in data:
            for sensor_type, patterns in data["topic_patterns"].items():
                config.topic_patterns[SensorType(sensor_type)] = patterns

        if "topic_aliases" in data:
            config.topic_aliases = data["topic_aliases"]

        if "output_dir" in data:
            config.output_dir = data["output_dir"]

        return config

    def ensure_output_dir(self):
        os.makedirs(self.output_dir, exist_ok=True)
