from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class BatchStatus(str, Enum):
    CREATED = "created"
    MATERIALS_UPLOADED = "materials_uploaded"
    SPLITTING = "splitting"
    SPLIT_COMPLETED = "split_completed"
    REPORT_GENERATED = "report_generated"


class DetailType(str, Enum):
    ELECTRICITY = "electricity"
    WATER = "water"
    DAMAGE = "damage"
    REFUND = "refund"


class BatchCreate(BaseModel):
    batch_no: str
    operator: str
    property_id: str
    tenant_name: str
    deposit_amount: float


class BatchResponse(BaseModel):
    id: int
    batch_no: str
    operator: str
    property_id: str
    tenant_name: str
    deposit_amount: float
    status: BatchStatus
    material_fingerprint: Optional[str] = None
    created_at: datetime
    is_duplicate: Optional[bool] = False

    class Config:
        from_attributes = True


class MaterialCreate(BaseModel):
    material_type: str
    content: str
    file_name: Optional[str] = None


class MaterialResponse(BaseModel):
    id: int
    batch_id: int
    material_type: str
    content: str
    file_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ElectricityReading(BaseModel):
    previous_reading: float
    current_reading: float
    usage_kwh: float


class WaterReading(BaseModel):
    previous_reading: float
    current_reading: float
    usage_ton: float


class DamageItem(BaseModel):
    item_name: str
    damage_description: str
    compensation_amount: float
    photo_reference: str


class RefundItem(BaseModel):
    reason: str
    amount: float
    original_transaction_no: str


class MaterialUploadRequest(BaseModel):
    batch_no: str
    electricity: Optional[ElectricityReading] = None
    water: Optional[WaterReading] = None
    damages: Optional[List[DamageItem]] = None
    refunds: Optional[List[RefundItem]] = None
    operator: str


class SplitRequest(BaseModel):
    batch_no: str


class SettlementDetailResponse(BaseModel):
    id: int
    batch_id: int
    detail_type: DetailType
    reference_no: str
    original_amount: float
    calculated_amount: float
    description: Optional[str] = None
    calc_details: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingTraceResponse(BaseModel):
    id: int
    detail_id: int
    action: str
    operator: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReportResponse(BaseModel):
    id: int
    batch_id: int
    report_no: str
    total_electricity_fee: float
    total_water_fee: float
    total_damage_compensation: float
    total_refund: float
    total_settlement: float
    deposit_refund: float
    report_content: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SplitResponse(BaseModel):
    batch_no: str
    status: str
    is_duplicate: bool
    details: List[SettlementDetailResponse]
    message: str
