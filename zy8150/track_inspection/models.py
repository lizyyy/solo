from dataclasses import dataclass
from typing import Optional, List


@dataclass
class TrackSection:
    """轨道区间定义"""
    section_id: str
    start_km: float
    end_km: float
    section_type: str
    curve_direction: Optional[str] = None
    curve_radius: Optional[float] = None


@dataclass
class GeometryPoint:
    """几何检测点原始数据"""
    mileage: float
    track_gauge: float
    level: float
    alignment_left: float
    alignment_right: float
    profile_left: float
    profile_right: float


@dataclass
class SampledPoint:
    """归一化采样点数据"""
    mileage: float
    track_gauge: float
    level: float
    alignment: float
    profile: float
    section_type: str
    curve_direction: Optional[str] = None
    curve_radius: Optional[float] = None


@dataclass
class Violation:
    """单指标超限"""
    mileage: float
    indicator: str
    value: float
    threshold: float
    deviation: float
    score: int
    level: str
    section_type: str


@dataclass
class DefectSegment:
    """病害段（连续超限合并）"""
    start_mileage: float
    end_mileage: float
    length: float
    indicators: List[str]
    total_score: int
    max_score: int
    priority: str
    section_type: str
    level: str
