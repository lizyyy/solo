"""数据模型定义"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, validator


class WorkOrderStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ConflictType(str, Enum):
    DUPLICATE_TICKET = "duplicate_ticket"
    FIELD_CONFLICT = "field_conflict"
    TIMELINE_CONFLICT = "timeline_conflict"
    PHOTO_MISMATCH = "photo_mismatch"
    SPARE_PART_OVERCONSUMPTION = "spare_part_overconsumption"
    DEVICE_NOT_FOUND = "device_not_found"
    INVALID_STATUS = "invalid_status"


class MergeStrategy(str, Enum):
    FIRST_WINS = "first_wins"
    LAST_WINS = "last_wins"
    MAJORITY_VOTE = "majority_vote"
    TIMELINE_ORDER = "timeline_order"
    MANUAL = "manual"


class Engineer(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str
    employee_id: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None

    class Config:
        frozen = True


class PhotoItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    filename: str
    file_hash: Optional[str] = None
    file_size: Optional[int] = None
    photo_type: str = Field(default="unknown")
    description: Optional[str] = None
    capture_time: Optional[datetime] = None
    device_id: Optional[str] = None
    location: Optional[str] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class SparePart(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    part_number: str
    part_name: str
    quantity: int = Field(default=1, ge=0)
    unit_price: Optional[float] = Field(default=None, ge=0)
    warehouse_location: Optional[str] = None
    used_at: Optional[datetime] = None
    engineer_id: Optional[str] = None
    work_order_id: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class WorkOrder(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    ticket_number: str
    device_id: str
    device_name: Optional[str] = None
    device_location: Optional[str] = None
    
    status: WorkOrderStatus = Field(default=WorkOrderStatus.PENDING)
    priority: str = Field(default="normal")
    
    engineer_id: Optional[str] = None
    engineer_name: Optional[str] = None
    
    issue_description: Optional[str] = None
    inspection_results: Optional[str] = None
    solution_taken: Optional[str] = None
    temporary_measures: Optional[str] = None
    
    photos: List[PhotoItem] = Field(default_factory=list)
    spare_parts: List[SparePart] = Field(default_factory=list)
    
    scheduled_time: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    estimated_duration: Optional[float] = None
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    imported_from: Optional[str] = None
    source_engineer_id: Optional[str] = None
    
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    
    @validator("updated_at", pre=True, always=True)
    def set_updated_at(cls, v, values):
        if v is None:
            return values.get("created_at", datetime.now())
        return v

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class ImportedTicket(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    original_filename: str
    source_engineer: Optional[Engineer] = None
    imported_at: datetime = Field(default_factory=datetime.now)
    work_orders: List[WorkOrder] = Field(default_factory=list)
    raw_content: Optional[str] = None
    file_hash: Optional[str] = None
    validation_errors: List[str] = Field(default_factory=list)
    is_valid: bool = True

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class MergeConflict(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    conflict_type: ConflictType
    work_order_id: str
    ticket_number: str
    
    field_name: Optional[str] = None
    values: List[Dict[str, Any]] = Field(default_factory=list)
    
    source_tickets: List[str] = Field(default_factory=list)
    source_engineers: List[str] = Field(default_factory=list)
    
    description: Optional[str] = None
    severity: str = Field(default="warning")
    
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    is_resolved: bool = False

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class InventoryCheckResult(BaseModel):
    part_number: str
    part_name: str
    
    available_quantity: int
    requested_quantity: int
    total_consumed: int
    
    is_overconsumed: bool
    overconsumption_amount: int
    
    consuming_tickets: List[str] = Field(default_factory=list)
    consuming_engineers: List[str] = Field(default_factory=list)
    
    notes: Optional[str] = None


class WorkOrderSnapshot(BaseModel):
    work_order: WorkOrder
    source_tickets: List[str]
    merge_strategy_used: MergeStrategy
    resolved_conflicts: List[str] = Field(default_factory=list)
    unresolved_conflicts: List[str] = Field(default_factory=list)
    merged_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class MergeResult(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    merged_at: datetime = Field(default_factory=datetime.now)
    
    total_input_tickets: int
    total_work_orders: int
    unique_tickets: int
    
    merged_work_orders: List[WorkOrderSnapshot] = Field(default_factory=list)
    conflicts: List[MergeConflict] = Field(default_factory=list)
    inventory_checks: List[InventoryCheckResult] = Field(default_factory=list)
    
    duplicate_tickets_found: int = 0
    field_conflicts_found: int = 0
    inventory_issues_found: int = 0
    
    is_complete: bool = False

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class AuditReport(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    generated_at: datetime = Field(default_factory=datetime.now)
    report_version: str = "1.0"
    
    repository_path: str
    merge_result: MergeResult
    
    summary: Dict[str, Any] = Field(default_factory=dict)
    details: Dict[str, Any] = Field(default_factory=dict)
    
    export_format: str = "markdown"
    export_path: Optional[str] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
