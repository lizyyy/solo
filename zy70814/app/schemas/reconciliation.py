from datetime import datetime
from typing import Optional, List
from app.schemas.common import BaseSchema


class ReconciliationRecordBase(BaseSchema):
    vessel_name: str
    vessel_imo: Optional[str] = None
    voyage_number: Optional[str] = None
    berth_number: Optional[str] = None
    draft: Optional[float] = None
    available_depth: Optional[float] = None
    depth_margin: Optional[float] = None
    arrival_time: Optional[datetime] = None
    departure_time: Optional[datetime] = None
    planned_berth_time: Optional[datetime] = None


class DiscrepancyLogResponse(BaseSchema):
    id: int
    discrepancy_type: str
    severity: str
    field_name: Optional[str] = None
    expected_value: Optional[str] = None
    actual_value: Optional[str] = None
    description: Optional[str] = None
    explanation: Optional[str] = None
    is_resolved: bool
    resolution_notes: Optional[str] = None
    created_at: datetime


class ReviewHistoryResponse(BaseSchema):
    id: int
    action: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    reviewer: Optional[str] = None
    review_notes: Optional[str] = None
    field_changes: Optional[str] = None
    created_at: datetime


class ReconciliationRecordResponse(ReconciliationRecordBase):
    id: int
    batch_id: str
    status: str
    has_discrepancy: bool
    discrepancy_count: int
    is_reviewed: bool
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    review_decision: Optional[str] = None
    override_reason: Optional[str] = None
    
    discrepancies: List[DiscrepancyLogResponse] = []
    review_history: List[ReviewHistoryResponse] = []
    created_at: datetime
    updated_at: datetime


class ReconciliationBatchResponse(BaseSchema):
    id: int
    batch_id: str
    name: Optional[str] = None
    status: str
    total_records: int
    passed_records: int
    failed_records: int
    warning_records: int
    checked_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    created_by: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ReconciliationResult(BaseSchema):
    batch_id: str
    total_records: int
    passed_count: int
    failed_count: int
    warning_count: int
    records: List[ReconciliationRecordResponse]


class ReviewRequest(BaseSchema):
    decision: str
    notes: Optional[str] = None
    reviewer: Optional[str] = None
    override_reason: Optional[str] = None


class BatchReviewRequest(BaseSchema):
    record_ids: List[int]
    decision: str
    notes: Optional[str] = None
    reviewer: Optional[str] = None


class DiscrepancyResolveRequest(BaseSchema):
    resolution_notes: str
    resolved_by: Optional[str] = None
