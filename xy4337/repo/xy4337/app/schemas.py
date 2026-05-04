from pydantic import BaseModel, Field, validator
from datetime import datetime, date
from typing import Optional, List
from app.models import DrynessStatus, FiringResult


class WorkBase(BaseModel):
    student_name: str = Field(..., min_length=1, max_length=255, description="学员姓名")
    work_description: Optional[str] = Field(None, description="作品描述")
    dryness_status: DrynessStatus = Field(..., description="干燥状态：not_dry, partially_dry, dry")
    glaze_type: str = Field(..., min_length=1, max_length=255, description="釉料类型")
    expected_pickup_date: date = Field(..., description="期望取件日期")
    temperature_zone: str = Field(..., min_length=1, max_length=50, description="温区：low, mid, high")


class WorkCreate(WorkBase):
    pass


class WorkUpdate(BaseModel):
    student_name: Optional[str] = Field(None, min_length=1, max_length=255)
    work_description: Optional[str] = None
    dryness_status: Optional[DrynessStatus] = None
    glaze_type: Optional[str] = Field(None, min_length=1, max_length=255)
    expected_pickup_date: Optional[date] = None
    temperature_zone: Optional[str] = Field(None, min_length=1, max_length=50)


class WorkResponse(WorkBase):
    id: int
    is_dry: bool
    is_delayed: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkListResponse(BaseModel):
    total: int
    items: List[WorkResponse]


class KilnSessionBase(BaseModel):
    session_name: str = Field(..., min_length=1, max_length=255, description="窑次名称")
    target_temperature_zone: str = Field(..., min_length=1, max_length=50, description="目标温区")
    scheduled_firing_date: date = Field(..., description="计划烧成日期")
    max_capacity: int = Field(..., ge=1, description="最大容量")


class KilnSessionCreate(KilnSessionBase):
    pass


class KilnSessionUpdate(BaseModel):
    session_name: Optional[str] = Field(None, min_length=1, max_length=255)
    target_temperature_zone: Optional[str] = Field(None, min_length=1, max_length=50)
    scheduled_firing_date: Optional[date] = None
    max_capacity: Optional[int] = Field(None, ge=1)
    notes: Optional[str] = None


class FiringRecordUpdate(BaseModel):
    firing_result: FiringResult = Field(..., description="烧成结果：success, partial_success, failure")
    notes: Optional[str] = Field(None, description="备注")


class KilnLoadingBase(BaseModel):
    work_id: int = Field(..., description="作品ID")
    kiln_session_id: int = Field(..., description="窑次ID")
    position_notes: Optional[str] = Field(None, description="位置备注")
    loading_order: Optional[int] = Field(0, ge=0, description="装载顺序")


class KilnLoadingCreate(KilnLoadingBase):
    pass


class KilnLoadingUpdate(BaseModel):
    position_notes: Optional[str] = None
    loading_order: Optional[int] = Field(None, ge=0)


class KilnLoadingResponse(KilnLoadingBase):
    id: int
    work: WorkResponse
    created_at: datetime

    class Config:
        from_attributes = True


class KilnSessionResponse(KilnSessionBase):
    id: int
    is_fired: bool
    firing_start_time: Optional[datetime]
    firing_end_time: Optional[datetime]
    firing_result: Optional[FiringResult]
    notes: Optional[str]
    current_load: int
    is_overloaded: bool
    is_ready_to_fire: bool
    created_at: datetime
    updated_at: datetime
    kiln_loadings: List[KilnLoadingResponse] = []

    class Config:
        from_attributes = True


class KilnSessionListResponse(BaseModel):
    total: int
    items: List[KilnSessionResponse]


class ValidationErrorDetail(BaseModel):
    type: str
    message: str
    work_ids: Optional[List[int]] = None


class ValidationResponse(BaseModel):
    is_valid: bool
    errors: List[ValidationErrorDetail] = []
    warnings: List[ValidationErrorDetail] = []


class DelayedWorkResponse(WorkResponse):
    delay_days: int
    latest_session_date: Optional[date] = None
