from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
import json

from pydantic import BaseModel, Field, field_validator
from .exceptions import ConfigurationError


class MaterialType(str, Enum):
    PHOTO = "photo"
    VIDEO = "video"
    LOG_CSV = "log_csv"
    PLAN_JSON = "plan_json"
    DELIVERY_LIST = "delivery_list"


class ValidationRule(str, Enum):
    DELIVERY_MISSING = "delivery_missing"
    TIME_MISALIGNMENT = "time_misalignment"
    COORDINATE_DEVIATION = "coordinate_deviation"
    DUPLICATE_ARCHIVE = "duplicate_archive"
    MISSING_METADATA = "missing_metadata"
    NO_FLY_ZONE = "no_fly_zone"


class NoFlyZone(BaseModel):
    name: str
    center_lat: float
    center_lon: float
    radius_meters: float = Field(default=1000.0)


class ProjectConfig(BaseModel):
    project_name: str
    project_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    version: str = "1.0.0"

    directories: Dict[str, str] = Field(
        default_factory=lambda: {
            "photos": "photos",
            "videos": "videos",
            "logs": "logs",
            "plans": "plans",
            "delivery_lists": "delivery_lists",
            "output": "output",
            "quarantine": "quarantine",
            "reports": "reports",
            "metadata": "metadata",
        }
    )

    material_extensions: Dict[MaterialType, Set[str]] = Field(
        default_factory=lambda: {
            MaterialType.PHOTO: {".jpg", ".jpeg", ".png", ".raw", ".dng", ".tiff"},
            MaterialType.VIDEO: {".mp4", ".mov", ".avi", ".mkv", ".m4v"},
            MaterialType.LOG_CSV: {".csv"},
            MaterialType.PLAN_JSON: {".json"},
            MaterialType.DELIVERY_LIST: {".csv", ".txt", ".xlsx"},
        }
    )

    enabled_rules: List[ValidationRule] = Field(
        default_factory=lambda: [
            ValidationRule.DELIVERY_MISSING,
            ValidationRule.TIME_MISALIGNMENT,
            ValidationRule.COORDINATE_DEVIATION,
            ValidationRule.DUPLICATE_ARCHIVE,
            ValidationRule.MISSING_METADATA,
            ValidationRule.NO_FLY_ZONE,
        ]
    )

    time_sync_threshold_seconds: float = Field(default=300.0)
    coordinate_deviation_threshold_meters: float = Field(default=50.0)
    no_fly_zones: List[NoFlyZone] = Field(default_factory=list)

    metadata_required_fields: List[str] = Field(
        default_factory=lambda: [
            "latitude",
            "longitude",
            "capture_time",
            "device_model",
        ]
    )

    delivery_list_columns: Dict[str, str] = Field(
        default_factory=lambda: {
            "filename": "文件名",
            "shooting_time": "拍摄时间",
            "location": "地点",
            "notes": "备注",
        }
    )

    drone_models: List[str] = Field(
        default_factory=lambda: [
            "DJI Mini 3",
            "DJI Mini 3 Pro",
            "DJI Mavic 3",
            "DJI Mavic 3 Pro",
            "DJI Air 3",
            "DJI Air 2S",
            "DJI Inspire 3",
            "DJI Phantom 4",
            "DJI Matrice 300",
            "DJI Matrice 350",
        ]
    )

    @field_validator("time_sync_threshold_seconds")
    @classmethod
    def validate_time_threshold(cls, v: float) -> float:
        if v < 0:
            raise ValueError("时间同步阈值不能为负数")
        return v

    @field_validator("coordinate_deviation_threshold_meters")
    @classmethod
    def validate_coordinate_threshold(cls, v: float) -> float:
        if v < 0:
            raise ValueError("坐标偏离阈值不能为负数")
        return v

    def get_directory(self, key: str) -> str:
        if key not in self.directories:
            raise ConfigurationError(f"未定义的目录类型: {key}", field=key)
        return self.directories[key]

    def is_rule_enabled(self, rule: ValidationRule) -> bool:
        return rule in self.enabled_rules

    def get_extensions_for_type(self, material_type: MaterialType) -> Set[str]:
        if material_type not in self.material_extensions:
            return set()
        return self.material_extensions[material_type]

    def to_json(self, indent: int = 2) -> str:
        class DateTimeEncoder(json.JSONEncoder):
            def default(self, obj: Any) -> Any:
                if isinstance(obj, datetime):
                    return obj.isoformat()
                if isinstance(obj, Enum):
                    return obj.value
                if isinstance(obj, set):
                    return list(obj)
                return super().default(obj)

        return json.dumps(self.model_dump(), cls=DateTimeEncoder, indent=indent, ensure_ascii=False)

    @classmethod
    def from_json(cls, json_str: str) -> "ProjectConfig":
        data = json.loads(json_str)
        return cls.model_validate(data)

    @classmethod
    def load_from_file(cls, config_path: Path) -> "ProjectConfig":
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                content = f.read()
            return cls.from_json(content)
        except FileNotFoundError:
            raise ConfigurationError(f"配置文件不存在: {config_path}", field="config_path")
        except json.JSONDecodeError as e:
            raise ConfigurationError(f"配置文件格式错误: {e}", field="json_format")

    def save_to_file(self, config_path: Path) -> None:
        try:
            with open(config_path, "w", encoding="utf-8") as f:
                f.write(self.to_json())
        except IOError as e:
            raise ConfigurationError(f"保存配置文件失败: {e}", field="save")


