from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class SensorType(str, Enum):
    STRAIN_GAUGE = "strain_gauge"
    DISPLACEMENT_METER = "displacement_meter"
    TEMPERATURE_SENSOR = "temperature_sensor"


class Unit(str, Enum):
    MICROSTRAIN = "microstrain"
    MILLIMETER = "mm"
    METER = "m"
    CELSIUS = "celsius"
    FAHRENHEIT = "fahrenheit"
    NEWTON = "N"
    KILONEWTON = "kN"
    MEGAPASCAL = "MPa"


class Sensor(BaseModel):
    sensor_id: str = Field(..., description="传感器唯一编号")
    type: SensorType = Field(..., description="传感器类型")
    name: Optional[str] = Field(None, description="传感器名称")
    unit: Unit = Field(..., description="测量单位")
    location_y: Optional[float] = Field(
        None, description="相对于中性轴的位置（m），正为受拉区"
    )
    temperature_compensation_sensor: Optional[str] = Field(
        None, description="温度补偿传感器编号"
    )
    gain: float = Field(1.0, description="增益系数")
    offset: float = Field(0.0, description="偏置系数")


class CrossSection(BaseModel):
    width: float = Field(..., description="截面宽度（m）")
    height: float = Field(..., description="截面高度（m）")
    neutral_axis_y: Optional[float] = Field(
        None, description="中性轴理论位置（m），0为底部，向上为正"
    )
    area: Optional[float] = Field(None, description="截面面积（m²）")
    moment_of_inertia: Optional[float] = Field(None, description="截面惯性矩（m⁴）")

    @field_validator("area", mode="before")
    @classmethod
    def calculate_area(cls, v: Optional[float], info: Any) -> float:
        if v is not None:
            return v
        data = info.data
        return data.get("width", 0) * data.get("height", 0)


class Material(BaseModel):
    name: str = Field("Steel", description="材料名称")
    elastic_modulus: float = Field(2.06e11, description="弹性模量（Pa）")
    poisson_ratio: float = Field(0.3, description="泊松比")
    thermal_expansion_coefficient: float = Field(1.2e-5, description="热膨胀系数（1/°C）")


class ProjectConfig(BaseModel):
    project_name: str = Field(..., description="项目名称")
    project_id: str = Field(..., description="项目唯一标识")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    description: Optional[str] = Field(None, description="项目描述")

    sensors: List[Sensor] = Field(default_factory=list, description="传感器清单")
    cross_section: Optional[CrossSection] = Field(None, description="截面几何参数")
    material: Material = Field(default_factory=Material, description="材料参数")

    default_sampling_rate: float = Field(10.0, description="默认采样率（Hz）")
    max_time_offset: float = Field(
        0.1, description="允许的最大时间偏移（秒），用于时间对齐"
    )
    zero_load_duration: float = Field(30.0, description="空载区间时长（秒），用于零点校准")

    output_directory: str = Field("output", description="输出目录路径")
    data_directory: str = Field("data", description="原始数据目录路径")
    quarantine_directory: str = Field("quarantine", description="隔离区目录路径")

    thresholds: Dict[str, float] = Field(
        default_factory=lambda: {
            "max_strain": 2000.0,
            "max_displacement": 100.0,
            "residual_strain_ratio": 0.1,
            "strain_jump_threshold": 100.0,
        }
    )

    @field_validator("updated_at")
    @classmethod
    def update_timestamp(cls, v: datetime) -> datetime:
        return datetime.now()


class ImportRecord(BaseModel):
    import_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    original_filename: str
    stored_filename: str
    row_count: int
    column_count: int
    sampling_rate: Optional[float] = None
    sensor_ids: List[str] = Field(default_factory=list)
    time_range: Optional[Dict[str, datetime]] = None


class CalibrationRecord(BaseModel):
    calibration_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    import_ids: List[str] = Field(default_factory=list)
    zero_load_interval: Dict[str, datetime]
    drift_correction: Dict[str, Dict[str, float]]
    temperature_compensation: Dict[str, Dict[str, float]]


class AlignmentRecord(BaseModel):
    alignment_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    calibration_id: str
    target_sampling_rate: float
    time_range: Dict[str, datetime]
    aligned_sensors: List[str]


class AnalysisRecord(BaseModel):
    analysis_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    alignment_id: str
    load_levels: int
    peak_strains: Dict[str, float]
    residual_deformations: Dict[str, float]
    neutral_axis_positions: List[float]
    moments: List[float]
    alerts: List[Dict[str, Any]] = Field(default_factory=list)


class HistoryRecord(BaseModel):
    record_type: str
    record: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.now)


class QuarantineEntry(BaseModel):
    original_row: Optional[int]
    raw_data: Dict[str, Any]
    reason: str
    severity: str
    source_file: str
    timestamp: Optional[datetime] = None
