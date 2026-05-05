from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.enums import AnalysisType, SeverityLevel


class ComparisonRequest(BaseModel):
    task_ids: List[int] = Field(..., min_length=2, max_length=5, description="要对比的任务ID列表")
    analysis_types: Optional[List[AnalysisType]] = Field(None, description="指定要对比的分析类型，为空则对比全部")
    include_metrics: Optional[bool] = Field(True, description="是否包含指标数据")
    include_recommendations: Optional[bool] = Field(True, description="是否包含建议")


class MetricComparison(BaseModel):
    metric_name: str
    task_values: Dict[int, Any]
    improvement: Optional[float]
    trend: str


class FindingComparison(BaseModel):
    finding_id: str
    title: str
    severity: SeverityLevel
    present_in_tasks: List[int]
    description: Optional[str]


class ComparisonSummary(BaseModel):
    total_tasks_compared: int
    analysis_types_compared: List[str]
    total_findings: int
    critical_findings: int
    high_findings: int
    common_findings: List[FindingComparison]
    unique_findings: Dict[int, List[FindingComparison]]
    key_metrics: List[MetricComparison]
    overall_score: Optional[Dict[int, float]]


class ComparisonResponse(BaseModel):
    comparison_id: str
    task_ids: List[int]
    task_names: Dict[int, str]
    summary: ComparisonSummary
    detailed_comparison: Dict[AnalysisType, Any]
    generated_at: datetime
