from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
from pydantic import BaseModel, Field


class PhaseType(str, Enum):
    HEATING = "heating"
    HOLDING = "holding"
    COOLING = "cooling"


class ThermocoupleData(BaseModel):
    timestamp: datetime
    temperatures: Dict[str, float] = Field(description="热电偶名称到温度的映射")
    elapsed_seconds: Optional[float] = None


class CurvePhase(BaseModel):
    name: str
    phase_type: PhaseType
    start_temp: float
    end_temp: float
    start_time: float = Field(description="开始时间（秒）")
    duration: float = Field(description="持续时间（秒）")
    target_rate: Optional[float] = Field(default=None, description="目标升温/冷却速率 (°C/min)")
    notes: Optional[str] = None


class TargetCurve(BaseModel):
    name: str
    description: Optional[str] = None
    phases: List[CurvePhase]
    total_duration: Optional[float] = None
    max_temp: Optional[float] = None


class KilnLayer(BaseModel):
    layer_name: str
    position: str = Field(description="位置: bottom/middle/top")
    load_type: str = Field(description="装载类型: 作品种类/材质")
    piece_count: int = 0
    expected_temp_offset: float = Field(default=0.0, description="预期温度偏移 (°C)")
    thermocouple: Optional[str] = None


class KilnLoad(BaseModel):
    batch_id: str
    load_date: datetime
    kiln_model: str
    layers: List[KilnLayer]
    total_pieces: int
    notes: Optional[str] = None


class DefectRecord(BaseModel):
    batch_id: str
    piece_id: str
    layer_name: str
    defect_type: str = Field(description="瑕疵类型: 釉裂/气泡/针孔/粘底/落渣/其他")
    severity: str = Field(description="严重程度: 轻微/中等/严重")
    description: Optional[str] = None
    suspect_phase: Optional[PhaseType] = None
    location_x: Optional[float] = None
    location_y: Optional[float] = None


class PhaseDeviation(BaseModel):
    phase_name: str
    phase_type: PhaseType
    target_temp_profile: List[float]
    actual_temp_profile: Dict[str, List[float]]
    avg_temp_deviation: Dict[str, float] = Field(description="每层平均温度偏差")
    max_temp_deviation: Dict[str, float] = Field(description="每层最大温度偏差")
    rate_deviation: Optional[Dict[str, float]] = Field(default=None, description="速率偏差 (°C/min)")
    hold_deviation_seconds: Optional[float] = Field(default=None, description="保温时间偏差")


class HeatIntegral(BaseModel):
    phase_name: str
    total_heat: float = Field(description="总热量积分 (°C·s)")
    heat_by_layer: Dict[str, float] = Field(description="每层热量积分")
    reference_heat: Optional[float] = None
    deviation_percent: Optional[float] = None


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class LayerRisk(BaseModel):
    layer_name: str
    risk_level: RiskLevel
    risk_score: float
    risk_factors: List[str] = Field(description="风险因素列表")
    suggestion: Optional[str] = None


class BatchRiskAssessment(BaseModel):
    overall_risk: RiskLevel
    overall_score: float
    layer_risks: Dict[str, LayerRisk]
    critical_factors: List[str]
    suggestions: List[str]


class ReviewNote(BaseModel):
    note_id: str
    created_at: datetime
    author: Optional[str] = None
    category: str = Field(description="分类: 观察/建议/问题/教训")
    content: str
    related_layer: Optional[str] = None
    related_phase: Optional[PhaseType] = None
    attachments: Optional[List[str]] = None


class ReviewSession(BaseModel):
    session_id: str
    batch_id: str
    created_at: datetime
    updated_at: datetime
    reviewers: List[str] = []
    notes: List[ReviewNote] = []
    conclusion: Optional[str] = None
    recommendations: List[str] = []


class AnalysisResult(BaseModel):
    batch_id: str
    analysis_time: datetime
    curve_name: str
    phase_deviations: List[PhaseDeviation]
    heat_integrals: List[HeatIntegral]
    risk_assessment: BatchRiskAssessment
    metadata: Dict[str, Any] = {}
