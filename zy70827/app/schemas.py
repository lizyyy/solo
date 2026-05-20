from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

from app.models import TaskStatus, DataCategory, SampleStatus


class UserBase(BaseModel):
    username: str = Field(..., max_length=50)
    full_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class SampleItem(BaseModel):
    sample_code: str = Field(..., max_length=50)
    sample_name: str = Field(..., max_length=200)
    quantity: int = Field(default=1, ge=1)
    unit: str = Field(default="件", max_length=20)


class BrandBatchInput(BaseModel):
    batch_no: str = Field(..., max_length=50)
    brand_name: str = Field(..., max_length=200)
    product_line: Optional[str] = Field(None, max_length=100)
    batch_date: Optional[datetime] = None


class TalentScheduleInput(BaseModel):
    schedule_no: str = Field(..., max_length=50)
    talent_name: str = Field(..., max_length=100)
    talent_id: Optional[str] = Field(None, max_length=50)
    live_date: datetime
    platform: Optional[str] = Field(None, max_length=50)
    room_id: Optional[str] = Field(None, max_length=50)


class DepositInput(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = Field(default="CNY", max_length=10)
    deduction_reason: Optional[str] = None


class SampleTaskCreate(BaseModel):
    task_no: str = Field(..., max_length=50)
    batch_no: Optional[str] = Field(None, max_length=50)
    
    samples: List[SampleItem]
    brand_batch: Optional[BrandBatchInput] = None
    talent_schedule: Optional[TalentScheduleInput] = None
    deposit: Optional[DepositInput] = None
    
    raw_data: Optional[Dict[str, Any]] = None
    source_file: Optional[str] = Field(None, max_length=200)
    row_number: Optional[int] = None
    
    submitted_by: Optional[str] = Field(None, max_length=50)
    
    @validator('raw_data', pre=True, always=True)
    def ensure_raw_data(cls, v, values):
        if v is None:
            task_data = {
                'task_no': values.get('task_no'),
                'batch_no': values.get('batch_no'),
                'samples': [s.dict() for s in values.get('samples', [])],
                'submitted_by': values.get('submitted_by')
            }
            return task_data
        return v


class SampleTaskResponse(BaseModel):
    id: int
    task_no: str
    batch_no: Optional[str]
    status: TaskStatus
    category: Optional[DataCategory]
    category_reason: Optional[str]
    submitted_by: Optional[str]
    submitted_at: datetime
    processed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class SampleTaskDetailResponse(SampleTaskResponse):
    raw_data: str
    source_file: Optional[str]
    row_number: Optional[int]


class SampleResponse(BaseModel):
    id: int
    task_id: int
    sample_code: str
    sample_name: str
    quantity: int
    unit: str
    status: SampleStatus
    has_damage_photo: bool
    damage_photo_url: Optional[str]
    shipped_at: Optional[datetime]
    received_at: Optional[datetime]
    returned_at: Optional[datetime]
    settled_at: Optional[datetime]
    remark: Optional[str]
    
    class Config:
        from_attributes = True


class BrandBatchResponse(BaseModel):
    id: int
    batch_no: str
    brand_name: str
    product_line: Optional[str]
    batch_date: Optional[datetime]
    total_samples: int
    
    class Config:
        from_attributes = True


class TalentScheduleResponse(BaseModel):
    id: int
    schedule_no: str
    talent_name: str
    talent_id: Optional[str]
    live_date: datetime
    platform: Optional[str]
    room_id: Optional[str]
    
    class Config:
        from_attributes = True


class DepositRecordResponse(BaseModel):
    id: int
    task_id: int
    amount: float
    currency: str
    deduction_reason: Optional[str]
    deducted_at: Optional[datetime]
    deducted_by: Optional[str]
    is_settled: bool
    settled_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ErrorDetailResponse(BaseModel):
    id: int
    task_id: int
    error_type: str
    error_field: Optional[str]
    error_message: str
    source_ref: Optional[str]
    row_number: Optional[int]
    column_ref: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    task_id: int
    operator_id: int
    operator_name: Optional[str]
    action: str
    field_changed: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    reason: str
    operated_at: datetime
    
    class Config:
        from_attributes = True


class CategoryUpdateRequest(BaseModel):
    category: DataCategory
    category_reason: str
    operator_id: int
    reason: str


class StatusUpdateRequest(BaseModel):
    status: TaskStatus
    operator_id: int
    reason: str


class DamagePhotoUpdateRequest(BaseModel):
    sample_id: int
    has_damage_photo: bool
    damage_photo_url: Optional[str] = None
    operator_id: int
    reason: str


class TaskQueryParams(BaseModel):
    status: Optional[TaskStatus] = None
    category: Optional[DataCategory] = None
    task_no: Optional[str] = None
    batch_no: Optional[str] = None
    submitted_by: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SettlementRequest(BaseModel):
    task_id: int
    operator_id: int
    remark: Optional[str] = None
