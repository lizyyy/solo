from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.models import MaterialStatus, ChangeType


class BatchBase(BaseModel):
    batch_number: str = Field(..., description="批次号")
    product_model: str = Field(..., description="产品型号")
    production_line: Optional[str] = Field(None, description="生产线")
    description: Optional[str] = Field(None, description="描述")
    created_by: str = Field(..., description="创建人")


class BatchCreate(BatchBase):
    pass


class Batch(BatchBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MaterialBase(BaseModel):
    work_order: str = Field(..., description="制造工单号")
    workstation: Optional[str] = Field(None, description="工位")
    material_batch: Optional[str] = Field(None, description="物料批次")
    rework_reason: Optional[str] = Field(None, description="返修原因")
    raw_data: Optional[str] = Field(None, description="原始数据")


class MaterialCreate(MaterialBase):
    batch_id: int


class MaterialUpdate(BaseModel):
    workstation: Optional[str] = None
    material_batch: Optional[str] = None
    rework_reason: Optional[str] = None
    conclusion: Optional[str] = None
    handler: Optional[str] = None
    status: Optional[MaterialStatus] = None


class Material(MaterialBase):
    id: int
    batch_id: int
    status: MaterialStatus
    conclusion: Optional[str]
    handler: Optional[str]
    final_processor: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    material_id: int
    change_type: ChangeType
    operator: str
    change_reason: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    pass


class AuditLog(AuditLogBase):
    id: int
    changed_at: datetime

    class Config:
        from_attributes = True


class ReviewRequest(BaseModel):
    material_id: int
    reviewer: str
    review_comment: str
    review_result: str


class MaterialDetail(BaseModel):
    material: Material
    audit_logs: List[AuditLog]


class ExportData(BaseModel):
    work_order: str
    rework_reason: Optional[str]
    workstation: Optional[str]
    material_batch: Optional[str]
    conclusion: Optional[str]
    final_processor: Optional[str]
    status: str
    created_at: datetime


class StatisticsResponse(BaseModel):
    total_materials: int
    pending_count: int
    processing_count: int
    completed_count: int
    rejected_count: int
    top_reasons: List[dict]
    top_workstations: List[dict]
