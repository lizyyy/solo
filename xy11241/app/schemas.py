from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from .utils import normalize_isbn, validate_grade, validate_condition, is_valid_isbn


class BookBase(BaseModel):
    isbn: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    author: Optional[str] = None
    publisher: Optional[str] = None
    condition: str
    grade: str
    book_count: int = Field(default=1, ge=1)
    donor_name: Optional[str] = None
    donor_phone: Optional[str] = None
    donor_idcard: Optional[str] = None
    remarks: Optional[str] = None
    status: str = "待上架"


class BookCreate(BookBase):
    pass


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    condition: Optional[str] = None
    grade: Optional[str] = None
    book_count: Optional[int] = None
    donor_name: Optional[str] = None
    donor_phone: Optional[str] = None
    donor_idcard: Optional[str] = None
    remarks: Optional[str] = None
    status: Optional[str] = None


class Book(BookBase):
    id: int
    isbn_normalized: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class BookWithReason(BaseModel):
    book: Optional[dict] = None
    success: bool
    reason: str
    action: str
    is_duplicate: bool = False
    row_number: Optional[int] = None


class BatchImportRequest(BaseModel):
    books: List[BookCreate]
    operator_name: Optional[str] = None
    operator_phone: Optional[str] = None


class BatchImportResponse(BaseModel):
    batch_no: str
    total_count: int
    success_count: int
    failed_count: int
    results: List[BookWithReason]
    status: str


class ImportRecordBase(BaseModel):
    id: int
    batch_id: int
    book_id: Optional[int] = None
    row_number: Optional[int] = None
    is_success: bool
    is_duplicate: bool
    action_taken: str
    reason: str
    isbn: Optional[str] = None
    title: Optional[str] = None
    condition: Optional[str] = None
    grade: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ImportBatchBase(BaseModel):
    id: int
    batch_no: str
    total_count: int
    success_count: int
    failed_count: int
    operator_name: Optional[str] = None
    operator_phone: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ImportBatchDetail(ImportBatchBase):
    records: List[ImportRecordBase] = []


class OperationLogBase(BaseModel):
    id: int
    operation_type: str
    operator_name: Optional[str] = None
    operator_phone: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    change_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ShelfListRequest(BaseModel):
    grade: Optional[str] = None
    condition: Optional[str] = None
    status: Optional[str] = "待上架"


class StatisticsResponse(BaseModel):
    total_books: int
    total_unique_books: int
    by_grade: dict
    by_condition: dict
    by_status: dict


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
