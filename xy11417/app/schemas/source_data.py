from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.core.config import SourceType

class SourceDataBase(BaseModel):
    source_type: SourceType
    source_id: str
    resident_id: Optional[str] = None
    resident_name: Optional[str] = None
    room_number: Optional[str] = None
    repair_type: Optional[str] = None
    repair_content: Optional[str] = None
    submit_time: Optional[datetime] = None
    technician_id: Optional[str] = None
    technician_name: Optional[str] = None
    material_used: Optional[List[Dict[str, Any]]] = None
    material_cost: Optional[float] = 0.0
    work_hours: Optional[float] = 0.0
    completion_status: Optional[str] = None
    receipt_number: Optional[str] = None
    screenshot_urls: Optional[List[str]] = None
    supplementary_reason: Optional[str] = None
    original_order_id: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None

class SourceDataCreate(SourceDataBase):
    pass

class SourceDataSubmit(SourceDataBase):
    auto_process: bool = True

class SourceDataResponse(SourceDataBase):
    id: int
    data_hash: str
    is_valid: bool
    validation_errors: Optional[List[str]] = None
    created_at: datetime
    created_by: Optional[int] = None
    
    class Config:
        from_attributes = True
