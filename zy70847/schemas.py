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
        from_attributes = True


class RawMaterialItem(BaseModel):
    line_number: Optional[int] = None
    sku_name: Optional[str] = None
    sku_code: Optional[str] = None
    quantity: Optional[int] = None
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    inventory_time: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class RawMaterialUpload(BaseModel):
    batch_no: str
    materials: List[RawMaterialItem]


class RawMaterialResponse(BaseModel):
    id: int
    batch_id: int
    line_number: Optional[int] = None
    sku_name: Optional[str] = None
    sku_code: Optional[str] = None
    quantity: Optional[int] = None
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    inventory_time: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    is_error: bool
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class SkuAliasCreate(BaseModel):
    canonical_sku: str
    alias_sku: str


class SkuAliasResponse(BaseModel):
    id: int
    canonical_sku: str
    alias_sku: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessRecordResponse(BaseModel):
    id: int
    batch_id: int
    raw_material_id: int
    canonical_sku: Optional[str] = None
    adjusted_quantity: Optional[int] = None
    priority_score: Optional[float] = None
    inventory_time_diff: Optional[int] = None
    status: str
    step: str
    message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessTraceResponse(BaseModel):
    raw_material: RawMaterialResponse
    process_records: List[ProcessRecordResponse]


class ProcessRequest(BaseModel):
    batch_no: str
