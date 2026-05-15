from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class EventBase(BaseModel):
    event_id: str
    original_data: Dict[str, Any]


class EventCreate(EventBase):
    pass


class EventResponse(EventBase):
    id: int
    batch_id: str
    raw_status: Optional[str]
    final_status: Optional[str]
    risk_level: Optional[str]
    risk_score: Optional[float]
    is_merged: bool
    merged_into_event_id: Optional[int]
    corrections: Optional[List[str]]
    processing_notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class EventDetailResponse(EventResponse):
    merged_events: Optional[List[EventResponse]] = None


class BatchBase(BaseModel):
    batch_id: str
    source: str
    description: Optional[str] = None


class BatchCreate(BatchBase):
    events: List[EventCreate]


class BatchResponse(BatchBase):
    id: int
    batch_hash: str
    total_events: int
    rule_version: str
    processing_status: str
    processing_started_at: Optional[datetime]
    processing_completed_at: Optional[datetime]
    processing_duration_ms: Optional[float]
    created_at: datetime
    
    class Config:
        from_attributes = True


class BatchDetailResponse(BatchResponse):
    events: List[EventResponse]
    reports: Optional[List["ProcessingReportResponse"]] = None


class ConvergenceRuleBase(BaseModel):
    version: str
    rule_name: str
    description: Optional[str] = None
    success_conditions: Dict[str, Any]
    failure_conditions: Dict[str, Any]
    risk_weightings: Dict[str, Any]


class ConvergenceRuleCreate(ConvergenceRuleBase):
    is_active: bool = True


class ConvergenceRuleResponse(ConvergenceRuleBase):
    id: int
    is_active: bool
    created_at: datetime
    created_by: str
    
    class Config:
        from_attributes = True


class ProcessingReportBase(BaseModel):
    report_type: str
    before_summary: Dict[str, Any]
    after_summary: Dict[str, Any]
    comparison_details: Dict[str, Any]
    execution_time_ms: float
    next_steps: List[Dict[str, Any]]
    summary_stats: Dict[str, Any]


class ProcessingReportResponse(ProcessingReportBase):
    id: int
    batch_id: str
    generated_at: datetime
    
    class Config:
        from_attributes = True


class OutsourcingAcceptanceBase(BaseModel):
    event_id: int
    original_value: Dict[str, Any]
    corrected_value: Dict[str, Any]
    correction_reason: str
    risk_level: str


class OutsourcingAcceptanceResponse(OutsourcingAcceptanceBase):
    id: int
    batch_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class BatchSubmitResponse(BaseModel):
    batch_id: str
    status: str
    message: str
    is_duplicate: bool
    existing_result: Optional[BatchDetailResponse] = None
    conflict_details: Optional[Dict[str, Any]] = None


class RiskLevelQueryResponse(BaseModel):
    risk_level: str
    total_count: int
    events: List[EventResponse]


class AuditLogResponse(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: str
    old_value: Optional[Dict[str, Any]]
    new_value: Optional[Dict[str, Any]]
    changed_by: str
    changed_at: datetime
    notes: Optional[str]
    
    class Config:
        from_attributes = True


class ExportResultResponse(BaseModel):
    batch_id: str
    export_type: str
    data: Dict[str, Any]


BatchDetailResponse.model_rebuild()
