"""数据模型模块 - 定义断面、测点、校准记录等数据类"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class UnitType(Enum):
    """单位类型枚举"""
    METRIC = "metric"
    IMPERIAL = "imperial"


class FlowMethod(Enum):
    """流量计算方法枚举"""
    MIDPOINT = "midpoint"
    TRAPEZOIDAL = "trapezoidal"


class MeasuringPoint(BaseModel):
    """测点数据模型"""
    id: int = Field(description="测点编号")
    distance_from_left: float = Field(description="距左岸距离 (米)")
    water_depth: float = Field(description="水深 (米)")
    velocity: float = Field(description="流速 (m/s)")
    velocity_depth_ratio: Optional[float] = Field(default=0.6, description="流速测量相对水深")
    is_edge: bool = Field(default=False, description="是否为边缘点")
    notes: Optional[str] = Field(default=None, description="测点备注")

    class Config:
        schema_extra = {
            "example": {
                "id": 1,
                "distance_from_left": 0.0,
                "water_depth": 0.5,
                "velocity": 0.0,
                "velocity_depth_ratio": 0.6,
                "is_edge": True,
                "notes": "左岸起点"
            }
        }


class SectionData(BaseModel):
    """断面数据模型"""
    section_id: str = Field(description="断面编号")
    section_name: Optional[str] = Field(default=None, description="断面名称")
    measurement_date: datetime = Field(description="测量日期时间")
    measuring_points: List[MeasuringPoint] = Field(description="测点列表")
    river_width: Optional[float] = Field(default=None, description="河宽 (米)")
    max_depth: Optional[float] = Field(default=None, description="最大水深 (米)")
    temperature: Optional[float] = Field(default=None, description="水温 (°C)")
    weather: Optional[str] = Field(default=None, description="天气情况")
    operator: Optional[str] = Field(default=None, description="操作员")
    instrument_id: Optional[str] = Field(default=None, description="使用仪器编号")
    notes: Optional[str] = Field(default=None, description="断面备注")
    unit: UnitType = Field(default=UnitType.METRIC, description="单位制")

    @validator("measuring_points")
    def sort_points_by_distance(cls, v: List[MeasuringPoint]) -> List[MeasuringPoint]:
        """按距离左岸距离排序测点"""
        return sorted(v, key=lambda p: p.distance_from_left)

    @validator("river_width", pre=True, always=True)
    def calculate_river_width(cls, v, values) -> float:
        """计算河宽"""
        if v is not None:
            return v
        points = values.get("measuring_points", [])
        if points:
            return max(p.distance_from_left for p in points)
        return 0.0

    @validator("max_depth", pre=True, always=True)
    def calculate_max_depth(cls, v, values) -> float:
        """计算最大水深"""
        if v is not None:
            return v
        points = values.get("measuring_points", [])
        if points:
            return max(p.water_depth for p in points)
        return 0.0

    class Config:
        schema_extra = {
            "example": {
                "section_id": "S001",
                "section_name": "黄河花园口断面",
                "measurement_date": "2023-07-15T10:30:00",
                "measuring_points": [],
                "river_width": 500.0,
                "max_depth": 3.5,
                "temperature": 22.5,
                "weather": "晴朗",
                "operator": "张三",
                "instrument_id": "ADCP-001",
                "notes": "汛期常规测量",
                "unit": "metric"
            }
        }


class CalibrationRecord(BaseModel):
    """仪器校准记录数据模型"""
    instrument_id: str = Field(description="仪器编号")
    instrument_type: str = Field(description="仪器类型 (如: ADCP, 流速仪)")
    calibration_date: datetime = Field(description="校准日期")
    next_calibration_date: Optional[datetime] = Field(default=None, description="下次校准日期")
    calibration_factor: float = Field(default=1.0, description="校准系数")
    offset: float = Field(default=0.0, description="偏移量")
    uncertainty: float = Field(default=0.0, description="校准不确定度")
    standard_used: Optional[str] = Field(default=None, description="使用的标准器")
    calibration_agency: Optional[str] = Field(default=None, description="校准机构")
    certificate_number: Optional[str] = Field(default=None, description="证书编号")
    notes: Optional[str] = Field(default=None, description="校准备注")
    is_valid: bool = Field(default=True, description="是否有效")

    def is_expired(self, check_date: Optional[datetime] = None) -> bool:
        """检查校准是否过期"""
        if not self.next_calibration_date:
            return False
        check_date = check_date or datetime.now()
        return check_date > self.next_calibration_date

    def apply_calibration(self, value: float) -> float:
        """应用校准系数到测量值"""
        return value * self.calibration_factor + self.offset

    class Config:
        schema_extra = {
            "example": {
                "instrument_id": "ADCP-001",
                "instrument_type": "ADCP",
                "calibration_date": "2023-01-15",
                "next_calibration_date": "2024-01-15",
                "calibration_factor": 1.002,
                "offset": 0.001,
                "uncertainty": 0.005,
                "standard_used": "标准流速仪",
                "calibration_agency": "国家水文计量中心",
                "certificate_number": "CAL2023-00123",
                "notes": "校准合格",
                "is_valid": True
            }
        }


class ManualNote(BaseModel):
    """人工备注数据模型"""
    id: str = Field(description="备注编号")
    section_id: str = Field(description="关联断面编号")
    note_date: datetime = Field(description="记录日期时间")
    author: str = Field(description="记录人")
    category: str = Field(description="备注类别 (如: 异常, 补充, 警告)")
    content: str = Field(description="备注内容")
    related_point_id: Optional[int] = Field(default=None, description="关联测点编号")
    severity: str = Field(default="info", description="严重程度: info, warning, error")

    class Config:
        schema_extra = {
            "example": {
                "id": "N001",
                "section_id": "S001",
                "note_date": "2023-07-15T10:45:00",
                "author": "张三",
                "category": "异常",
                "content": "第5测点流速异常偏高，可能是水草影响",
                "related_point_id": 5,
                "severity": "warning"
            }
        }


class ValidationIssue(BaseModel):
    """数据校验问题数据模型"""
    issue_id: str = Field(description="问题编号")
    section_id: str = Field(description="断面编号")
    issue_type: str = Field(description="问题类型: unit, spacing, drift, anomaly, missing")
    severity: str = Field(description="严重程度: info, warning, error")
    message: str = Field(description="问题描述")
    related_point_id: Optional[int] = Field(default=None, description="关联测点编号")
    related_field: Optional[str] = Field(default=None, description="关联字段")
    expected_value: Optional[float] = Field(default=None, description="期望值")
    actual_value: Optional[float] = Field(default=None, description="实际值")
    suggestion: Optional[str] = Field(default=None, description="处理建议")

    class Config:
        schema_extra = {
            "example": {
                "issue_id": "V001",
                "section_id": "S001",
                "issue_type": "anomaly",
                "severity": "warning",
                "message": "测点5流速异常，超出均值3倍标准差",
                "related_point_id": 5,
                "related_field": "velocity",
                "expected_value": 1.2,
                "actual_value": 3.5,
                "suggestion": "建议检查该测点测量是否受水草或其他干扰"
            }
        }


class FlowResult(BaseModel):
    """流量计算结果数据模型"""
    section_id: str = Field(description="断面编号")
    calculation_date: datetime = Field(default_factory=datetime.now, description="计算日期")
    method: FlowMethod = Field(description="计算方法")
    total_discharge: float = Field(description="总流量 (m³/s)")
    total_area: float = Field(description="过水面积 (m²)")
    average_velocity: float = Field(description="平均流速 (m/s)")
    max_velocity: Optional[float] = Field(default=None, description="最大流速 (m/s)")
    river_width: float = Field(description="河宽 (m)")
    max_depth: float = Field(description="最大水深 (m)")
    
    segment_results: List["SegmentResult"] = Field(default_factory=list, description="分段计算结果")
    uncertainty: Optional["UncertaintyResult"] = Field(default=None, description="不确定度分析结果")
    
    class Config:
        schema_extra = {
            "example": {
                "section_id": "S001",
                "calculation_date": "2023-07-15T11:00:00",
                "method": "midpoint",
                "total_discharge": 1250.5,
                "total_area": 875.0,
                "average_velocity": 1.43,
                "max_velocity": 2.1,
                "river_width": 500.0,
                "max_depth": 3.5
            }
        }


class SegmentResult(BaseModel):
    """分段计算结果数据模型"""
    segment_id: int = Field(description="分段编号")
    start_distance: float = Field(description="起始距离 (m)")
    end_distance: float = Field(description="终止距离 (m)")
    width: float = Field(description="分段宽度 (m)")
    average_depth: float = Field(description="平均水深 (m)")
    average_velocity: float = Field(description="平均流速 (m/s)")
    area: float = Field(description="分段面积 (m²)")
    discharge: float = Field(description="分段流量 (m³/s)")
    left_point_id: Optional[int] = Field(default=None, description="左测点编号")
    right_point_id: Optional[int] = Field(default=None, description="右测点编号")


class UncertaintyResult(BaseModel):
    """不确定度分析结果数据模型"""
    combined_uncertainty: float = Field(description="合成不确定度 (m³/s)")
    relative_uncertainty: float = Field(description="相对不确定度 (%)")
    expanded_uncertainty: float = Field(description="扩展不确定度 (m³/s)")
    coverage_factor: float = Field(default=2.0, description="包含因子")
    
    source_uncertainties: List["SourceUncertainty"] = Field(default_factory=list, description="各不确定度分量")
    
    class Config:
        schema_extra = {
            "example": {
                "combined_uncertainty": 25.01,
                "relative_uncertainty": 2.0,
                "expanded_uncertainty": 50.02,
                "coverage_factor": 2.0
            }
        }


class SourceUncertainty(BaseModel):
    """不确定度来源数据模型"""
    source: str = Field(description="不确定度来源 (如: 水深测量, 流速测量, 间距测量)")
    standard_uncertainty: float = Field(description="标准不确定度")
    sensitivity_coefficient: float = Field(description="灵敏系数")
    contribution: float = Field(description="不确定度贡献 (合成不确定度的平方分量)")
    relative_contribution: float = Field(description="相对贡献 (%)")


class HistoricalComparison(BaseModel):
    """历史断面对比数据模型"""
    current_section_id: str = Field(description="当前断面编号")
    historical_section_id: str = Field(description="历史断面编号")
    comparison_date: datetime = Field(default_factory=datetime.now, description="对比日期")
    
    discharge_difference: float = Field(description="流量差值 (m³/s)")
    discharge_difference_percent: float = Field(description="流量差值百分比 (%)")
    
    area_difference: Optional[float] = Field(default=None, description="面积差值 (m²)")
    area_difference_percent: Optional[float] = Field(default=None, description="面积差值百分比 (%)")
    
    velocity_difference: Optional[float] = Field(default=None, description="流速差值 (m/s)")
    velocity_difference_percent: Optional[float] = Field(default=None, description="流速差值百分比 (%)")
    
    depth_profile_difference: Optional[float] = Field(default=None, description="断面形态差异指数")
    
    notes: Optional[str] = Field(default=None, description="对比备注")


FlowResult.update_forward_refs()
