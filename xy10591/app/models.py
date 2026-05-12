from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


class BatchStatus(str, Enum):
    CREATED = "CREATED"
    INSPECTION_PENDING = "INSPECTION_PENDING"
    INSPECTION_PASSED = "INSPECTION_PASSED"
    INSPECTION_FAILED = "INSPECTION_FAILED"
    IN_WAREHOUSE = "IN_WAREHOUSE"
    MIXED = "MIXED"
    SORTED = "SORTED"
    OUTBOUND = "OUTBOUND"
    FROZEN = "FROZEN"
    RECALLED = "RECALLED"
    CANCELLED = "CANCELLED"


class InspectionStatus(str, Enum):
    PENDING = "PENDING"
    PASSED = "PASSED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


class BoxStatus(str, Enum):
    IN_WAREHOUSE = "IN_WAREHOUSE"
    IN_MIXED_BATCH = "IN_MIXED_BATCH"
    SORTED = "SORTED"
    OUTBOUND = "OUTBOUND"
    FROZEN = "FROZEN"
    RECALLED = "RECALLED"


class Origin(BaseModel):
    farm_id: str
    farm_name: str
    region: str
    country: str


class InspectionReport(BaseModel):
    report_id: str
    batch_id: str
    inspector_id: str
    inspection_date: datetime
    expiry_date: datetime
    status: InspectionStatus
    items: List[Dict[str, Any]]
    remarks: Optional[str] = None


class Batch(BaseModel):
    batch_id: str
    parent_batch_id: Optional[str] = None
    origin: Origin
    product_type: str
    quantity: int
    unit: str
    arrival_date: datetime
    status: BatchStatus = BatchStatus.CREATED
    inspection_report: Optional[InspectionReport] = None
    is_mixed: bool = False
    source_batches: List[str] = []
    child_batches: List[str] = []
    boxes: List[str] = []
    frozen: bool = False
    frozen_reason: Optional[str] = None
    frozen_at: Optional[datetime] = None
    recalled: bool = False
    recalled_at: Optional[datetime] = None
    outbound_at: Optional[datetime] = None


class Box(BaseModel):
    box_id: str
    batch_id: str
    original_batch_id: str
    status: BoxStatus = BoxStatus.IN_WAREHOUSE
    frozen: bool = False
    frozen_reason: Optional[str] = None
    frozen_at: Optional[datetime] = None
    recalled: bool = False
    recalled_at: Optional[datetime] = None
    outbound_at: Optional[datetime] = None
    destination: Optional[str] = None


class AuditLog(BaseModel):
    log_id: str
    operation: str
    operator_id: str
    operator_name: str
    entity_type: str
    entity_id: str
    action: str
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    diff: Optional[Dict[str, Any]] = None
    remarks: Optional[str] = None
    status: str
    failure_reason: Optional[str] = None
    timestamp: datetime
    idempotency_key: Optional[str] = None


class RecallRequest(BaseModel):
    recall_id: str
    reason: str
    source_batch_ids: List[str]
    requester_id: str
    created_at: datetime
    executed: bool = False
    executed_at: Optional[datetime] = None
    affected_boxes: List[str] = []
    affected_batches: List[str] = []


class FreezeRequest(BaseModel):
    freeze_id: str
    reason: str
    entity_type: str
    entity_id: str
    operator_id: str
    created_at: datetime
    executed: bool = False
    executed_at: Optional[datetime] = None
