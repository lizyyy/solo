from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class QualityInspectionBase(BaseModel):
    inspection_no: str
    customer_id: Optional[str] = None
    service_type: Optional[str] = None
    inspector: Optional[str] = None
    inspection_time: Optional[datetime] = None
    is_late_submit: bool = False
    content: Optional[Dict[str, Any]] = None
    raw_data: Optional[Dict[str, Any]] = None


class QualityInspectionCreate(QualityInspectionBase):
    pass


class QualityInspection(QualityInspectionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CustomerServiceDialogBase(BaseModel):
    dialog_id: str
    customer_id: Optional[str] = None
    agent_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_late_supplement: bool = False
    supplement_time: Optional[datetime] = None
    content: Optional[Dict[str, Any]] = None
    raw_data: Optional[Dict[str, Any]] = None
    inspection_id: Optional[int] = None


class CustomerServiceDialogCreate(CustomerServiceDialogBase):
    pass


class CustomerServiceDialog(CustomerServiceDialogBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class KnowledgeBaseEntryBase(BaseModel):
    entry_id: str
    title: Optional[str] = None
    category: Optional[str] = None
    version: Optional[str] = None
    is_manual_modified: bool = False
    modified_time: Optional[datetime] = None
    modifier: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    raw_data: Optional[Dict[str, Any]] = None


class KnowledgeBaseEntryCreate(KnowledgeBaseEntryBase):
    pass


class KnowledgeBaseEntry(KnowledgeBaseEntryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChangeHistoryBase(BaseModel):
    sample_id: int
    change_type: str
    field_name: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    operator: Optional[str] = None
    remark: Optional[str] = None
    change_source: Optional[str] = None


class ChangeHistoryCreate(ChangeHistoryBase):
    pass


class ChangeHistory(ChangeHistoryBase):
    id: int
    operation_time: datetime
    version_hash: str
    model_config = ConfigDict(from_attributes=True)


class FilterConditionBase(BaseModel):
    conditions: Dict[str, Any]
    page: int = 1
    page_size: int = 50
    sort_by: Optional[str] = None
    sort_order: str = "desc"
    total_count: int = 0
    created_by: Optional[str] = None


class FilterConditionCreate(FilterConditionBase):
    pass


class FilterCondition(FilterConditionBase):
    id: int
    condition_hash: str
    created_at: datetime
    last_used_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReviewSampleBase(BaseModel):
    sample_batch_no: Optional[str] = None
    sample_date: Optional[datetime] = None
    sampler: Optional[str] = None
    reviewer: Optional[str] = None
    review_status: str = "pending"
    anomaly_type: Optional[str] = None
    is_anomaly: bool = False
    conclusion: Optional[str] = None
    evidence_summary: Optional[str] = None
    inspection_id: Optional[int] = None
    dialog_id: Optional[int] = None
    knowledge_entry_id: Optional[int] = None
    filter_condition_id: Optional[int] = None


class ReviewSampleCreate(ReviewSampleBase):
    pass


class ReviewSampleUpdate(BaseModel):
    review_status: Optional[str] = None
    anomaly_type: Optional[str] = None
    is_anomaly: Optional[bool] = None
    conclusion: Optional[str] = None
    evidence_summary: Optional[str] = None
    reviewer: Optional[str] = None


class ReviewSample(ReviewSampleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    inspection: Optional[QualityInspection] = None
    dialog: Optional[CustomerServiceDialog] = None
    knowledge_entry: Optional[KnowledgeBaseEntry] = None
    change_histories: List[ChangeHistory] = []
    model_config = ConfigDict(from_attributes=True)


class ReviewSampleWithTrace(ReviewSample):
    source_type: Optional[str] = None
    source_link: Optional[Dict[str, Any]] = None
    data_timeline: Optional[List[Dict[str, Any]]] = None


class BatchTaskBase(BaseModel):
    task_name: str
    params: Optional[Dict[str, Any]] = None
    operator: Optional[str] = None


class BatchTaskCreate(BatchTaskBase):
    idempotency_key: str


class BatchTask(BatchTaskBase):
    id: int
    idempotency_key: str
    status: str
    total_count: int
    success_count: int
    failed_count: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ExportRecordBase(BaseModel):
    export_type: str = "weekly_report"
    filter_condition_id: Optional[int] = None
    exported_by: Optional[str] = None


class ExportRecordCreate(ExportRecordBase):
    pass


class ExportRecord(ExportRecordBase):
    id: int
    export_no: str
    file_name: str
    file_path: str
    record_count: int
    exported_at: datetime
    snapshot_hash: str
    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
    filter_condition_id: Optional[int] = None
    condition_hash: Optional[str] = None


class TraceResponse(BaseModel):
    sample_id: int
    conclusion: str
    evidence_summary: str
    data_sources: List[Dict[str, Any]]
    change_history: List[Dict[str, Any]]
    data_timeline: List[Dict[str, Any]]
