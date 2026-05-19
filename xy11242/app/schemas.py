from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from app.models import BookCondition, BookStatus, GradeLevel, ExceptionType, ImportSource
import re


class BookBase(BaseModel):
    isbn: Optional[str] = Field(None, max_length=20)
    title: Optional[str] = Field(None, max_length=200)
    author: Optional[str] = Field(None, max_length=100)
    publisher: Optional[str] = Field(None, max_length=100)
    condition: Optional[BookCondition] = None
    grade_level: Optional[GradeLevel] = None
    volunteer: Optional[str] = Field(None, max_length=50)
    remarks: Optional[str] = None
    shelf_location: Optional[str] = Field(None, max_length=50)


class BookCreate(BookBase):
    pass


class BookUpdate(BaseModel):
    isbn: Optional[str] = Field(None, max_length=20)
    title: Optional[str] = Field(None, max_length=200)
    author: Optional[str] = Field(None, max_length=100)
    publisher: Optional[str] = Field(None, max_length=100)
    condition: Optional[BookCondition] = None
    grade_level: Optional[GradeLevel] = None
    status: Optional[BookStatus] = None
    volunteer: Optional[str] = Field(None, max_length=50)
    remarks: Optional[str] = None
    shelf_location: Optional[str] = Field(None, max_length=50)


class BookResponse(BookBase):
    id: int
    status: BookStatus
    import_source: Optional[ImportSource]
    import_batch_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class StatusHistoryBase(BaseModel):
    book_id: int
    old_status: Optional[BookStatus]
    new_status: BookStatus
    changed_by: Optional[str] = Field(None, max_length=50)
    change_reason: Optional[str] = None


class StatusHistoryCreate(StatusHistoryBase):
    pass


class StatusHistoryResponse(StatusHistoryBase):
    id: int
    changed_at: datetime

    class Config:
        orm_mode = True


class BookExceptionBase(BaseModel):
    book_id: int
    exception_type: ExceptionType
    description: str
    suggestion: Optional[str] = None


class BookExceptionCreate(BookExceptionBase):
    pass


class BookExceptionResponse(BookExceptionBase):
    id: int
    resolved: bool
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        orm_mode = True


class BadRecordBase(BaseModel):
    original_position: str
    raw_data: str
    failure_reason: str
    suggestion: Optional[str] = None


class BadRecordCreate(BadRecordBase):
    pass


class BadRecordResponse(BadRecordBase):
    id: int
    import_log_id: int
    is_retried: bool
    retried_at: Optional[datetime]
    resolved: bool

    class Config:
        orm_mode = True


class ImportLogBase(BaseModel):
    source: ImportSource
    file_name: str
    imported_by: str


class ImportLogCreate(ImportLogBase):
    batch_id: str


class ImportLogResponse(ImportLogBase):
    id: int
    batch_id: str
    total_records: int
    success_count: int
    failed_count: int
    imported_at: datetime
    completed_at: Optional[datetime]
    bad_records: List[BadRecordResponse] = []

    class Config:
        orm_mode = True


class BatchOperationResult(BaseModel):
    success_count: int
    failed_count: int
    successful_ids: List[int]
    failed_items: List[dict]


class BookQueryParams(BaseModel):
    volunteer: Optional[str] = None
    status: Optional[BookStatus] = None
    exception_type: Optional[ExceptionType] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    grade_level: Optional[GradeLevel] = None
    condition: Optional[BookCondition] = None


class ISBNValidator:
    @staticmethod
    def validate_isbn10(isbn: str) -> bool:
        isbn = isbn.replace("-", "").replace(" ", "")
        if len(isbn) != 10:
            return False
        try:
            total = sum((i + 1) * int(isbn[i]) for i in range(9))
            check = isbn[9]
            if check.upper() == 'X':
                check_val = 10
            else:
                check_val = int(check)
            return (total + check_val) % 11 == 0
        except:
            return False

    @staticmethod
    def validate_isbn13(isbn: str) -> bool:
        isbn = isbn.replace("-", "").replace(" ", "")
        if len(isbn) != 13:
            return False
        try:
            total = sum(int(isbn[i]) * (1 if i % 2 == 0 else 3) for i in range(12))
            check = int(isbn[12])
            return (10 - (total % 10)) % 10 == check
        except:
            return False

    @classmethod
    def validate(cls, isbn: str) -> bool:
        if not isbn:
            return False
        isbn_clean = isbn.replace("-", "").replace(" ", "")
        if len(isbn_clean) == 10:
            return cls.validate_isbn10(isbn_clean)
        elif len(isbn_clean) == 13:
            return cls.validate_isbn13(isbn_clean)
        return False
