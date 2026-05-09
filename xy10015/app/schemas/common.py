from datetime import datetime
from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field
from decimal import Decimal


T = TypeVar('T')


class BaseResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[T] = None


class PaginatedResponse(BaseModel, Generic[T]):
    code: int = 200
    message: str = "success"
    data: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedRequest(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    keyword: Optional[str] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = Field(default="desc", pattern="^(asc|desc)$")


class BatchOperationRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1)
    action: str


class BatchOperationResult(BaseModel):
    success_count: int
    failed_count: int
    errors: List[dict] = []
