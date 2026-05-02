from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class UnitSystem(str, Enum):
    METERS = "meters"
    CENTIMETERS = "centimeters"
    FEET = "feet"


class Point3D(BaseModel):
    x: float = Field(description="X坐标")
    y: float = Field(description="Y坐标")
    z: float = Field(description="Z坐标")

    def to_tuple(self) -> tuple:
        return (self.x, self.y, self.z)

    def to_list(self) -> List[float]:
        return [self.x, self.y, self.z]


class Speaker(BaseModel):
    id: str = Field(description="音箱唯一标识")
    name: str = Field(description="音箱名称")
    position: Point3D = Field(description="音箱三维坐标")
    group: Optional[str] = Field(default=None, description="音箱组/阵列标识")
    channel: Optional[int] = Field(default=None, description="调音台通道号")


class MeasurementPoint(BaseModel):
    id: str = Field(description="测点唯一标识")
    name: str = Field(description="测点名称")
    position: Point3D = Field(description="测点三维坐标")
    note: Optional[str] = Field(default=None, description="测点备注")


class ImpulseResponse(BaseModel):
    speaker_id: str = Field(description="对应音箱ID")
    point_id: str = Field(description="对应测点ID")
    sample_rate: float = Field(description="采样率 (Hz)")
    time_samples: List[float] = Field(description="时间采样点数组 (秒)")
    amplitude: List[float] = Field(description="脉冲响应幅度数组")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")

    @property
    def duration(self) -> float:
        if not self.time_samples:
            return 0.0
        return self.time_samples[-1] - self.time_samples[0]


class ClimateData(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now, description="测量时间")
    temperature_c: float = Field(description="温度 (摄氏度)")
    humidity_pct: float = Field(description="相对湿度 (%)")
    pressure_kpa: Optional[float] = Field(default=101.325, description="大气压 (kPa)")
    note: Optional[str] = Field(default=None, description="备注")


class OverrideType(str, Enum):
    LOCK = "lock"
    EXCLUDE = "exclude"


class PointOverride(BaseModel):
    point_id: str = Field(description="测点ID")
    speaker_id: Optional[str] = Field(default=None, description="可选：指定音箱，None表示全部")
    override_type: OverrideType = Field(description="覆盖类型：锁定或排除")
    reason: Optional[str] = Field(default=None, description="覆盖原因")


class ValidationError(BaseModel):
    severity: str = Field(description="错误级别: error/warning")
    category: str = Field(description="错误类别")
    message: str = Field(description="错误信息")
    details: Dict[str, Any] = Field(default_factory=dict, description="详细信息")


class ValidationResult(BaseModel):
    valid: bool = Field(description="是否通过校验")
    errors: List[ValidationError] = Field(default_factory=list, description="错误列表")
    warnings: List[ValidationError] = Field(default_factory=list, description="警告列表")


class PeakInfo(BaseModel):
    sample_index: int = Field(description="峰在采样数组中的索引")
    time_sec: float = Field(description="峰的时间 (秒)")
    amplitude: float = Field(description="峰的幅度")
    is_direct: bool = Field(default=False, description="是否为直达声峰")
    confidence: float = Field(default=0.0, description="作为直达声的置信度")


class SpeakerDelayResult(BaseModel):
    speaker_id: str = Field(description="音箱ID")
    delay_ms: float = Field(description="建议延时 (毫秒)")
    reference_delay_ms: float = Field(description="参考音箱延时 (毫秒)")
    delta_ms: float = Field(description="相对于参考的差值 (毫秒)")
    phase_risk_score: float = Field(description="相位风险分数 (0-1)")
    phase_risk_level: str = Field(description="相位风险等级: low/medium/high")
    confidence: float = Field(description="结果置信度")
    used_points: List[str] = Field(default_factory=list, description="使用的测点ID列表")
    excluded_points: List[str] = Field(default_factory=list, description="排除的测点ID列表")
    locked_points: List[str] = Field(default_factory=list, description="锁定的测点ID列表")


class SolverResult(BaseModel):
    reference_speaker_id: str = Field(description="参考音箱ID")
    estimated_speed_of_sound: float = Field(description="估算声速 (m/s)")
    speed_of_sound_confidence: float = Field(description="声速估算置信度")
    speaker_delays: Dict[str, SpeakerDelayResult] = Field(description="各音箱延时结果")
    peak_details: Dict[str, Dict[str, PeakInfo]] = Field(
        default_factory=dict,
        description="每个(音箱,测点)对的峰检测详情"
    )


class CalibrationState(BaseModel):
    config_version: str = Field(default="1.0", description="配置版本")
    unit_system: UnitSystem = Field(default=UnitSystem.METERS, description="单位制")
    speakers: Dict[str, Speaker] = Field(default_factory=dict, description="音箱字典")
    points: Dict[str, MeasurementPoint] = Field(default_factory=dict, description="测点字典")
    impulse_responses: Dict[str, Dict[str, ImpulseResponse]] = Field(
        default_factory=dict,
        description="脉冲响应: {speaker_id: {point_id: ir}}"
    )
    climate_data: Optional[ClimateData] = Field(default=None, description="温湿度数据")
    overrides: List[PointOverride] = Field(default_factory=list, description="人工覆盖配置")
    last_validation: Optional[ValidationResult] = Field(default=None, description="最后校验结果")
    last_solve: Optional[SolverResult] = Field(default=None, description="最后求解结果")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
