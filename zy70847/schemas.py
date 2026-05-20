from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class BatchCreate(BaseModel):
    batch_no: str
    name: str


class BatchResponse(BaseModel):
    id: int
    batch_no: str
    name: str
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None
    report_path: Optional[str] = None

    class Config:
        orm_mode = True


class RawMaterialItem(BaseModel):
    line_number: int
    sku_name: str
    sku_code: str
    quantity: int
    location_code: str
    location_name: str
    inventory_time: datetime
    expiry_date: Optional[datetime] = None


class RawMaterialUpload(BaseModel):
    batch_no: str
    materials: List[RawMaterialItem]


class RawMaterialResponse(BaseModel):
    id: int
    batch_id: int
    line_number: int
    sku_name: str
    sku_code: str
    quantity: int
    location_code: str
    location_name: str
    inventory_time: datetime
    expiry_date: Optional[datetime] = None
    is_error: bool
    error_message: Optional[str] = None

    class Config:
        orm_mode = True


class SkuAliasCreate(BaseModel):
    canonical_sku: str
    alias_sku: str


class ProcessRecordResponse(BaseModel):
    id: int
    batch_id: int
    raw_material_id: int
    canonical_sku: str
    adjusted_quantity: int
    priority_score: float
    inventory_time_diff: Optional[int] = None
    status: str
    step: str
    message: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True


class ProcessTraceResponse(BaseModel):
    raw_material: RawMaterialResponse
    process_records: List[ProcessRecordResponse]


class ProcessRequest(BaseModel):
    batch_no: str
