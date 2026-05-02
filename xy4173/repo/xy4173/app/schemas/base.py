from datetime import datetime
from typing import Generic, List, Optional, TypeVar, Any
from pydantic import BaseModel, Field


T = TypeVar('T')


class BaseResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class SuccessResponse(BaseResponse):
    data: Optional[Any] = None


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str
    code: Optional[str] = None


class PaginatedResponse(BaseResponse, Generic[T]):
    data: List[T] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0


class ImportResult(BaseModel):
    total: int = 0
    imported: int = 0
    failed: int = 0
    skipped: int = 0
    errors: List[ErrorDetail] = []
    batch_code: Optional[str] = None


class BatchImportResponse(BaseResponse):
    result: Optional[ImportResult] = None
