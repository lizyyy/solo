from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any

class InventoryItem(BaseModel):
    batch_number: str
    material_name: str
    material_type: Optional[str] = None
    spec: Optional[str] = None
    quantity: float
    unit: str
    production_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    supplier: Optional[str] = None
    store_id: str
    store_name: Optional[str] = None
    is_replacement: bool = False
    replaced_batch: Optional[str] = None
    original_source: Optional[str] = None

    class Config:
        from_attributes = True

class ProcessingResult(BaseModel):
    status: str
    batch_number: str
    material_name: str
    store_id: str
    original_data: Dict[str, Any]
    suggestion: str
    failure_reason: Optional[str] = None

class ProcessingResponse(BaseModel):
    normal_items: List[ProcessingResult]
    pending_items: List[ProcessingResult]
    failed_items: List[ProcessingResult]
    total_count: int
    normal_count: int
    pending_count: int
    failed_count: int

class RecallNoticeCreate(BaseModel):
    title: str
    notice_date: datetime
    issuer: str
    affected_material: str
    affected_batches: str
    reason: str
    level: str

class StoreConsumptionCreate(BaseModel):
    store_id: str
    store_name: str
    batch_number: str
    material_name: str
    consumption_date: datetime
    quantity: float
    unit: str
    patient_id: Optional[str] = None
    dentist: Optional[str] = None
    notes: Optional[str] = None

class ReplacementTrace(BaseModel):
    batch_number: str
    material_name: str
    is_replacement: bool
    replaced_batch_number: Optional[str] = None
    original_source_history: List[Dict[str, Any]] = []
