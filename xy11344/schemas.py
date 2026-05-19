from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class PaperBatchBase(BaseModel):
    batch_number: str
    paper_type: str
    supplier: Optional[str] = None
    weight: Optional[float] = None
    thickness: Optional[float] = None
    notes: Optional[str] = None


class PaperBatchCreate(PaperBatchBase):
    received_date: Optional[datetime] = None


class PaperBatchUpdate(BaseModel):
    paper_type: Optional[str] = None
    supplier: Optional[str] = None
    weight: Optional[float] = None
    thickness: Optional[float] = None
    notes: Optional[str] = None


class PaperBatch(PaperBatchBase):
    id: int
    received_date: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QualityRecordBase(BaseModel):
    batch_id: str
    order_number: Optional[str] = None
    paper_batch_id: Optional[int] = None
    sample_point: Optional[str] = None
    lab_l: float
    lab_a: float
    lab_b: float
    standard_l: Optional[float] = None
    standard_a: Optional[float] = None
    standard_b: Optional[float] = None
    delta_e: Optional[float] = None
    is_qualified: Optional[bool] = True
    inspector: Optional[str] = None
    notes: Optional[str] = None


class QualityRecordCreate(QualityRecordBase):
    inspection_time: Optional[datetime] = None


class QualityRecordUpdate(BaseModel):
    order_number: Optional[str] = None
    paper_batch_id: Optional[int] = None
    sample_point: Optional[str] = None
    lab_l: Optional[float] = None
    lab_a: Optional[float] = None
    lab_b: Optional[float] = None
    standard_l: Optional[float] = None
    standard_a: Optional[float] = None
    standard_b: Optional[float] = None
    delta_e: Optional[float] = None
    is_qualified: Optional[bool] = None
    inspector: Optional[str] = None
    notes: Optional[str] = None


class QualityRecord(QualityRecordBase):
    id: int
    inspection_time: datetime
    created_at: datetime
    updated_at: datetime
    paper_batch: Optional[PaperBatch] = None

    class Config:
        from_attributes = True


class ReworkRecordBase(BaseModel):
    quality_record_id: int
    rework_reason: str
    rework_type: Optional[str] = None
    rework_operator: Optional[str] = None
    before_status: Optional[str] = None
    after_status: Optional[str] = None
    is_successful: Optional[bool] = True
    notes: Optional[str] = None


class ReworkRecordCreate(ReworkRecordBase):
    rework_time: Optional[datetime] = None


class ReworkRecordUpdate(BaseModel):
    rework_reason: Optional[str] = None
    rework_type: Optional[str] = None
    rework_operator: Optional[str] = None
    before_status: Optional[str] = None
    after_status: Optional[str] = None
    is_successful: Optional[bool] = None
    notes: Optional[str] = None


class ReworkRecord(ReworkRecordBase):
    id: int
    rework_time: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImportErrorLogBase(BaseModel):
    import_type: str
    source_file: str
    row_number: Optional[int] = None
    original_data: str
    error_message: str
    suggestion: Optional[str] = None


class ImportErrorLogCreate(ImportErrorLogBase):
    pass


class ImportErrorLogUpdate(BaseModel):
    is_resolved: Optional[bool] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None


class ImportErrorLog(ImportErrorLogBase):
    id: int
    is_resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    operation_type: str
    operator: Optional[str] = None
    target_table: Optional[str] = None
    target_id: Optional[int] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLog(OperationLogBase):
    id: int
    operation_time: datetime

    class Config:
        from_attributes = True


class QualityRecordQuery(BaseModel):
    inspector: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_qualified: Optional[bool] = None
    rework_type: Optional[str] = None
    batch_id: Optional[str] = None
    order_number: Optional[str] = None


class ImportResult(BaseModel):
    success_count: int
    error_count: int
    errors: List[ImportErrorLog]


class QualityRecordWithRework(QualityRecord):
    rework_records: List[ReworkRecord] = []
