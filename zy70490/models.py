from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class FieldRevision(BaseModel):
    field_path: str
    original_value: Any
    revised_value: Any
    revision_reason: str
    revised_by: str
    revised_at: datetime
    source: str
    handling_basis: Optional[str] = None


class ProcessingError(BaseModel):
    error_code: str
    error_message: str
    error_details: Optional[Dict[str, Any]] = None
    field_path: Optional[str] = None


class RepairOrder(BaseModel):
    order_id: str
    report_date: str
    property_company: str
    building: str
    unit: str
    repair_type: str
    description: str
    reporter_name: str
    reporter_phone: str
    report_time: datetime
    arrival_time: Optional[datetime] = None
    completion_time: Optional[datetime] = None
    status: str
    cost: Optional[float] = None
    is_cross_day: bool = False
    raw_input: Dict[str, Any]
    revisions: List[FieldRevision] = Field(default_factory=list)
    processing_errors: List[ProcessingError] = Field(default_factory=list)
    has_truncated_fields: bool = False
    truncated_fields: List[str] = Field(default_factory=list)


class AuditTrailReport(BaseModel):
    report_id: str
    generated_at: datetime
    total_orders: int
    cross_day_orders: int
    orders_with_errors: int
    orders_with_revisions: int
    orders_with_truncated_fields: int
    orders: List[RepairOrder]
