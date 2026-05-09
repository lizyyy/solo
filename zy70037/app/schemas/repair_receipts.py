from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseSchema

class RepairReceiptBase(BaseModel):
    dispatch_id: int
    worker_id: int
    arrival_time: datetime
    departure_time: Optional[datetime] = None
    diagnosis: str
    solution: str
    work_hours: float = 0
    status: str = "in_progress"
    store_feedback: Optional[str] = None
    store_rating: Optional[int] = None

class RepairReceiptCreate(RepairReceiptBase):
    pass

class RepairReceiptUpdate(BaseModel):
    departure_time: Optional[datetime] = None
    diagnosis: Optional[str] = None
    solution: Optional[str] = None
    work_hours: Optional[float] = None
    status: Optional[str] = None
    store_feedback: Optional[str] = None
    store_rating: Optional[int] = None

class RepairReceipt(BaseSchema):
    dispatch_id: int
    worker_id: int
    receipt_code: str
    arrival_time: datetime
    departure_time: Optional[datetime] = None
    diagnosis: str
    solution: str
    work_hours: float
    status: str
    store_feedback: Optional[str] = None
    store_rating: Optional[int] = None

    class Config:
        from_attributes = True

class RepairReceiptQuery(BaseModel):
    dispatch_id: Optional[int] = None
    worker_id: Optional[int] = None
    status: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    page: int = 1
    page_size: int = 10
