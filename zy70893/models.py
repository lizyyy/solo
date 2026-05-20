from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class RecordStatus(str, Enum):
    NORMAL = "normal"
    PENDING = "pending"
    FAILED = "failed"


class RepairRecord(BaseModel):
    repair_id: Optional[str] = None
    work_order_id: str
    station_id: str
    material_batch: str
    defect_type: str
    repair_date: datetime
    operator: str
    is_closed: bool = False
    close_date: Optional[datetime] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class WorkOrder(BaseModel):
    work_order_id: str
    product_model: str
    quantity: int
    production_line: str
    start_date: datetime
    end_date: Optional[datetime] = None
    status: str


class MaterialBatch(BaseModel):
    batch_id: str
    material_code: str
    material_name: str
    supplier_id: str
    production_date: datetime
    quantity: int
    is_processed: bool = False


class ProcessedItem(BaseModel):
    status: RecordStatus
    record: Optional[RepairRecord] = None
    raw_data: Dict[str, Any]
    suggestion: Optional[str] = None
    error_code: Optional[str] = None


class ProcessResult(BaseModel):
    total_count: int
    normal_count: int
    pending_count: int
    failed_count: int
    normal_items: List[ProcessedItem]
    pending_items: List[ProcessedItem]
    failed_items: List[ProcessedItem]
    summary: Dict[str, Any]
