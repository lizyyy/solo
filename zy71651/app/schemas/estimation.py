from typing import Optional, Dict, Any, List
from pydantic import Field

from .base import BaseSchema, TimestampMixin
from ..models.enums import AnomalyType, AnomalySeverity


class CalculationStep(BaseSchema):
    step: str
    formula: str
    inputs: Dict[str, Any]
    result: float
    unit: str
    explanation: str


class TimeBreakdown(BaseSchema):
    travel_time_min: float
    print_time_min: float
    retraction_time_min: float
    cooling_time_min: float
    setup_time_min: float


class SupportEstimationRequest(BaseSchema):
    task_id: int = Field(..., description="任务ID")
    params_version: Optional[int] = Field(None, description="参数版本")
    analysis_result_id: Optional[int] = Field(None, description="分析结果ID")
    material_id: Optional[int] = Field(None, description="材料ID，覆盖参数中的材料")


class SupportEstimationResponse(TimestampMixin):
    id: int
    task_id: int
    params_version: int
    material_id: Optional[int]
    analysis_result_id: Optional[int]

    part_mass_g: Optional[float]
    part_volume_cm3: Optional[float]

    support_mass_g: Optional[float]
    support_volume_cm3: Optional[float]
    support_material_ratio: Optional[float]

    total_mass_g: Optional[float]
    total_volume_cm3: Optional[float]

    filament_length_m: Optional[float]
    filament_cost_estimate: Optional[float]

    print_time_hours: Optional[float]
    print_time_minutes: Optional[float]
    time_breakdown: TimeBreakdown

    layer_count: Optional[int]
    total_lines: Optional[int]

    time_correction_factor: float
    is_time_underestimated: bool

    confidence_score: Optional[float]
    calculation_steps: List[CalculationStep]
    calculation_details: Dict[str, Any]
    notes: Optional[str]


class AnomalyResponse(TimestampMixin):
    id: int
    task_id: int
    anomaly_type: AnomalyType
    severity: AnomalySeverity

    title: str
    description: str
    suggestion: Optional[str]
    location: Optional[str]

    affected_value: Optional[float]
    expected_range: Optional[str]
    data_source: Optional[str]

    params_version: Optional[int]
    analysis_result_id: Optional[int]
    estimation_id: Optional[int]

    is_resolved: bool
    resolution_notes: Optional[str]
    metadata: Dict[str, Any]


class AnomalyResolveRequest(BaseSchema):
    resolution_notes: Optional[str] = None
