from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "normal"
    PENDING_CONFIRM = "pending_confirm"
    FAILED = "failed"


class RepairStatus(str, Enum):
    SUBMITTED = "submitted"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RepairRecord(BaseModel):
    repair_id: str
    student_id: str
    student_name: str
    building: str
    room: str
    repair_type: str
    description: str
    submit_time: datetime
    status: RepairStatus = RepairStatus.SUBMITTED
    worker_id: Optional[str] = None
    complete_time: Optional[datetime] = None


class WorkerRecord(BaseModel):
    worker_id: str
    worker_name: str
    phone: str
    skills: List[str]
    rating: float = 5.0
    total_orders: int = 0
    timeout_count: int = 0
    penalty_points: float = 0.0
    penalty_records: List[Dict[str, Any]] = []


class RatingRecord(BaseModel):
    rating_id: str
    repair_id: str
    student_id: str
    worker_id: str
    score: int
    comment: str
    rating_time: datetime


class ProcessedRecord(BaseModel):
    original_data: Dict[str, Any]
    status: RecordStatus
    reason: Optional[str] = None
    suggestion: Optional[str] = None
    record_type: str


class BatchProcessResult(BaseModel):
    batch_id: str
    process_time: datetime
    total_count: int
    normal_count: int
    pending_count: int
    failed_count: int
    normal_records: List[ProcessedRecord]
    pending_records: List[ProcessedRecord]
    failed_records: List[ProcessedRecord]


class BatchStatus(BaseModel):
    batch_id: str
    created_at: datetime
    status: str
    total_count: int
    normal_count: int
    pending_count: int
    failed_count: int
