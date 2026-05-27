from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum

from .models import DiscrepancyType, DataSource, ReviewStatus, ReconciliationStatus


class AlarmBase(BaseModel):
    alarm_id: str
    pole_id: str
    light_id: str
    alarm_type: str
    alarm_level: str
    alarm_time: datetime
    description: str
    status: str
    source_file: str
    is_false_alarm: bool = False
    false_alarm_reason: Optional[str] = None


class AlarmCreate(AlarmBase):
    pass


class Alarm(AlarmBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionBase(BaseModel):
    inspection_id: str
    pole_id: str
    light_id: str
    inspector: str
    inspection_time: datetime
    status: str
    issues_found: str
    photos: Optional[str] = None
    source_file: str


class InspectionCreate(InspectionBase):
    pass


class Inspection(InspectionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class WorkOrderBase(BaseModel):
    order_id: str
    pole_id: str
    light_id: str
    alarm_id: Optional[str] = None
    repair_type: str
    reporter: str
    report_time: datetime
    repairer: Optional[str] = None
    repair_time: Optional[datetime] = None
    repair_content: Optional[str] = None
    status: str
    is_retest: bool = False
    retest_result: Optional[str] = None
    source_file: str


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrder(WorkOrderBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DiscrepancyBase(BaseModel):
    type: DiscrepancyType
    description: str
    source: DataSource
    is_resolved: bool = False
    resolved_reason: Optional[str] = None


class DiscrepancyCreate(DiscrepancyBase):
    pass


class Discrepancy(DiscrepancyBase):
    id: int
    record_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewHistoryBase(BaseModel):
    reviewer: str
    status: ReviewStatus
    comment: str
    explanation: str


class ReviewHistoryCreate(ReviewHistoryBase):
    pass


class ReviewHistory(ReviewHistoryBase):
    id: int
    record_id: int
    review_time: datetime

    class Config:
        from_attributes = True


class ReconciliationRecordBase(BaseModel):
    reconciliation_id: str
    pole_id: str
    light_id: str
    status: ReconciliationStatus = ReconciliationStatus.DISCREPANCY
    review_status: ReviewStatus = ReviewStatus.PENDING


class ReconciliationRecordCreate(ReconciliationRecordBase):
    alarm_id: Optional[int] = None
    inspection_id: Optional[int] = None
    work_order_id: Optional[int] = None


class ReconciliationRecord(ReconciliationRecordBase):
    id: int
    alarm: Optional[Alarm] = None
    inspection: Optional[Inspection] = None
    work_order: Optional[WorkOrder] = None
    discrepancies: List[Discrepancy] = []
    review_histories: List[ReviewHistory] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReconciliationBatchBase(BaseModel):
    batch_id: str
    name: str
    description: Optional[str] = None
    created_by: str


class ReconciliationBatchCreate(ReconciliationBatchBase):
    pass


class ReconciliationBatch(ReconciliationBatchBase):
    id: int
    status: str
    total_records: int
    matched_count: int
    discrepancy_count: int
    reviewed_count: int
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReviewRequest(BaseModel):
    record_id: int
    reviewer: str
    status: ReviewStatus
    comment: str
    explanation: str
    resolve_discrepancies: List[int] = Field(default_factory=list)


class ReconciliationResult(BaseModel):
    batch_id: str
    total_records: int
    matched_count: int
    discrepancy_count: int
    pending_review: int
    records: List[ReconciliationRecord]


class TraceDetail(BaseModel):
    record_id: int
    reconciliation_id: str
    pole_id: str
    light_id: str
    status: ReconciliationStatus
    review_status: ReviewStatus
    alarm: Optional[Alarm] = None
    inspection: Optional[Inspection] = None
    work_order: Optional[WorkOrder] = None
    discrepancies: List[Discrepancy] = []
    review_histories: List[ReviewHistory] = []


class ReportSummary(BaseModel):
    batch_id: str
    batch_name: str
    generated_at: datetime
    total_records: int
    matched_count: int
    discrepancy_count: int
    reviewed_count: int
    approved_count: int
    rejected_count: int
    needs_more_info_count: int
    discrepancy_by_type: dict


class ImportResult(BaseModel):
    source_type: str
    file_name: str
    imported_count: int
    failed_count: int
    errors: List[str] = []
