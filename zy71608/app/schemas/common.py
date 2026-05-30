from datetime import datetime, date
from typing import Optional, Generic, TypeVar, List
from pydantic import BaseModel, Field, ConfigDict

T = TypeVar("T")


class ResponseModel(BaseModel, Generic[T]):
    code: int = Field(default=200, description="响应码")
    message: str = Field(default="success", description="响应消息")
    data: Optional[T] = Field(default=None, description="响应数据")
    timestamp: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel, Generic[T]):
    code: int = Field(default=200)
    message: str = Field(default="success")
    data: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    timestamp: datetime = Field(default_factory=datetime.now)


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    keyword: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ImportResult(BaseModel):
    file_name: str
    document_type: str
    total_rows: int
    success_rows: int
    error_rows: int
    warning_rows: int
    duplicate_rows: int
    empty_columns_removed: int
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    imported_ids: List[int] = Field(default_factory=list)


class AuditLogInfo(BaseModel):
    id: int
    operation_type: str
    operator: str
    table_name: Optional[str]
    record_id: Optional[int]
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    change_reason: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
