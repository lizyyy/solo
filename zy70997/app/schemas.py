from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime


class ClaimItem(BaseModel):
    employee_id: str
    employee_name: str
    coupon_code: Optional[str] = None
    claim_type: str
    is_proxy: bool = False
    proxy_employee_id: Optional[str] = None
    proxy_employee_name: Optional[str] = None
    delivery_method: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    remark: Optional[str] = None


class EmployeeItem(BaseModel):
    employee_id: str
    name: str
    department: Optional[str] = None
    is_active: bool = True


class CouponItem(BaseModel):
    coupon_code: str
    coupon_type: str
    value: Optional[str] = None


class ProcessedItem(BaseModel):
    original_data: Dict[str, Any]
    status: str
    reason: str
    suggestion: str


class ProcessResult(BaseModel):
    batch_id: str
    total_count: int
    success_count: int
    pending_count: int
    failed_count: int
    success_items: List[ProcessedItem]
    pending_items: List[ProcessedItem]
    failed_items: List[ProcessedItem]
    created_at: datetime


class BatchInfo(BaseModel):
    batch_id: str
    file_name: Optional[str]
    total_count: int
    success_count: int
    pending_count: int
    failed_count: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
