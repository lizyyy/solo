from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models.models import BatchStatus, StageType


class ImportBatchCreate(BaseModel):
    batch_no: str = Field(..., max_length=64)
    source_system: str = Field(..., max_length=64)
    import_type: str = Field(..., max_length=64)
    idempotent_key: str = Field(..., max_length=128)
    created_by: Optional[str] = Field(None, max_length=64)
    extra_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ImportBatchResponse(BaseModel):
    id: int
    batch_no: str
    source_system: str
    import_type: str
    total_count: int
    success_count: int
    failed_count: int
    status: BatchStatus
    current_stage: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    extra_metadata: Dict[str, Any]

    class Config:
        from_attributes = True


class ImportItemCreate(BaseModel):
    item_no: str = Field(..., max_length=64)
    item_type: str = Field(..., max_length=64)
    source_data: Dict[str, Any]


class BatchImportRequest(BaseModel):
    batch: ImportBatchCreate
    items: List[ImportItemCreate]


class StageRecordResponse(BaseModel):
    id: int
    stage: StageType
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    metrics: Dict[str, Any]

    class Config:
        from_attributes = True


class WriteDetailResponse(BaseModel):
    id: int
    table_name: str
    record_id: str
    operation_type: str
    written_at: datetime
    rollback_status: str

    class Config:
        from_attributes = True


class ImportItemDetailResponse(BaseModel):
    id: int
    item_no: str
    item_type: str
    status: str
    error_message: Optional[str]
    write_details: List[WriteDetailResponse]

    class Config:
        from_attributes = True


class BatchDetailResponse(ImportBatchResponse):
    items: List[ImportItemDetailResponse]
    stage_records: List[StageRecordResponse]


class RollbackPlanRequest(BaseModel):
    reason: str
    strategy: str = "reverse_order"


class RollbackPlanResponse(BaseModel):
    id: int
    batch_id: int
    reason: str
    status: str
    total_operations: int
    completed_operations: int
    failed_operations: int

    class Config:
        from_attributes = True


class RollbackReportResponse(BaseModel):
    id: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    status: str
    summary: Dict[str, Any]
    details: List[Dict[str, Any]]

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class BatchStatusUpdateRequest(BaseModel):
    status: BatchStatus
    stage: Optional[StageType] = None
    error_message: Optional[str] = None


class BatchQueryParams(BaseModel):
    source_system: Optional[str] = None
    import_type: Optional[str] = None
    status: Optional[BatchStatus] = None
    created_by: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = 1
    page_size: int = 20
