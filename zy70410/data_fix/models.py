from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class RiskType(str, Enum):
    PERMISSION_OVER_GRANTED = "permission_over_granted"
    DATA_INCONSISTENCY = "data_inconsistency"
    STATUS_ABNORMAL = "status_abnormal"
    GRAYSCALE_RECORD = "grayscale_record"
    OTHER = "other"


class RepairStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PermissionLevel(str, Enum):
    NORMAL = "normal"
    SUPERVISOR = "supervisor"
    ADMIN = "admin"


class PropertyRepairOrder(BaseModel):
    order_id: str
    community_id: str
    community_name: str
    report_time: datetime
    repair_type: str
    description: str
    reporter_id: str
    reporter_name: str
    handler_id: Optional[str] = None
    handler_name: Optional[str] = None
    status: RepairStatus
    permission_level: PermissionLevel = PermissionLevel.NORMAL
    completion_time: Optional[datetime] = None
    is_cross_day: bool = False
    source_field_path: str = "property.repair.order"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FixSuggestion(BaseModel):
    order_id: str
    risk_type: RiskType
    field_path: str
    current_value: Any
    suggested_value: Any
    reason: str
    basis: str
    original_row_index: int


class ExecutionResult(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class FixRecord(BaseModel):
    order_id: str
    risk_type: RiskType
    field_path: str
    old_value: Any
    new_value: Any
    result: ExecutionResult
    error_message: Optional[str] = None
    executed_at: datetime = Field(default_factory=datetime.now)


class BatchExecutionReport(BaseModel):
    batch_id: str
    operator: str
    start_time: datetime
    end_time: Optional[datetime] = None
    total_count: int = 0
    success_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0
    fix_records: List[FixRecord] = Field(default_factory=list)
    failed_records: List[FixRecord] = Field(default_factory=list)
    next_steps: List[str] = Field(default_factory=list)
    grayscale_notes: List[Dict[str, Any]] = Field(default_factory=list)
