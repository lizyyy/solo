from pydantic import BaseModel, Field, validator
from datetime import date
from typing import Optional, Dict
from enum import Enum


class Unit(str, Enum):
    G = "克"
    KG = "千克"
    JIN = "斤"
    PIECE = "个"
    BAG = "袋"
    BOX = "箱"


class Material(BaseModel):
    material_id: str = Field(..., description="原料ID")
    material_name: str = Field(..., description="原料名称")
    category: str = Field(..., description="原料类别")
    unit: Unit = Field(..., description="单位")
    unit_price: float = Field(..., ge=0, description="单价")

    @validator("unit_price")
    def validate_price(cls, v):
        if v < 0:
            raise ValueError("单价不能为负数")
        return v


class PurchaseOrder(BaseModel):
    order_id: str = Field(..., description="采购单ID")
    material_id: str = Field(..., description="原料ID")
    store_id: str = Field(..., description="门店ID")
    purchase_date: date = Field(..., description="采购日期")
    quantity: float = Field(..., gt=0, description="采购数量")
    unit: Unit = Field(..., description="单位")


class UsageOrder(BaseModel):
    order_id: str = Field(..., description="领用单ID")
    material_id: str = Field(..., description="原料ID")
    store_id: str = Field(..., description="门店ID")
    usage_date: date = Field(..., description="领用日期")
    quantity: float = Field(..., gt=0, description="领用数量")
    unit: Unit = Field(..., description="单位")


class DamageReport(BaseModel):
    report_id: str = Field(..., description="报损单ID")
    material_id: str = Field(..., description="原料ID")
    store_id: str = Field(..., description="门店ID")
    damage_date: date = Field(..., description="报损日期")
    quantity: float = Field(..., gt=0, description="报损数量")
    unit: Unit = Field(..., description="单位")
    reason: Optional[str] = Field(None, description="报损原因")


class Store(BaseModel):
    store_id: str = Field(..., description="门店ID")
    store_name: str = Field(..., description="门店名称")
    region: str = Field(..., description="所属区域")


class WasteRecord(BaseModel):
    material_id: str
    material_name: str
    category: str
    store_id: str
    store_name: str
    purchase_quantity: float
    usage_quantity: float
    damage_quantity: float
    waste_rate: float
    is_abnormal: bool
    unit: Unit
