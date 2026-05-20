from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator

from app.models import AnomalyStatus, SeverityLevel


class DeviceMetricBase(BaseModel):
    device_id: str
    metric_name: str
    metric_value: float
    unit: Optional[str] = None
    previous_value: Optional[float] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class DeviceMetricCreate(DeviceMetricBase):
    pass


class DeviceMetric(DeviceMetricBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class AnomalyRuleBase(BaseModel):
    rule_name: str
    rule_type: str
    metric_name: str
    threshold_min: Optional[float] = None
    threshold_max: Optional[float] = None
    operator: str = ">"
    severity: SeverityLevel = SeverityLevel.MEDIUM
    aggregation_window: int = 1
    enabled: bool = True
    description: Optional[str] = None


class AnomalyRuleCreate(AnomalyRuleBase):
    pass


class AnomalyRuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    enabled: Optional[bool] = None
    threshold_min: Optional[float] = None
    threshold_max: Optional[float] = None
    severity: Optional[SeverityLevel] = None


class AnomalyRule(AnomalyRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConfirmationHistoryBase(BaseModel):
    operator_id: str
    operator_name: str
    previous_status: Optional[str] = None
    new_status: str
    comment: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ConfirmationHistoryCreate(ConfirmationHistoryBase):
    pass


class ConfirmationHistory(ConfirmationHistoryBase):
    id: int
    anomaly_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class IgnoreReasonBase(BaseModel):
    operator_id: str
    operator_name: str
    reason_category: str
    reason_detail: Optional[str] = None
    is_permanent: bool = False
    auto_ignore_similar: bool = False


class IgnoreReasonCreate(IgnoreReasonBase):
    pass


class IgnoreReason(IgnoreReasonBase):
    id: int
    anomaly_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class TicketLinkBase(BaseModel):
    ticket_system: str = "internal"
    ticket_id: str
    ticket_url: Optional[str] = None
    ticket_title: Optional[str] = None
    ticket_status: str = "open"
    operator_id: str
    operator_name: str


class TicketLinkCreate(TicketLinkBase):
    pass


class TicketLink(TicketLinkBase):
    id: int
    anomaly_id: int
    linked_at: datetime
    synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RecoveryEventBase(BaseModel):
    recovered_value: Optional[float] = None
    recovery_method: Optional[str] = None
    recovery_details: Optional[str] = None
    auto_closed: bool = False


class RecoveryEventCreate(RecoveryEventBase):
    pass


class RecoveryEvent(RecoveryEventBase):
    id: int
    anomaly_id: int
    detected_at: datetime

    class Config:
        from_attributes = True


class AnomalyRecordBase(BaseModel):
    device_id: str
    title: str
    description: Optional[str] = None
    severity: SeverityLevel
    current_value: Optional[float] = None
    previous_value: Optional[float] = None
    threshold_value: Optional[float] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class AnomalyRecordCreate(AnomalyRecordBase):
    idempotency_key: Optional[str] = None
    metric_id: Optional[int] = None
    rule_id: Optional[int] = None


class AnomalyRecordUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[SeverityLevel] = None
    status: Optional[AnomalyStatus] = None


class StatusTransition(BaseModel):
    new_status: AnomalyStatus
    operator_id: str
    operator_name: str
    comment: Optional[str] = None
    reason_category: Optional[str] = None
    reason_detail: Optional[str] = None
    ticket_id: Optional[str] = None
    ticket_url: Optional[str] = None
    ticket_title: Optional[str] = None


class AnomalyRecord(AnomalyRecordBase):
    id: int
    status: AnomalyStatus
    metric_id: Optional[int] = None
    rule_id: Optional[int] = None
    detected_at: datetime
    confirmed_at: Optional[datetime] = None
    recovered_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    confirmations: List[ConfirmationHistory] = Field(default_factory=list)
    ignore_reasons: List[IgnoreReason] = Field(default_factory=list)
    tickets: List[TicketLink] = Field(default_factory=list)
    recovery_events: List[RecoveryEvent] = Field(default_factory=list)

    class Config:
        from_attributes = True


class AnomalyListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[AnomalyRecord]


class CompensationTaskBase(BaseModel):
    anomaly_id: Optional[int] = None
    task_type: str
    task_description: Optional[str] = None


class CompensationTaskCreate(CompensationTaskBase):
    pass


class CompensationTask(CompensationTaskBase):
    id: int
    status: str
    retry_count: int
    max_retries: int
    last_error: Optional[str] = None
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    anomaly_ids: Optional[List[int]] = None
    status: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    format: str = "xlsx"


class BatchActionRequest(BaseModel):
    anomaly_ids: List[int]
    action: str
    operator_id: str
    operator_name: str
    comment: Optional[str] = None
