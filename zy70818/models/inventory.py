from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum


class MaterialType(str, Enum):
    IMPLANT = "种植体"
    ANESTHETIC = "麻药"
    PACKAGING = "一次性包材"
    OTHER = "其他"


class InventoryStatus(str, Enum):
    NORMAL = "正常"
    NEAR_EXPIRY = "近效期"
    EXPIRED = "已过期"
    RECALLED = "已召回"


class InventoryItem(BaseModel):
    id: Optional[str] = None
    batch_number: str = Field(..., description="批号")
    material_name: str = Field(..., description="物料名称")
    material_type: MaterialType = Field(..., description="物料类型")
    specification: str = Field(..., description="规格型号")
    quantity: int = Field(..., ge=0, description="数量")
    unit: str = Field(default="支", description="单位")
    manufacture_date: date = Field(..., description="生产日期")
    expiry_date: date = Field(..., description="有效期至")
    store_name: str = Field(..., description="门店名称")
    warehouse_location: Optional[str] = Field(None, description="库位")
    supplier: Optional[str] = Field(None, description="供应商")
    inbound_date: Optional[date] = Field(None, description="入库日期")
    status: InventoryStatus = InventoryStatus.NORMAL
    is_recalled: bool = False
    recall_notice_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    remarks: Optional[str] = None

    class Config:
        use_enum_values = True
