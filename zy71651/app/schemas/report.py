from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import Field

from .base import BaseSchema, TimestampMixin


class ReportSummary(BaseSchema):
    project_name: str
    student_name: Optional[str]
    generated_at: datetime
    params_version: int

    total_mass_g: float
    support_mass_g: float
    support_ratio: float
    print_time_hours: float
    filament_length_m: float

    quality_score: float
    anomaly_count: int
    critical_anomaly_count: int
    confidence_score: float

    can_print: bool
    warnings: List[str]


class ReportSection(BaseSchema):
    title: str
    order: int
    content: Dict[str, Any]


class ReportChart(BaseSchema):
    chart_type: str
    title: str
    data: Dict[str, Any]
    explanation: str


class ReportDetailItem(BaseSchema):
    label: str
    value: Any
    unit: Optional[str]
    formula: Optional[str]
    explanation: Optional[str]
    data_source: Optional[str]


class EstimationReportRequest(BaseSchema):
    task_id: int = Field(..., description="任务ID")
    report_type: str = Field("full", description="报告类型: full, simple, material_only, time_only")
    format: str = Field("json", description="报告格式: json, html, pdf")
    params_version: Optional[int] = Field(None, description="参数版本")


class EstimationReportResponse(TimestampMixin):
    id: int
    task_id: int
    params_version: int
    estimation_id: Optional[int]

    report_type: str
    format: str
    file_path: Optional[str]
    file_name: Optional[str]

    summary: ReportSummary
    sections: List[ReportSection]
    charts: List[ReportChart]
    detail_items: List[ReportDetailItem]
    anomalies: List[Dict[str, Any]]

    generated_by: Optional[str]
    generation_time_ms: Optional[int]
    is_latest: bool
    notes: Optional[str]
