from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"


class Group(BaseModel):
    id: str
    name: str
    traffic_ratio: float = Field(ge=0, le=100)
    is_control: bool = False
    description: Optional[str] = None


class Metric(BaseModel):
    id: str
    name: str
    definition: str
    unit: str
    is_primary: bool = False


class MutexRule(BaseModel):
    id: str
    name: str
    rule_type: str
    conditions: List[str]
    is_valid: bool = True
    error_message: Optional[str] = None


class ReportData(BaseModel):
    group_id: str
    metric_id: str
    value: float
    sample_size: int
    confidence_interval: Optional[List[float]] = None
    p_value: Optional[float] = None
    is_significant: bool = False


class ExperimentReport(BaseModel):
    id: str
    experiment_id: str
    generated_at: datetime
    data: List[ReportData]
    is_valid: bool = True


class Experiment(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: ExperimentStatus = ExperimentStatus.DRAFT
    groups: List[Group]
    metrics: List[Metric]
    mutex_rules: List[MutexRule]
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    report: Optional[ExperimentReport] = None
    need_recalculation: bool = False


class ExperimentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    groups: List[Group]
    metrics: List[Metric]
    mutex_rules: List[MutexRule]


class ExperimentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ExperimentStatus] = None
    groups: Optional[List[Group]] = None
    metrics: Optional[List[Metric]] = None
    mutex_rules: Optional[List[MutexRule]] = None


class CorrectionRequest(BaseModel):
    experiment_id: str
    corrections: Dict[str, Any]
    reason: str


class ExportRequest(BaseModel):
    experiment_id: str
    format: str = "json"
    include_report: bool = True
