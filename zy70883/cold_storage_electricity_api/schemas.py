from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import BatchStatus, DataCategory, ProcessingAction


class BatchBase(BaseModel):
    name: str = Field(..., max_length=200)
    billing_month: str = Field(..., pattern=r"^\d{4}-\d{2}$")


class BatchCreate(BatchBase):
    created_by: str = Field(..., max_length=100)


class BatchUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[BatchStatus] = None


class BatchResponse(BatchBase):
    id: int
    batch_no: str
    status: BatchStatus
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]
    archived_at: Optional[datetime]
    archived_by: Optional[str]

    class Config:
        from_attributes = True


class SourceMaterialBase(BaseModel):
    material_type: str = Field(..., max_length=50)
    remark: Optional[str] = Field(None, max_length=500)


class SourceMaterialCreate(SourceMaterialBase):
    batch_id: int
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    content: Optional[str] = None
    uploaded_by: str = Field(..., max_length=100)


class SourceMaterialResponse(SourceMaterialBase):
    id: int
    batch_id: int
    file_name: Optional[str]
    uploaded_by: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ElectricityDetailBase(BaseModel):
    tenant_code: str = Field(..., max_length=50)
    tenant_name: str = Field(..., max_length=200)
    temperature_zone: str = Field(..., max_length=100)
    electricity_rate: float
    meter_reading_start: Optional[float] = None
    meter_reading_end: Optional[float] = None
    basic_electricity: Optional[float] = None
    overtime_hours: Optional[float] = None
    overtime_electricity: Optional[float] = None
    manual_allocation: Optional[float] = 0.0


class ElectricityDetailCreate(ElectricityDetailBase):
    batch_id: int


class ElectricityDetailUpdate(BaseModel):
    temperature_zone: Optional[str] = None
    electricity_rate: Optional[float] = None
    meter_reading_start: Optional[float] = None
    meter_reading_end: Optional[float] = None
    basic_electricity: Optional[float] = None
    overtime_hours: Optional[float] = None
    overtime_electricity: Optional[float] = None
    manual_allocation: Optional[float] = None
    category: Optional[DataCategory] = None
    category_reason: Optional[str] = None
    final_processor: Optional[str] = None


class ElectricityDetailResponse(ElectricityDetailBase):
    id: int
    batch_id: int
    total_electricity: Optional[float]
    category: DataCategory
    category_reason: Optional[str]
    is_archived: bool
    final_processor: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ProcessingTraceBase(BaseModel):
    action: ProcessingAction
    operator: str = Field(..., max_length=100)
    remark: Optional[str] = Field(None, max_length=500)
    previous_category: Optional[DataCategory] = None
    new_category: Optional[DataCategory] = None


class ProcessingTraceCreate(ProcessingTraceBase):
    detail_id: int


class ProcessingTraceResponse(ProcessingTraceBase):
    id: int
    detail_id: int
    operated_at: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    field_name: str = Field(..., max_length=100)
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_reason: str = Field(..., max_length=500)
    modified_by: str = Field(..., max_length=100)


class AuditLogCreate(AuditLogBase):
    detail_id: int


class AuditLogResponse(AuditLogBase):
    id: int
    detail_id: int
    modified_at: datetime

    class Config:
        from_attributes = True


class CategoryStatistics(BaseModel):
    category: DataCategory
    count: int
    total_electricity: float


class BatchDetailResponse(BaseModel):
    batch: BatchResponse
    statistics: List[CategoryStatistics]
    details: List[ElectricityDetailResponse]


class ConclusionModifyRequest(BaseModel):
    new_category: DataCategory
    category_reason: str
    modified_by: str
    change_reason: str


class ArchiveRequest(BaseModel):
    operator: str


class ExportRequest(BaseModel):
    batch_id: Optional[int] = None
    category: Optional[DataCategory] = None
