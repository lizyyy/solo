from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class SampleRetentionCreate(BaseModel):
    dish_name: str
    dish_code: str
    sample_time: datetime
    sample_quantity: str
    keeper: str
    storage_location: str
    retention_hours: int = 48
    idempotency_key: Optional[str] = None

class SampleRetentionResponse(BaseModel):
    id: int
    dish_name: str
    dish_code: str
    sample_time: datetime
    sample_quantity: str
    keeper: str
    storage_location: str
    retention_hours: int
    expire_time: datetime
    status: str
    inspection_time: Optional[datetime] = None
    inspector: Optional[str] = None
    inspection_result: Optional[str] = None
    destroy_time: Optional[datetime] = None
    destroyer: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class FridgeTemperatureCreate(BaseModel):
    fridge_code: str
    fridge_name: str
    measure_time: datetime
    temperature: float
    min_temperature: float = 0
    max_temperature: float = 8
    recorder: str
    remark: Optional[str] = None
    idempotency_key: Optional[str] = None

class FridgeTemperatureResponse(BaseModel):
    id: int
    fridge_code: str
    fridge_name: str
    measure_time: datetime
    temperature: float
    min_temperature: float
    max_temperature: float
    is_normal: bool
    recorder: str
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class WasteRecordCreate(BaseModel):
    dish_name: str
    dish_code: str
    waste_time: datetime
    waste_quantity: str
    waste_reason: str
    handler: str
    idempotency_key: Optional[str] = None

class WasteRecordResponse(BaseModel):
    id: int
    dish_name: str
    dish_code: str
    waste_time: datetime
    waste_quantity: str
    waste_reason: str
    handler: str
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class InspectionRequest(BaseModel):
    sample_id: int
    inspector: str
    inspection_result: str

class DestroyRequest(BaseModel):
    sample_id: int
    destroyer: str

class ImportErrorResponse(BaseModel):
    id: int
    file_name: str
    sheet_name: Optional[str] = None
    row_number: int
    original_data: str
    error_reason: str
    suggestion: str
    created_at: datetime
    class Config:
        from_attributes = True

class ImportResult(BaseModel):
    success_count: int
    error_count: int
    import_batch_id: str
    errors: List[ImportErrorResponse]

class ReportItem(BaseModel):
    period: str
    total_samples: int
    inspected_samples: int
    destroyed_samples: int
    active_samples: int
    expired_samples: int
    temperature_records: int
    abnormal_temperatures: int
    waste_records: int