class MaterialMetadata(BaseModel):
    file_path: str
    file_name: str
    material_type: MaterialType
    file_size_bytes: int
    hash_sha256: str

    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude_meters: Optional[float] = None

    capture_time: Optional[datetime] = None
    device_model: Optional[str] = None
    serial_number: Optional[str] = None

    gimbal_yaw: Optional[float] = None
    gimbal_pitch: Optional[float] = None
    gimbal_roll: Optional[float] = None

    camera_focal_length: Optional[float] = None
    camera_aperture: Optional[float] = None
    camera_iso: Optional[int] = None
    camera_shutter_speed: Optional[str] = None

    video_resolution: Optional[str] = None
    video_frame_rate: Optional[float] = None
    video_duration_seconds: Optional[float] = None

    flight_line: Optional[int] = None
    waypoint_number: Optional[int] = None

    custom_metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-90 <= v <= 90):
            raise ValueError(f"无效的纬度值: {v}")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-180 <= v <= 180):
            raise ValueError(f"无效的经度值: {v}")
        return v

    def get_coordinates(self) -> Optional[tuple]:
        if self.latitude is not None and self.longitude is not None:
            return (self.latitude, self.longitude)
        return None

    def is_valid_geolocation(self) -> bool:
        return self.latitude is not None and self.longitude is not None


class FlightLogEntry(BaseModel):
    timestamp: datetime
    latitude: float
    longitude: float
    altitude_meters: Optional[float] = None

    velocity_x: Optional[float] = None
    velocity_y: Optional[float] = None
    velocity_z: Optional[float] = None

    gimbal_yaw: Optional[float] = None
    gimbal_pitch: Optional[float] = None
    gimbal_roll: Optional[float] = None

    battery_percentage: Optional[float] = None
    satellite_count: Optional[int] = None

    flight_mode: Optional[str] = None
    flight_line: Optional[int] = None
    waypoint_number: Optional[int] = None


class WaypointPlanEntry(BaseModel):
    waypoint_id: int
    latitude: float
    longitude: float
    altitude_meters: float

    gimbal_pitch: Optional[float] = None
    gimbal_yaw: Optional[float] = None

    speed_mps: Optional[float] = None
    hold_time_seconds: Optional[float] = None
    action_type: Optional[str] = None

    flight_line: Optional[int] = None


class DeliveryListItem(BaseModel):
    file_name: str
    shooting_time: Optional[datetime] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    is_delivered: bool = False
    validation_status: str = "pending"


class ValidationResult(BaseModel):
    material_metadata: MaterialMetadata
    rule_name: ValidationRule
    is_valid: bool
    message: str
    severity: str = "warning"
    details: Dict[str, Any] = Field(default_factory=dict)
    validated_at: datetime = Field(default_factory=datetime.now)


class CheckReport(BaseModel):
    project_id: str
    report_id: str
    generated_at: datetime = Field(default_factory=datetime.now)

    total_materials: int = 0
    valid_materials: int = 0
    invalid_materials: int = 0
    quarantined_materials: int = 0

    validation_results: List[ValidationResult] = Field(default_factory=list)
    stats_by_rule: Dict[ValidationRule, Dict[str, int]] = Field(default_factory=dict)

    notes: List[str] = Field(default_factory=list)
