"""数据模型模块 - 定义窑炉参数、配方、曲线数据等核心数据结构"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel, Field, field_validator


class FiringType(str, Enum):
    """烧成类型"""
    BISQUE = "bisque"
    GLAZE = "glaze"


class SegmentType(str, Enum):
    """曲线段类型"""
    RAMP = "ramp"
    HOLD = "hold"
    COOL = "cool"


class KilnParameters(BaseModel):
    """窑炉参数模型"""
    name: str = Field(..., description="窑炉名称")
    max_temperature: float = Field(..., gt=0, description="最高工作温度 (°C)")
    chamber_volume: float = Field(..., gt=0, description="窑室容积 (L)")
    power_rating: float = Field(..., gt=0, description="额定功率 (kW)")
    thermal_inertia_factor: float = Field(..., gt=0, lt=5, description="热惯性系数 (1-5，越大惯性越大)")
    max_heating_rate: float = Field(..., gt=0, description="最大升温速率 (°C/min)")
    max_cooling_rate: float = Field(..., gt=0, description="最大自然冷却速率 (°C/min)")
    sensor_accuracy: float = Field(..., gt=0, description="传感器精度 (±°C)")
    heating_elements_count: int = Field(default=4, ge=1, description="加热元件数量")

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "name": "小型电窑 0.06m³",
                "max_temperature": 1320.0,
                "chamber_volume": 60.0,
                "power_rating": 6.0,
                "thermal_inertia_factor": 2.5,
                "max_heating_rate": 8.0,
                "max_cooling_rate": 5.0,
                "sensor_accuracy": 2.0,
                "heating_elements_count": 4
            }]
        }
    }


class BodyProperties(BaseModel):
    """坯体特性"""
    name: str = Field(..., description="坯体名称/类型")
    thickness_range: Tuple[float, float] = Field(..., description="坯体厚度范围 (cm)")
    thermal_conductivity: float = Field(..., gt=0, description="热导率 (W/m·K)")
    porosity: float = Field(..., ge=0, le=1, description="孔隙率")
    recommended_bisque_temp: float = Field(..., gt=0, description="推荐素烧温度 (°C)")
    critical_cooling_rate: float = Field(..., gt=0, description="临界冷却速率 (°C/min)，超过可能开裂")


class GlazeProperties(BaseModel):
    """釉料特性"""
    name: str = Field(..., description="釉料名称")
    maturing_temp_range: Tuple[float, float] = Field(..., description="成熟温度范围 (°C)")
    hold_time_recommended: float = Field(..., gt=0, description="推荐保温时间 (min)")
    expansion_coefficient: float = Field(..., gt=0, description="热膨胀系数 (×10^-6 /°C)")
    is_matte: bool = Field(default=False, description="是否哑光釉")


class FiringRecipe(BaseModel):
    """烧成配方模型"""
    name: str = Field(..., description="配方名称")
    firing_type: FiringType = Field(..., description="烧成类型")
    target_temperature: float = Field(..., gt=0, description="目标烧成温度 (°C)")
    total_thickness: float = Field(..., gt=0, description="总厚度（坯体+釉层）(cm)")
    body: BodyProperties = Field(..., description="坯体特性")
    glaze: Optional[GlazeProperties] = Field(None, description="釉料特性（素烧可为空）")
    max_allowed_heating_rate: Optional[float] = Field(None, description="最大允许升温速率 (°C/min)")
    notes: Optional[str] = Field(None, description="备注")

    @field_validator('max_allowed_heating_rate')
    @classmethod
    def calculate_default_rate(cls, v: Optional[float], info: Any) -> float:
        """根据厚度自动计算默认升温速率"""
        if v is not None:
            return v
        thickness = info.data.get('total_thickness', 1.0)
        # 经验公式：越厚的坯体升温应越慢
        base_rate = 5.0
        return max(1.0, base_rate - (thickness - 1.0) * 0.8)


class CurveSegment(BaseModel):
    """曲线段模型"""
    segment_type: SegmentType = Field(..., description="段类型")
    start_temp: float = Field(..., description="起始温度 (°C)")
    end_temp: float = Field(..., description="结束温度 (°C)")
    duration: float = Field(..., ge=0, description="持续时间 (min)")
    rate: Optional[float] = Field(None, description="升温/降温速率 (°C/min)，保温段为0")

    @field_validator('rate', mode='before')
    @classmethod
    def calculate_rate(cls, v: Optional[float], info: Any) -> float:
        """自动计算速率"""
        if v is not None:
            return v
        data = info.data
        segment_type = data.get('segment_type')
        if segment_type == SegmentType.HOLD:
            return 0.0
        duration = data.get('duration', 1.0)
        if duration <= 0:
            return 0.0
        start_temp = data.get('start_temp', 0.0)
        end_temp = data.get('end_temp', 0.0)
        return (end_temp - start_temp) / duration


class PlannedCurve(BaseModel):
    """计划曲线模型"""
    recipe_name: str = Field(..., description="关联配方名称")
    kiln_name: str = Field(..., description="使用窑炉名称")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    segments: List[CurveSegment] = Field(..., description="曲线段列表")
    preheat_included: bool = Field(default=True, description="是否包含预热阶段")

    def get_total_duration(self) -> float:
        """获取总烧成时间（分钟）"""
        return sum(s.duration for s in self.segments)

    def get_peak_temperature(self) -> float:
        """获取峰值温度"""
        return max(s.end_temp for s in self.segments)


class TemperaturePoint(BaseModel):
    """温度记录点"""
    timestamp: datetime = Field(..., description="时间戳")
    temperature: float = Field(..., description="温度值 (°C)")
    sensor_id: Optional[int] = Field(default=0, description="传感器ID")
    is_valid: bool = Field(default=True, description="是否有效数据点")


class MeasuredCurve(BaseModel):
    """实测温度曲线"""
    kiln_name: str = Field(..., description="窑炉名称")
    start_time: datetime = Field(..., description="开始时间")
    end_time: Optional[datetime] = Field(None, description="结束时间")
    data_points: List[TemperaturePoint] = Field(..., description="温度数据点列表")
    sampling_interval: Optional[float] = Field(None, description="采样间隔（分钟）")
    sensor_count: int = Field(default=1, description="传感器数量")

    def get_duration_minutes(self) -> float:
        """获取曲线持续时间（分钟）"""
        if not self.data_points:
            return 0.0
        start = self.data_points[0].timestamp
        end = self.data_points[-1].timestamp
        return (end - start).total_seconds() / 60.0

    def get_temperatures_array(self) -> List[float]:
        """获取温度数组"""
        return [p.temperature for p in self.data_points if p.is_valid]


class ValidationIssue(BaseModel):
    """校验问题项"""
    severity: str = Field(..., description="严重程度: critical, warning, info")
    category: str = Field(..., description="问题分类: heating_rate, thermal_work, hold_time, cooling, sensor")
    message: str = Field(..., description="问题描述")
    location: Optional[str] = Field(None, description="问题位置（温度点或时间段）")
    suggested_action: Optional[str] = Field(None, description="建议措施")
    measured_value: Optional[float] = Field(None, description="实测值")
    threshold_value: Optional[float] = Field(None, description="阈值")


class ValidationResult(BaseModel):
    """校验结果"""
    overall_status: str = Field(..., description="整体状态: pass, warning, fail")
    issues: List[ValidationIssue] = Field(default_factory=list, description="问题列表")
    heating_rate_ok: bool = Field(default=True, description="升温速率是否正常")
    thermal_work_ok: bool = Field(default=True, description="热功是否充足")
    hold_time_ok: bool = Field(default=True, description="保温时间是否足够")
    cooling_risk_ok: bool = Field(default=True, description="冷却风险是否可控")
    sensor_ok: bool = Field(default=True, description="传感器是否正常")
    summary: str = Field(default="", description="结果摘要")


class SimulationResult(BaseModel):
    """热惯性模拟结果"""
    simulated_temperatures: List[float] = Field(..., description="模拟温度曲线")
    time_points: List[float] = Field(..., description="时间点（分钟）")
    thermal_inertia_effects: List[float] = Field(..., description="各点热惯性影响值")
    lag_times: List[float] = Field(..., description="各点滞后时间（分钟）")
    core_surface_diff: List[float] = Field(..., description="表里温差（°C）")


class ComparisonResult(BaseModel):
    """计划与实测曲线对比结果"""
    planned_duration: float = Field(..., description="计划总时长（分钟）")
    measured_duration: float = Field(..., description="实测总时长（分钟）")
    planned_peak: float = Field(..., description="计划峰值温度（°C）")
    measured_peak: float = Field(..., description="实测峰值温度（°C）")
    peak_time_diff: float = Field(..., description="到达峰值时间差（分钟）")
    temperature_deviation: List[float] = Field(..., description="各时间点温度偏差")
    avg_deviation: float = Field(..., description="平均偏差（°C）")
    max_deviation: float = Field(..., description="最大偏差（°C）")


class AdjustmentSuggestion(BaseModel):
    """调整建议"""
    segment_index: int = Field(..., description="相关曲线段索引")
    original_segment: CurveSegment = Field(..., description="原曲线段")
    suggested_duration: float = Field(..., description="建议持续时间（分钟）")
    suggested_rate: Optional[float] = Field(None, description="建议速率（°C/min）")
    reason: str = Field(..., description="调整原因")
    priority: int = Field(default=1, description="优先级（1最高）")


class CorrectionCurve(BaseModel):
    """修正后的曲线"""
    name: str = Field(..., description="曲线名称")
    base_on: str = Field(..., description="基于哪个曲线")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    segments: List[CurveSegment] = Field(..., description="修正后的曲线段")
    adjustments: List[AdjustmentSuggestion] = Field(..., description="调整说明")
    notes: str = Field(default="", description="备注")
