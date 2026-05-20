from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class ConsumptionItem(BaseModel):
    id: Optional[str] = None
    batch_number: str = Field(..., description="批号")
    material_name: str = Field(..., description="物料名称")
    specification: str = Field(..., description="规格型号")
    quantity: int = Field(..., ge=0, description="消耗数量")
    unit: str = Field(default="支", description="单位")
    consumption_date: date = Field(..., description="消耗日期")
    store_name: str = Field(..., description="门店名称")
    patient_id: Optional[str] = Field(None, description="患者ID")
    doctor_name: Optional[str] = Field(None, description="医生姓名")
    is_transfer: bool = Field(default=False, description="是否调拨")
    transfer_from_store: Optional[str] = Field(None, description="调拨来源门店")
    transfer_to_store: Optional[str] = Field(None, description="调拨目标门店")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    remarks: Optional[str] = None
