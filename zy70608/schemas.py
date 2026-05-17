from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class CabinetBase(BaseModel):
    cabinet_no: str
    location: Optional[str] = None


class CabinetCreate(CabinetBase):
    pass


class CabinetResponse(CabinetBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        orm_mode = True


class SKUBase(BaseModel):
    sku_code: str
    name: str
    price: float
    unit: str = "件"


class SKUCreate(SKUBase):
    pass


class SKUResponse(SKUBase):
    id: int

    class Config:
        orm_mode = True


class InventorySnapshotBase(BaseModel):
    cabinet_no: str
    sku_code: str
    quantity: int
    batch_no: Optional[str] = None
    expiry_date: Optional[datetime] = None


class InventorySnapshotCreate(InventorySnapshotBase):
    created_by: Optional[str] = None


class InventorySnapshotResponse(BaseModel):
    id: int
    cabinet_no: str
    sku_code: str
    sku_name: str
    quantity: int
    batch_no: Optional[str]
    expiry_date: Optional[datetime]
    snapshot_time: datetime

    class Config:
        orm_mode = True


class ReplenishmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class ReplenishmentItemBase(BaseModel):
    sku_code: str
    quantity: int
    batch_no: Optional[str] = None
    expiry_date: Optional[datetime] = None


class ReplenishmentCreate(BaseModel):
    cabinet_no: str
    replenishment_no: str
    items: List[ReplenishmentItemBase]
    remark: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None


class ReplenishmentConfirm(BaseModel):
    operator_id: str
    operator_name: str
    items: Optional[List[dict]] = None


class ReplenishmentItemResponse(BaseModel):
    id: int
    sku_code: str
    sku_name: str
    quantity: int
    actual_quantity: Optional[int]
    batch_no: Optional[str]
    expiry_date: Optional[datetime]

    class Config:
        orm_mode = True


class ReplenishmentResponse(BaseModel):
    id: int
    cabinet_no: str
    replenishment_no: str
    status: str
    operator_id: Optional[str]
    operator_name: Optional[str]
    confirmed_at: Optional[datetime]
    remark: Optional[str]
    items: List[ReplenishmentItemResponse]
    created_at: datetime

    class Config:
        orm_mode = True


class DamageRecordBase(BaseModel):
    cabinet_no: str
    sku_code: str
    quantity: int
    damage_type: str
    reason: Optional[str] = None


class DamageRecordCreate(DamageRecordBase):
    reporter_id: Optional[str] = None
    reporter_name: Optional[str] = None


class DamageRecordConfirm(BaseModel):
    confirmer_id: str
    confirmer_name: str


class DamageRecordResponse(BaseModel):
    id: int
    damage_no: str
    cabinet_no: str
    sku_code: str
    sku_name: str
    quantity: int
    damage_type: str
    reason: Optional[str]
    reporter_id: Optional[str]
    reporter_name: Optional[str]
    status: str
    created_at: datetime

    class Config:
        orm_mode = True


class ExpiredProductBase(BaseModel):
    cabinet_no: str
    sku_code: str
    quantity: int
    batch_no: Optional[str] = None
    expiry_date: Optional[datetime] = None


class ExpiredProductCreate(ExpiredProductBase):
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None


class ExpiredProductResponse(BaseModel):
    id: int
    record_no: str
    cabinet_no: str
    sku_code: str
    sku_name: str
    quantity: int
    batch_no: Optional[str]
    expiry_date: Optional[datetime]
    operator_id: Optional[str]
    operator_name: Optional[str]
    status: str
    created_at: datetime

    class Config:
        orm_mode = True


class SettlementStatus(str, Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    CLOSED = "closed"


class SettlementCreate(BaseModel):
    cabinet_no: str
    settlement_no: str
    period_start: datetime
    period_end: datetime
    created_by: Optional[str] = None


class SettlementConfirm(BaseModel):
    confirmed_by: str


class SettlementDetailResponse(BaseModel):
    id: int
    sku_code: str
    sku_name: str
    opening_inventory: int
    replenishment_quantity: int
    sales_quantity: int
    damage_quantity: int
    expired_quantity: int
    closing_inventory: int
    sales_amount: float
    damage_loss: float
    expired_loss: float

    class Config:
        orm_mode = True


class SettlementResponse(BaseModel):
    id: int
    cabinet_no: str
    settlement_no: str
    period_start: datetime
    period_end: datetime
    status: str
    total_sales: float
    total_damage_loss: float
    total_expired_loss: float
    total_replenishment: int
    net_amount: float
    details: List[SettlementDetailResponse]
    created_at: datetime

    class Config:
        orm_mode = True


class OperationLogResponse(BaseModel):
    id: int
    operation_type: str
    ref_no: Optional[str]
    operator_id: Optional[str]
    operator_name: Optional[str]
    conclusion: Optional[str]
    status: str
    error_message: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


class CorrectionCreate(BaseModel):
    cabinet_no: str
    sku_code: str
    quantity: int
    reason: str
    operator_id: str
    operator_name: str


class CloseSettlementQuery(BaseModel):
    settlement_no: str
    reason: str
    operator_id: str
    operator_name: str
