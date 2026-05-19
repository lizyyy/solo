from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class EventType(str, Enum):
    DOOR_ERROR = "door_error"
    SCAN_FAIL = "scan_fail"
    EMPTY_BIN_FALSE_ALARM = "empty_bin_false_alarm"
    OTHER = "other"


class OrderStatus(str, Enum):
    PENDING = "pending"
    RECEIVED = "received"
    ATTRIBUTED = "attributed"
    DISPATCHED = "dispatched"
    REVIEWED = "reviewed"
    CLOSED = "closed"


class BadRecord(BaseModel):
    id: str
    source_type: str
    original_position: str
    raw_data: Dict[str, Any]
    error_reason: str
    suggestion: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    is_processed: bool = False


class DeviceEvent(BaseModel):
    event_id: str
    device_id: str
    station_id: str
    event_type: EventType
    event_time: datetime
    event_details: Dict[str, Any] = Field(default_factory=dict)
    severity: str = "normal"
    is_processed: bool = False
    created_at: datetime = Field(default_factory=datetime.now)


class ServiceOrder(BaseModel):
    order_id: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    station_id: str
    device_id: Optional[str] = None
    problem_description: str
    report_time: datetime
    source: str = "customer_service"
    status: OrderStatus = OrderStatus.PENDING
    attributed_type: Optional[EventType] = None
    attributed_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class DispatchRecord(BaseModel):
    dispatch_id: str
    order_id: str
    technician_id: str
    technician_name: Optional[str] = None
    technician_phone: Optional[str] = None
    dispatch_time: datetime
    estimated_arrival_time: Optional[datetime] = None
    actual_arrival_time: Optional[datetime] = None
    completion_time: Optional[datetime] = None
    status: str = "pending"
    repair_details: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class ReviewRecord(BaseModel):
    review_id: str
    order_id: str
    reviewer_id: str
    reviewer_name: Optional[str] = None
    review_time: datetime
    review_result: str
    review_notes: Optional[str] = None
    is_verified: bool = False


class WorkOrderStats(BaseModel):
    total: int = 0
    pending: int = 0
    received: int = 0
    attributed: int = 0
    dispatched: int = 0
    reviewed: int = 0
    closed: int = 0


class ImportResult(BaseModel):
    success_count: int
    failed_count: int
    bad_records: List[BadRecord]
    total_processed: int
