from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from models import ClassificationType


class BatchItemCreate(BaseModel):
    material_code: str = Field(..., description="耗材编码")
    material_name: str = Field(..., description="耗材名称")
    specification: Optional[str] = Field(None, description="规格型号")
    manufacturer: Optional[str] = Field(None, description="生产厂家")
    batch_no: str = Field(..., description="生产批号")
    production_date: Optional[datetime] = Field(None, description="生产日期")
    expiry_date: datetime = Field(..., description="有效期至")
    quantity: int = Field(..., gt=0, description="数量")
    unit: Optional[str] = Field(None, description="单位")
    storage_condition: Optional[str] = Field(None, description="储存条件")
    supplier: Optional[str] = Field(None, description="供应商")


class BatchCreate(BaseModel):
    batch_number: str = Field(..., description="批次号")
    submitted_by: str = Field(..., description="提交人")
    items: List[BatchItemCreate] = Field(..., description="耗材列表")


class BatchItemResponse(BaseModel):
    id: int
    material_code: str
    material_name: str
    specification: Optional[str]
    manufacturer: Optional[str]
    batch_no: str
    production_date: Optional[datetime]
    expiry_date: datetime
    quantity: int
    unit: Optional[str]
    storage_condition: Optional[str]
    supplier: Optional[str]
    classification: ClassificationType
    reason: Optional[str]
    follow_up_action: Optional[str]

    class Config:
        from_attributes = True


class BatchResponse(BaseModel):
    id: int
    batch_number: str
    submitted_by: str
    submit_time: datetime
    total_items: int
    status: str
    items: List[BatchItemResponse]
    is_duplicate: bool = False

    class Config:
        from_attributes = True


class ChangeHistoryResponse(BaseModel):
    id: int
    changed_by: str
    change_time: datetime
    old_classification: Optional[ClassificationType]
    new_classification: Optional[ClassificationType]
    old_reason: Optional[str]
    new_reason: Optional[str]
    old_follow_up_action: Optional[str]
    new_follow_up_action: Optional[str]
    change_reason: str

    class Config:
        from_attributes = True


class ItemWithHistoryResponse(BatchItemResponse):
    change_history: List[ChangeHistoryResponse]


class BatchDetailResponse(BatchResponse):
    items: List[ItemWithHistoryResponse]


class ModifyItemRequest(BaseModel):
    classification: ClassificationType
    reason: str
    follow_up_action: str
    changed_by: str
    change_reason: str
