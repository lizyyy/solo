from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class HeatingRate:
    """升温速率分析"""
    time_segment: str  # 时间区间
    start_time: float
    end_time: float
    start_temp: float
    end_temp: float
    rate: float  # 升温速率（°C/分钟或°C/小时）
    target_rate: Optional[float] = None
    deviation: Optional[float] = None  # 与目标的偏差
    is_acceptable: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'time_segment': self.time_segment,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'start_temp': self.start_temp,
            'end_temp': self.end_temp,
            'rate': self.rate,
            'target_rate': self.target_rate,
            'deviation': self.deviation,
            'is_acceptable': self.is_acceptable
        }


@dataclass
class InsulationDeviation:
    """保温偏差分析"""
    insulation_stage: str  # 保温阶段名称
    target_temp: float
    actual_temp: float
    temp_deviation: float  # 温度偏差
    target_duration: float
    actual_duration: float
    duration_deviation: float  # 时长偏差
    is_acceptable: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'insulation_stage': self.insulation_stage,
            'target_temp': self.target_temp,
            'actual_temp': self.actual_temp,
            'temp_deviation': self.temp_deviation,
            'target_duration': self.target_duration,
            'actual_duration': self.actual_duration,
            'duration_deviation': self.duration_deviation,
            'is_acceptable': self.is_acceptable
        }


@dataclass
class ThermalShockRisk:
    """热冲击风险分析"""
    position_id: str
    position_code: str
    risk_level: str  # 低、中、高
    risk_factors: List[str] = field(default_factory=list)  # 风险因素
    max_temp_change_rate: float = 0.0  # 最大温度变化率
    body_thickness: Optional[float] = None  # 坯体厚度
    recommendation: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'position_id': self.position_id,
            'position_code': self.position_code,
            'risk_level': self.risk_level,
            'risk_factors': self.risk_factors,
            'max_temp_change_rate': self.max_temp_change_rate,
            'body_thickness': self.body_thickness,
            'recommendation': self.recommendation
        }


@dataclass
class GlazeDefectAssociation:
    """釉面缺陷关联分析"""
    defect_id: str
    defect_type: str
    position_id: str
    position_code: str
    glaze_recipe_id: Optional[str] = None
    glaze_recipe_name: Optional[str] = None
    
    possible_causes: List[str] = field(default_factory=list)
    related_factors: Dict[str, Any] = field(default_factory=dict)
    
    glaze_melting_temp: Optional[float] = None
    actual_max_temp: Optional[float] = None
    temp_difference: Optional[float] = None
    
    heating_rate_at_melting: Optional[float] = None
    cooling_rate_at_melting: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'defect_id': self.defect_id,
            'defect_type': self.defect_type,
            'position_id': self.position_id,
            'position_code': self.position_code,
            'glaze_recipe_id': self.glaze_recipe_id,
            'glaze_recipe_name': self.glaze_recipe_name,
            'possible_causes': self.possible_causes,
            'related_factors': self.related_factors,
            'glaze_melting_temp': self.glaze_melting_temp,
            'actual_max_temp': self.actual_max_temp,
            'temp_difference': self.temp_difference,
            'heating_rate_at_melting': self.heating_rate_at_melting,
            'cooling_rate_at_melting': self.cooling_rate_at_melting
        }


@dataclass
class AnalysisResult:
    """综合分析结果"""
    kiln_run_id: str
    
    heating_rates: List[HeatingRate] = field(default_factory=list)
    insulation_deviations: List[InsulationDeviation] = field(default_factory=list)
    thermal_shock_risks: List[ThermalShockRisk] = field(default_factory=list)
    glaze_defect_associations: List[GlazeDefectAssociation] = field(default_factory=list)
    
    summary: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'kiln_run_id': self.kiln_run_id,
            'heating_rates': [hr.to_dict() for hr in self.heating_rates],
            'insulation_deviations': [idv.to_dict() for idv in self.insulation_deviations],
            'thermal_shock_risks': [tsr.to_dict() for tsr in self.thermal_shock_risks],
            'glaze_defect_associations': [gda.to_dict() for gda in self.glaze_defect_associations],
            'summary': self.summary
        }
