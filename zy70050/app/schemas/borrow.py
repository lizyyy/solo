from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

from app.models.borrow import BorrowStatus


class BorrowBase(BaseModel):
    instrument_id: int
    borrower_id: int
    purpose: str
    department: str
    workshop: Optional[str] = None
    work_order: Optional[str] = None
    borrow_date: date
    expected_return_date: date


class BorrowCreate(BorrowBase):
    pass


class BorrowReturn(BaseModel):
    return_date: date
    return_condition: Optional[str] = None
    remarks: Optional[str] = None


class BorrowUpdate(BaseModel):
    purpose: Optional[str] = None
    department: Optional[str] = None
    workshop: Optional[str] = None
    work_order: Optional[str] = None
    expected_return_date: Optional[date] = None
    remarks: Optional[str] = None


class BorrowResponse(BorrowBase):
    id: int
    status: BorrowStatus
    is_overdue: bool
    overdue_notice_count: int
    actual_return_date: Optional[date] = None
    return_condition: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
