from typing import Generic, TypeVar, Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

T = TypeVar('T')


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "操作成功"
    data: Optional[T] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class ExportRequest(BaseModel):
    format: str = Field("excel", description="导出格式: excel/csv")
    include_bad_data: bool = Field(False, description="是否包含坏数据")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
