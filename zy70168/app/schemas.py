from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models import (
    EventStatus, SnapshotSource, AlertStatus, RankingType, CorrectionSource
)


class EventCreate(BaseModel):
    event_id: str = Field(..., description="事件唯一ID，用于幂等性")
    event_time: datetime = Field(..., description="事件发生时间（核心入口）")
    metric_name: str = Field(..., description="指标名称")
    metric_value: float = Field(..., description="指标值")
    entity_id: str = Field(..., description="实体ID")
    dimensions: Optional[Dict[str, Any]] = Field(default={}, description="维度信息")


class EventResponse(BaseModel):
    id: str
    event_time: datetime
    ingest_time: datetime
    metric_name: str
    metric_value: float
    entity_id: str
    dimensions: Dict[str, Any]
    status: EventStatus
    is_late: bool
    latency_seconds: Optional[int]

    class Config:
        from_attributes = True


class LatencyWindowCreate(BaseModel):
    metric_name: str
    window_seconds: int
    description: Optional[str] = None


class LatencyWindowResponse(BaseModel):
    id: int
    metric_name: str
    window_seconds: int
    description: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class MetricSnapshotResponse(BaseModel):
    id: int
    snapshot_time: datetime
    metric_name: str
    entity_id: str
    bucket_time: datetime
    value: float
    version: int
    source: SnapshotSource
    is_latest: bool
    is_manual_overridden: bool
    event_ids: List[str]

    class Config:
        from_attributes = True


class AlertResponse(BaseModel):
    id: int
    alert_id: str
    metric_name: str
    entity_id: str
    alert_time: datetime
    bucket_time: datetime
    threshold: float
    original_value: float
    current_value: float
    alert_type: str
    status: AlertStatus
    revoked_time: Optional[datetime]
    revoke_reason: Optional[str]

    class Config:
        from_attributes = True


class RankingResponse(BaseModel):
    id: int
    ranking_type: RankingType
    metric_name: str
    ranking_date: datetime
    entity_id: str
    rank: int
    value: float
    version: int
    is_latest: bool
    is_replayed: bool

    class Config:
        from_attributes = True


class CorrectionReportResponse(BaseModel):
    id: int
    report_id: str
    correction_time: datetime
    metric_name: str
    entity_id: str
    event_time: Optional[datetime]
    bucket_time: datetime
    original_value: float
    new_value: float
    source: CorrectionSource
    affected_alerts: List[int]
    affected_rankings: List[int]
    operator: Optional[str]
    reason: Optional[str]

    class Config:
        from_attributes = True


class ManualCorrectionRequest(BaseModel):
    metric_name: str
    entity_id: str
    bucket_time: datetime
    new_value: float
    operator: Optional[str] = None
    reason: Optional[str] = None


class AlertRevokeRequest(BaseModel):
    alert_id: str
    reason: str


class RankingReplayRequest(BaseModel):
    ranking_type: RankingType
    metric_name: str
    ranking_date: datetime


class ProcessResult(BaseModel):
    event_id: str
    status: EventStatus
    is_late: bool
    message: str
    snapshot: Optional[MetricSnapshotResponse] = None
    triggered_alerts: List[AlertResponse] = []
    triggered_reports: List[CorrectionReportResponse] = []


class QueryParams(BaseModel):
    metric_name: Optional[str] = None
    entity_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = 100
    offset: int = 0
