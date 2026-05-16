from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models import TaskStatus, RiskType, FailureType


class QuotaRecycleTaskBase(BaseModel):
    batch_no: str = Field(..., max_length=64)
    operator: str = Field(..., max_length=64)
    risk_type: RiskType
    material_url: str = Field(..., max_length=512)
    material_summary: Optional[str] = None
    total_target_quota: float = 0.0
    remark: Optional[str] = None


class QuotaRecycleTaskCreate(QuotaRecycleTaskBase):
    pass


class QuotaRecycleTaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    material_summary: Optional[str] = None
    actual_recycled_quota: Optional[float] = None
    remark: Optional[str] = None


class QuotaRecycleTask(QuotaRecycleTaskBase):
    id: int
    status: TaskStatus
    actual_recycled_quota: float
    failed_count: int
    success_count: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True


class QuotaRecycleTaskWithDetails(QuotaRecycleTask):
    failed_items: List["FailedItem"] = []
    recycle_details: List["RecycleDetail"] = []


class FailedItemBase(BaseModel):
    task_id: int
    failure_type: FailureType
    tenant_id: Optional[str] = Field(None, max_length=64)
    tenant_name: Optional[str] = Field(None, max_length=128)
    error_message: str
    raw_data: Optional[str] = None


class FailedItemCreate(FailedItemBase):
    pass


class FailedItemUpdate(BaseModel):
    resolved: Optional[bool] = None
    resolved_by: Optional[str] = None
    resolution_note: Optional[str] = None


class FailedItem(FailedItemBase):
    id: int
    retry_count: int
    resolved: bool
    resolved_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        orm_mode = True


class RecycleDetailBase(BaseModel):
    task_id: int
    tenant_id: str = Field(..., max_length=64)
    tenant_name: Optional[str] = Field(None, max_length=128)
    original_quota: float
    recycled_quota: float
    remaining_quota: float
    reason: Optional[str] = Field(None, max_length=256)
    evidence_url: Optional[str] = Field(None, max_length=512)


class RecycleDetailCreate(RecycleDetailBase):
    pass


class RecycleDetail(RecycleDetailBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True


class LakehousePartitionBase(BaseModel):
    task_id: Optional[int] = None
    partition_path: str = Field(..., max_length=512)
    partition_date: Optional[str] = Field(None, max_length=32)
    record_count: int = 0
    data_size_mb: float = 0.0


class LakehousePartitionCreate(LakehousePartitionBase):
    pass


class LakehousePartitionUpdate(BaseModel):
    manually_confirmed: bool
    confirmed_by: str
    confirmation_note: Optional[str] = None


class LakehousePartition(LakehousePartitionBase):
    id: int
    manually_confirmed: bool
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        orm_mode = True


class TaskQueryParams(BaseModel):
    batch_no: Optional[str] = None
    operator: Optional[str] = None
    risk_type: Optional[RiskType] = None
    status: Optional[TaskStatus] = None
    has_failures: Optional[bool] = None


class FailedItemQueryParams(BaseModel):
    task_id: Optional[int] = None
    failure_type: Optional[FailureType] = None
    tenant_id: Optional[str] = None
    resolved: Optional[bool] = None


class RecycleSummary(BaseModel):
    total_recycled_quota: float
    total_tenants: int
    total_tasks: int
    failed_tasks_count: int


QuotaRecycleTaskWithDetails.update_forward_refs()
