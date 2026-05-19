from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class ReceiveOrderRequest(BaseModel):
    order_id: str
    station_id: str
    problem_description: str
    report_time: datetime
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    device_id: Optional[str] = None
    source: str = "customer_service"
    idempotency_key: Optional[str] = None


class AttributeOrderRequest(BaseModel):
    order_id: str
    attributed_type: str
    attributed_reason: str
    idempotency_key: Optional[str] = None


class DispatchRequest(BaseModel):
    order_id: str
    technician_id: str
    technician_name: Optional[str] = None
    technician_phone: Optional[str] = None
    estimated_arrival_time: Optional[datetime] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None


class ReviewRequest(BaseModel):
    order_id: str
    reviewer_id: str
    reviewer_name: Optional[str] = None
    review_result: str
    review_notes: Optional[str] = None
    is_verified: bool = False
    idempotency_key: Optional[str] = None


class ExportRequest(BaseModel):
    format: str = "csv"
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
