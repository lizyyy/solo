from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime


class BedStatus(str, Enum):
    OCCUPIED = "occupied"
    VACANT = "vacant"
    CLEANING = "cleaning"
    CLEANING_TIMEOUT = "cleaning_timeout"
    TRANSFER_LOCKED = "transfer_locked"


class PatientFlowType(str, Enum):
    ADMISSION = "admission"
    DISCHARGE = "discharge"
    TRANSFER = "transfer"


class CleaningOrderStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    TIMEOUT = "timeout"


class BedInfo(BaseModel):
    batch_id: str
    ward_code: str
    bed_number: str
    status: BedStatus
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    last_updated: datetime
    is_locked: bool = False
    lock_reason: Optional[str] = None


class PatientFlow(BaseModel):
    batch_id: str
    flow_id: str
    flow_type: PatientFlowType
    patient_id: str
    patient_name: str
    from_ward: Optional[str] = None
    from_bed: Optional[str] = None
    to_ward: Optional[str] = None
    to_bed: Optional[str] = None
    event_time: datetime


class CleaningOrder(BaseModel):
    batch_id: str
    order_id: str
    ward_code: str
    bed_number: str
    create_time: datetime
    start_time: Optional[datetime] = None
    complete_time: Optional[datetime] = None
    status: CleaningOrderStatus
    cleaning_staff: Optional[str] = None


class ResultItem(BaseModel):
    record_type: str
    record_id: str
    original_data: Dict[str, Any]
    suggestion: Optional[str] = None


class ImportResponse(BaseModel):
    batch_id: str
    total_count: int
    success_count: int
    pending_count: int
    failed_count: int
    success_items: List[ResultItem]
    pending_items: List[ResultItem]
    failed_items: List[ResultItem]
    processed_at: datetime = Field(default_factory=datetime.now)
