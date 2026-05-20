from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TestProtocolBase(BaseModel):
    protocol_name: str
    product_name: str
    batch_number: str
    conditions: Dict[str, Any]
    sampling_points: List[Dict[str, Any]]


class TestProtocolCreate(TestProtocolBase):
    pass


class TestProtocolResponse(TestProtocolBase):
    id: str
    created_at: datetime
    updated_at: datetime
    status: str

    class Config:
        from_attributes = True


class SampleBase(BaseModel):
    sample_id: str
    sampling_point: str
    planned_sampling_date: datetime
    actual_sampling_date: Optional[datetime] = None
    condition: str
    storage_location: str
    test_results: Optional[Dict[str, Any]] = None


class SampleCreate(SampleBase):
    protocol_id: str


class SampleResponse(SampleBase):
    id: str
    protocol_id: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChamberRecordBase(BaseModel):
    chamber_id: str
    chamber_name: str
    record_time: datetime
    temperature: float
    humidity: float
    target_temperature: float
    target_humidity: float
    is_alert: bool = False
    alert_type: Optional[str] = None


class ChamberRecordCreate(ChamberRecordBase):
    pass


class ChamberRecordResponse(ChamberRecordBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class DiscrepancyDetail(BaseModel):
    type: str
    source: str
    description: str
    severity: str
    evidence: Optional[Dict[str, Any]] = None


class ReconciliationRecordBase(BaseModel):
    protocol_id: str
    sample_id: str
    reconciliation_batch_id: str


class ReconciliationRecordCreate(ReconciliationRecordBase):
    pass


class ReconciliationRecordResponse(ReconciliationRecordBase):
    id: str
    status: str
    discrepancy_type: Optional[str] = None
    discrepancy_source: Optional[str] = None
    discrepancy_description: Optional[str] = None
    is_resolved: bool
    resolution_note: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    review_comments: Optional[List[Dict[str, Any]]] = None
    calculation_details: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReconciliationReviewRequest(BaseModel):
    reconciliation_id: str
    review_comment: str
    is_resolved: bool = False
    resolution_note: Optional[str] = None
    updated_calculations: Optional[Dict[str, Any]] = None
    reviewer: str


class ReconciliationResult(BaseModel):
    reconciliation_id: str
    sample_id: str
    sampling_point: str
    status: str
    discrepancies: List[DiscrepancyDetail]
    calculation_summary: Dict[str, Any]


class ReconciliationBatchResponse(BaseModel):
    batch_id: str
    protocol_id: str
    total_samples: int
    matched_samples: int
    discrepancy_count: int
    resolved_count: int
    results: List[ReconciliationResult]
    generated_at: datetime


class AuditLogResponse(BaseModel):
    id: str
    reconciliation_id: str
    action: str
    field_changed: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    performed_by: str
    performed_at: datetime
    comment: Optional[str] = None

    class Config:
        from_attributes = True


class ReportGenerateRequest(BaseModel):
    protocol_id: str
    reconciliation_batch_id: str
    report_type: str = "summary"
    generated_by: str


class ReportResponse(BaseModel):
    id: str
    report_type: str
    protocol_id: str
    reconciliation_batch_id: str
    generated_by: str
    generated_at: datetime
    file_path: str
    status: str
    summary_data: Dict[str, Any]

    class Config:
        from_attributes = True


class TraceRecord(BaseModel):
    level: str
    type: str
    id: str
    description: str
    timestamp: datetime
    details: Dict[str, Any]


class TraceResponse(BaseModel):
    sample_id: str
    trace_path: List[TraceRecord]
