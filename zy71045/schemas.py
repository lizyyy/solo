from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class OakBarrelBase(BaseModel):
    barrel_code: str
    location: str
    capacity: float
    current_volume: float = 0.0


class OakBarrelCreate(OakBarrelBase):
    pass


class OakBarrel(OakBarrelBase):
    id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class WineBatchBase(BaseModel):
    batch_code: str
    wine_type: str
    vintage: int
    initial_volume: float
    remaining_volume: float


class WineBatchCreate(WineBatchBase):
    pass


class WineBatch(WineBatchBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ToppingRecordBase(BaseModel):
    barrel_code: str
    source_batch_code: str
    evaporation_volume: float
    topping_volume: float
    topping_date: datetime
    operator: str
    notes: Optional[str] = None


class ToppingRecordCreate(ToppingRecordBase):
    pass


class ToppingRecordUpdate(BaseModel):
    notes: Optional[str] = None


class InspectionCreate(BaseModel):
    topping_record_code: str
    inspector: str
    inspection_date: datetime
    appearance: str
    aroma: str
    taste: str
    overall_score: float
    passed: bool
    comments: Optional[str] = None


class InspectionResultBase(BaseModel):
    inspector: str
    inspection_date: datetime
    appearance: str
    aroma: str
    taste: str
    overall_score: float
    passed: bool
    comments: Optional[str] = None


class InspectionResult(InspectionResultBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ToppingRecord(BaseModel):
    id: int
    record_code: str
    barrel_code: str
    source_batch_code: str
    evaporation_volume: float
    topping_volume: float
    topping_date: datetime
    operator: str
    status: str
    inspection_status: str
    is_valid: bool
    version: int
    parent_id: Optional[int]
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    inspection: Optional[InspectionResult] = None
    validity_explanation: Optional[str] = None

    class Config:
        from_attributes = True


class CellarReportBase(BaseModel):
    report_type: str
    start_date: datetime
    end_date: datetime
    generated_by: str


class CellarReportCreate(CellarReportBase):
    pass


class CellarReport(CellarReportBase):
    id: int
    report_code: str
    total_toppings: int
    total_evaporation: float
    total_topping_volume: float
    pass_rate: float
    created_at: datetime

    class Config:
        from_attributes = True


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class ValidationError(BaseModel):
    field: str
    message: str


class ToppingQuery(BaseModel):
    barrel_code: Optional[str] = None
    batch_code: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    only_valid: bool = True
