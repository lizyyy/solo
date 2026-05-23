from pydantic import BaseModel, Field, field_validator, ValidationInfo
from datetime import datetime
from typing import Optional, List


class CabinetBase(BaseModel):
    cabinet_no: str
    location: Optional[str] = None


class CabinetCreate(CabinetBase):
    pass


class Cabinet(CabinetBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SKUStockBase(BaseModel):
    sku_code: str
    sku_name: Optional[str] = None
    current_quantity: int = Field(default=0, ge=0, description="库存数量必须为非负数")
    unit_price: float = Field(default=0.0, ge=0.0, description="单价必须为非负数")
    expiration_date: Optional[datetime] = None


class SKUStockCreate(SKUStockBase):
    pass


class SKUStock(SKUStockBase):
    id: int
    cabinet_id: int

    class Config:
        from_attributes = True


class ReplenishmentItemBase(BaseModel):
    sku_code: str
    sku_name: Optional[str] = None
    replenish_quantity: int = Field(gt=0, description="补货数量必须为正数")
    unit_price: float = Field(default=0.0, ge=0.0, description="单价必须为非负数")
    expiration_date: Optional[datetime] = None


class ReplenishmentItemCreate(ReplenishmentItemBase):
    pass


class ReplenishmentItem(ReplenishmentItemBase):
    id: int
    batch_id: int
    before_quantity: int
    after_quantity: int

    class Config:
        from_attributes = True


class DamageRecordBase(BaseModel):
    sku_code: str
    sku_name: Optional[str] = None
    damage_type: str
    quantity: int = Field(ge=0, description="货损数量必须为非负数")
    unit_price: float = Field(default=0.0, ge=0.0, description="单价必须为非负数")
    reason: Optional[str] = None


class DamageRecordCreate(DamageRecordBase):
    pass


class DamageRecord(DamageRecordBase):
    id: int
    batch_id: int
    total_amount: float
    recorded_at: datetime

    class Config:
        from_attributes = True


class ExpiredRemovalBase(BaseModel):
    sku_code: str
    sku_name: Optional[str] = None
    quantity: int = Field(ge=0, description="临期下架数量必须为非负数")
    unit_price: float = Field(default=0.0, ge=0.0, description="单价必须为非负数")
    expiration_date: Optional[datetime] = None


class ExpiredRemovalCreate(ExpiredRemovalBase):
    pass


class ExpiredRemoval(ExpiredRemovalBase):
    id: int
    batch_id: int
    total_amount: float
    removed_at: datetime

    class Config:
        from_attributes = True


class OperatorConfirmationBase(BaseModel):
    operator_id: str
    operator_name: Optional[str] = None
    confirm_type: str
    signature: Optional[str] = None
    remark: Optional[str] = None


class OperatorConfirmationCreate(OperatorConfirmationBase):
    pass


class OperatorConfirmation(OperatorConfirmationBase):
    id: int
    batch_id: int
    confirmed_at: datetime

    class Config:
        from_attributes = True


class ReplenishmentBatchBase(BaseModel):
    batch_no: str
    cabinet_no: str
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    idempotent_key: Optional[str] = None


class ReplenishmentBatchCreate(ReplenishmentBatchBase):
    items: List[ReplenishmentItemCreate]
    damages: Optional[List[DamageRecordCreate]] = None
    expired_removals: Optional[List[ExpiredRemovalCreate]] = None


class ReplenishmentBatch(ReplenishmentBatchBase):
    id: int
    cabinet_id: int
    status: str
    items: List[ReplenishmentItem] = []
    damages: List[DamageRecord] = []
    confirmations: List[OperatorConfirmation] = []
    created_at: datetime

    class Config:
        from_attributes = True


class SettlementSummaryBase(BaseModel):
    settlement_no: str
    cabinet_no: str
    batch_no: str


class SettlementSummaryCreate(SettlementSummaryBase):
    pass


class SettlementSummary(SettlementSummaryBase):
    id: int
    cabinet_id: int
    batch_id: int
    total_replenishment_amount: float
    total_damage_amount: float
    total_expired_amount: float
    final_settlement_amount: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ManualCorrectionBase(BaseModel):
    target_type: str
    target_id: int
    operator_id: str
    operator_name: Optional[str] = None
    reason: str
    correction_data: dict


class ManualCorrectionCreate(ManualCorrectionBase):
    pass


class ManualCorrection(ManualCorrectionBase):
    id: int
    before_data: str
    after_data: str
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionLogBase(BaseModel):
    request_id: str
    endpoint: str
    raw_input: str
    error_message: str
    processing_result: str


class ExceptionLogCreate(ExceptionLogBase):
    pass


class ExceptionLog(ExceptionLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    status: str
    operator_id: Optional[str] = None
    remark: Optional[str] = None


class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
