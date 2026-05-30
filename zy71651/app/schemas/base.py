from datetime import datetime
from typing import Optional, Generic, TypeVar, List
from pydantic import BaseModel, Field, ConfigDict

T = TypeVar("T")


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        protected_namespaces=(),
    )


class TimestampMixin(BaseSchema):
    created_at: datetime
    updated_at: datetime


class PaginationParams(BaseSchema):
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")


class PaginatedResponse(BaseSchema, Generic[T]):
    items: List[T]
    page: int
    page_size: int
    total: int
    total_pages: int


class SuccessResponse(BaseSchema, Generic[T]):
    code: int = 200
    message: str = "success"
    data: Optional[T] = None


class ErrorDetail(BaseSchema):
    code: str
    message: str
    suggestion: Optional[str] = None
    location: Optional[str] = None
    data_source: Optional[str] = None


class ErrorResponse(BaseSchema):
    code: int
    message: str
    details: Optional[List[ErrorDetail]] = None
    trace_id: Optional[str] = None
