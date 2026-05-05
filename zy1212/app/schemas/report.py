from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class ReportFormatEnum(str, Enum):
    markdown = "markdown"
    json = "json"


class ReportTypeEnum(str, Enum):
    batch_summary = "batch_summary"
    baseline_comparison = "baseline_comparison"
    project_summary = "project_summary"
    optimization_tracking = "optimization_tracking"
    full_review = "full_review"


class ReportGenerateRequest(BaseModel):
    report_type: ReportTypeEnum
    format: ReportFormatEnum = Field(default=ReportFormatEnum.markdown)
    project_id: Optional[int] = Field(None, ge=1)
    batch_ids: Optional[List[int]] = Field(None)
    baseline_batch_id: Optional[int] = Field(None, ge=1)
    current_batch_id: Optional[int] = Field(None, ge=1)
    include_sections: Optional[List[str]] = Field(
        default=None,
        description="要包含的章节，默认包含所有"
    )
    slo_criteria: Optional["SLOCriteria"] = None


class BatchReportSection(BaseModel):
    section_title: str
    content: Dict[str, Any]


class BatchReport(BaseModel):
    project_name: str
    batch_name: str
    batch_number: int
    test_type: str
    environment: str
    test_period: str
    
    summary: Dict[str, Any]
    
    metrics: Dict[str, Any]
    
    monitoring_snapshots: List[Dict[str, Any]]
    
    slo_evaluation: Optional[Dict[str, Any]]
    
    bottleneck_analysis: Optional[List[Dict[str, Any]]]
    
    related_actions: Optional[List[Dict[str, Any]]]
    
    recommendations: List[str]
    
    generated_at: datetime


class BaselineComparisonReport(BaseModel):
    project_name: str
    
    baseline_batch: Dict[str, Any]
    current_batch: Dict[str, Any]
    
    metric_comparisons: List[Dict[str, Any]]
    
    overall_status: str
    
    key_findings: List[str]
    
    improvements: List[Dict[str, Any]]
    regressions: List[Dict[str, Any]]
    
    recommendations: List[str]
    next_steps: List[str]
    
    generated_at: datetime


class ProjectSummaryReport(BaseModel):
    project_name: str
    service_name: str
    environment: str
    
    overview: Dict[str, Any]
    
    batches_summary: Dict[str, Any]
    
    capacity_summary: Dict[str, Any]
    
    optimization_progress: Dict[str, Any]
    
    key_metrics_trend: List[Dict[str, Any]]
    
    slo_compliance: Dict[str, Any]
    
    risks_and_challenges: List[str]
    achievements: List[str]
    
    recommendations: List[str]
    
    generated_at: datetime


class OptimizationTrackingReport(BaseModel):
    project_name: str
    
    summary: Dict[str, Any]
    
    pending_actions: List[Dict[str, Any]]
    in_progress_actions: List[Dict[str, Any]]
    completed_actions: List[Dict[str, Any]]
    verified_actions: List[Dict[str, Any]]
    
    action_details: List[Dict[str, Any]]
    
    timeline: List[Dict[str, Any]]
    
    overdue_issues: List[Dict[str, Any]]
    
    recommendations: List[str]
    
    generated_at: datetime


class FullReviewReport(BaseModel):
    project_name: str
    service_name: str
    environment: str
    
    review_period: str
    
    overview: Dict[str, Any]
    
    test_executions: Dict[str, Any]
    
    performance_analysis: Dict[str, Any]
    
    capacity_assessment: Dict[str, Any]
    
    slo_compliance: Dict[str, Any]
    
    bottleneck_analysis: List[Dict[str, Any]]
    
    optimization_tracking: Dict[str, Any]
    
    key_learnings: List[str]
    
    action_items: List[Dict[str, Any]]
    
    next_round_plan: Dict[str, Any]
    
    recommendations: List[str]
    
    generated_at: datetime


class ReportExportResult(BaseModel):
    success: bool
    format: str
    content: str
    filename: str
    generated_at: datetime
