from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date

from pharmacy_expiry_tracker.models.enums import RecordStatus, LiabilityResult


class ExpiryRecordBase(BaseModel):
    pharmacy_code: str = Field(..., description="药房编码")
    pharmacy_name: str = Field(..., description="药房名称")
    region: Optional[str] = Field(None, description="区域")
    town: Optional[str] = Field(None, description="乡镇")
    drug_code: str = Field(..., description="药品编码")
    drug_name: str = Field(..., description="药品名称")
    drug_spec: Optional[str] = Field(None, description="药品规格")
    batch_no: str = Field(..., description="批号")
    expiry_date: date = Field(..., description="有效期")
    quantity: int = Field(..., description="数量")
    unit: Optional[str] = Field(None, description="单位")
    days_near_expiry: Optional[int] = Field(None, description="近效期天数")
    expiry_category: Optional[str] = Field(None, description="近效期分类")
    liability_result: LiabilityResult = Field(default=LiabilityResult.PENDING, description="追责结果")
    liability_amount: float = Field(default=0.0, description="追责金额")
    remarks: Optional[str] = Field(None, description="备注")


class ExpiryRecordCreate(ExpiryRecordBase):
    created_by: str = Field(..., description="创建人")


class ExpiryRecordUpdate(BaseModel):
    pharmacy_name: Optional[str] = None
    region: Optional[str] = None
    town: Optional[str] = None
    drug_name: Optional[str] = None
    drug_spec: Optional[str] = None
    expiry_date: Optional[date] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    liability_result: Optional[LiabilityResult] = None
    liability_amount: Optional[float] = None
    remarks: Optional[str] = None
    change_reason: str = Field(..., description="变更原因")
    updated_by: str = Field(..., description="更新人")


class ExpiryRecordResponse(ExpiryRecordBase):
    id: int
    record_no: str
    status: RecordStatus
    is_frozen: bool
    frozen_at: Optional[datetime] = None
    frozen_by: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    current_version: int
    import_source_id: Optional[int] = None
    change_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ExpiryRecordListResponse(BaseModel):
    total: int
    items: List[ExpiryRecordResponse]
    page: int
    page_size: int
