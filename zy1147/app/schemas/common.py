from typing import Generic, List, TypeVar, Optional
from pydantic import BaseModel, Field
from datetime import datetime

T = TypeVar('T')


class SuccessResponse(BaseModel):
    success: bool = True
    message: str = "操作成功"
    data: Optional[dict] = None


class ErrorResponse(BaseModel):
    success: bool = False
    message: str = "操作失败"
    error_code: str = "UNKNOWN_ERROR"
    details: Optional[dict] = None


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class TimestampMixin(BaseModel):
    created_at: datetime = Field(description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True
