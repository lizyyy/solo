from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.database import SecondReadStatus, BorrowStatus


class SlideBase(BaseModel):
    slide_number: str
    patient_id: str
    patient_name: str
    specimen_type: Optional[str] = None
    collection_date: Optional[datetime] = None


class SlideCreate(SlideBase):
    pass


class Slide(SlideBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SecondReadBase(BaseModel):
    slide_number: str
    first_read_doctor: str
    first_read_opinion: str
    first_read_date: datetime
    second_read_doctor: Optional[str] = None
    deadline: Optional[datetime] = None


class SecondReadCreate(SecondReadBase):
    pass


class SecondReadUpdate(BaseModel):
    second_read_opinion: Optional[str] = None
    second_read_date: Optional[datetime] = None
    revision_opinion: Optional[str] = None
    revision_date: Optional[datetime] = None


class SecondRead(SecondReadBase):
    id: int
    slide_id: int
    status: SecondReadStatus
    second_read_opinion: Optional[str] = None
    second_read_date: Optional[datetime] = None
    revision_opinion: Optional[str] = None
    revision_date: Optional[datetime] = None
    is_report_issued: bool
    report_issued_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BorrowRecordBase(BaseModel):
    slide_number: str
    borrower: str
    borrower_department: str
    borrow_date: datetime
    due_date: datetime
    notes: Optional[str] = None


class BorrowRecordCreate(BorrowRecordBase):
    pass


class BorrowRecordReturn(BaseModel):
    return_date: datetime


class BorrowRecord(BorrowRecordBase):
    id: int
    slide_id: int
    return_date: Optional[datetime] = None
    status: BorrowStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OpinionVersionBase(BaseModel):
    slide_number: str
    doctor: str
    opinion: str
    opinion_type: str


class OpinionVersionCreate(OpinionVersionBase):
    pass


class OpinionVersion(OpinionVersionBase):
    id: int
    slide_id: int
    version_number: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewRecordBase(BaseModel):
    second_read_id: int
    reviewer: str
    review_opinion: str
    is_approved: bool


class ReviewRecordCreate(ReviewRecordBase):
    pass


class ReviewRecord(ReviewRecordBase):
    id: int
    review_date: datetime

    class Config:
        from_attributes = True


class ImportResponse(BaseModel):
    slide_number: str
    status: str
    message: str
    is_duplicate: bool
    existing_record: Optional[dict] = None


class ValidationError(BaseModel):
    field: str
    message: str


class SecondReadDetail(SecondRead):
    slide: Slide
    borrow_records: List[BorrowRecord] = []
    opinion_versions: List[OpinionVersion] = []
    review_records: List[ReviewRecord] = []


class OverdueAlert(BaseModel):
    slide_number: str
    patient_name: str
    type: str
    overdue_days: int
    message: str


class ReportData(BaseModel):
    slide_number: str
    patient_name: str
    patient_id: str
    specimen_type: str
    first_read_doctor: str
    first_read_opinion: str
    first_read_date: datetime
    second_read_doctor: Optional[str] = None
    second_read_opinion: Optional[str] = None
    second_read_date: Optional[datetime] = None
    revision_opinion: Optional[str] = None
    revision_date: Optional[datetime] = None
    borrow_history: List[dict]
    opinion_history: List[dict]
    report_date: datetime
