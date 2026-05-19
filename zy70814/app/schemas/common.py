from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional, Generic, TypeVar, List

T = TypeVar("T")


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Response(BaseSchema, Generic[T]):
    code: int = 200
    message: str = "success"
    data: Optional[T] = None


class PaginationParams(BaseSchema):
    page: int = 1
    page_size: int = 50


class PaginatedResponse(BaseSchema, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class BatchInfo(BaseSchema):
    batch_id: str
    name: Optional[str] = None
    created_at: datetime
    status: str
    total_records: int = 0
    passed_records: int = 0
    failed_records: int = 0
    warning_records: int = 0
