from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


class RiskType(str, Enum):
    AMMONIA_HIGH = "ammonia_high"
    NITRITE_HIGH = "nitrite_high"
    PH_MUTATION = "ph_mutation"
    PH_OUT_OF_RANGE = "ph_out_of_range"
    SALINITY_GRADIENT = "salinity_gradient"
    SALINITY_OUT_OF_RANGE = "salinity_out_of_range"
    DO_LOW = "do_low"
    DO_CRITICAL = "do_critical"
    TEMP_OUT_OF_RANGE = "temp_out_of_range"
    CHEMICAL_CONFLICT = "chemical_conflict"
    PROBIOTICS_INTERVAL = "probiotics_interval"


class RiskLevel(str, Enum):
    SAFE = "safe"
    WARNING = "warning"
    DANGER = "danger"
    CRITICAL = "critical"


class RiskAssessment(BaseModel):
    risk_id: str = Field(..., description="风险唯一标识")
    risk_type: RiskType = Field(..., description="风险类型")
    risk_level: RiskLevel = Field(..., description="风险等级")
    detected_at: datetime = Field(default_factory=datetime.now)
    description: str = Field(..., description="风险描述")
    current_value: Optional[float] = Field(None, description="当前值")
    threshold_value: Optional[float] = Field(None, description="阈值")
    location: Optional[str] = Field(None, description="发生位置/时间点")
    suggested_action: Optional[str] = Field(None, description="建议措施")
    confidence: float = Field(1.0, ge=0, le=1, description="置信度")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_id": self.risk_id,
            "risk_type": self.risk_type.value,
            "risk_level": self.risk_level.value,
            "detected_at": self.detected_at.isoformat(),
            "description": self.description,
            "current_value": self.current_value,
            "threshold_value": self.threshold_value,
            "location": self.location,
            "suggested_action": self.suggested_action,
            "confidence": self.confidence,
        }


class SimulationResult(BaseModel):
    timestamps: List[datetime] = Field(..., description="时间戳列表")
    temperatures: List[float] = Field(..., description="水温序列")
    ph_values: List[float] = Field(..., description="pH序列")
    ammonia_nitrogens: List[float] = Field(..., description="氨氮序列")
    nitrites: List[float] = Field(..., description="亚硝酸盐序列")
    salinities: List[float] = Field(..., description="盐度序列")
    dissolved_oxygens: List[float] = Field(..., description="溶解氧序列")

    @property
    def time_series(self) -> List[Dict[str, Any]]:
        series = []
        for i, ts in enumerate(self.timestamps):
            series.append({
                "hour": i,
                "timestamp": ts,
                "temperature": self.temperatures[i],
                "ph": self.ph_values[i],
                "ammonia_nitrogen": self.ammonia_nitrogens[i],
                "nitrite": self.nitrites[i],
                "salinity": self.salinities[i],
                "dissolved_oxygen": self.dissolved_oxygens[i],
            })
        return series

    def get_final_state(self) -> Dict[str, float]:
        if not self.timestamps:
            return {}
        return {
            "temperature": self.temperatures[-1],
            "ph": self.ph_values[-1],
            "ammonia_nitrogen": self.ammonia_nitrogens[-1],
            "nitrite": self.nitrites[-1],
            "salinity": self.salinities[-1],
            "dissolved_oxygen": self.dissolved_oxygens[-1],
        }

    def get_statistics(self) -> Dict[str, Dict[str, float]]:
        if not self.timestamps:
            return {}
        
        def calc_stats(values: List[float]) -> Dict[str, float]:
            return {
                "min": min(values),
                "max": max(values),
                "mean": sum(values) / len(values),
                "final": values[-1],
                "change": values[-1] - values[0],
            }
        
        return {
            "ammonia_nitrogen": calc_stats(self.ammonia_nitrogens),
            "nitrite": calc_stats(self.nitrites),
            "ph": calc_stats(self.ph_values),
            "dissolved_oxygen": calc_stats(self.dissolved_oxygens),
            "salinity": calc_stats(self.salinities),
            "temperature": calc_stats(self.temperatures),
        }

    def to_dataframe_dict(self) -> Dict[str, List]:
        return {
            "timestamp": [t.isoformat() for t in self.timestamps],
            "temperature": self.temperatures,
            "ph": self.ph_values,
            "ammonia_nitrogen": self.ammonia_nitrogens,
            "nitrite": self.nitrites,
            "salinity": self.salinities,
            "dissolved_oxygen": self.dissolved_oxygens,
        }


class AnalysisReport(BaseModel):
    report_id: str = Field(..., description="报告唯一标识")
    pond_id: str = Field(..., description="池塘ID")
    scenario_id: str = Field(..., description="方案ID")
    generated_at: datetime = Field(default_factory=datetime.now)

    initial_state: Dict[str, Any] = Field(..., description="初始状态")
    simulation_result: SimulationResult = Field(..., description="模拟结果")

    risks: List[RiskAssessment] = Field(default_factory=list, description="检测到的风险列表")

    recommendations: Dict[str, Any] = Field(
        default_factory=dict,
        description="处置建议: water_change, aeration, probiotics",
    )

    summary: str = Field(..., description="分析摘要")

    def get_highest_risk_level(self) -> RiskLevel:
        if not self.risks:
            return RiskLevel.SAFE
        level_order = {
            RiskLevel.SAFE: 0,
            RiskLevel.WARNING: 1,
            RiskLevel.DANGER: 2,
            RiskLevel.CRITICAL: 3,
        }
        return max(self.risks, key=lambda r: level_order[r.risk_level]).risk_level

    def get_risks_by_level(self, level: RiskLevel) -> List[RiskAssessment]:
        return [r for r in self.risks if r.risk_level == level]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "pond_id": self.pond_id,
            "scenario_id": self.scenario_id,
            "generated_at": self.generated_at.isoformat(),
            "initial_state": self.initial_state,
            "simulation_result": self.simulation_result.to_dataframe_dict(),
            "risks": [r.to_dict() for r in self.risks],
            "recommendations": self.recommendations,
            "summary": self.summary,
            "highest_risk_level": self.get_highest_risk_level().value,
        }


class ComparisonReport(BaseModel):
    comparison_id: str = Field(..., description="对比唯一标识")
    generated_at: datetime = Field(default_factory=datetime.now)

    baseline_report_id: str = Field(..., description="基准方案报告ID")
    comparison_report_id: str = Field(..., description="对比方案报告ID")

    baseline_summary: Dict[str, Any] = Field(..., description="基准方案摘要")
    comparison_summary: Dict[str, Any] = Field(..., description="对比方案摘要")

    key_differences: List[Dict[str, Any]] = Field(default_factory=list, description="关键差异")
    recommendation: str = Field(..., description="推荐结论")
    preferred_scenario: Optional[str] = Field(None, description="推荐方案ID")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "comparison_id": self.comparison_id,
            "generated_at": self.generated_at.isoformat(),
            "baseline_report_id": self.baseline_report_id,
            "comparison_report_id": self.comparison_report_id,
            "baseline_summary": self.baseline_summary,
            "comparison_summary": self.comparison_summary,
            "key_differences": self.key_differences,
            "recommendation": self.recommendation,
            "preferred_scenario": self.preferred_scenario,
        }
