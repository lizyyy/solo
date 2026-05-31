from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = Field(default=200, description="状态码")
    message: str = Field(default="success", description="消息")
    user_friendly_message: str = Field(default="操作成功～", description="用户友好消息")
    data: Optional[T] = Field(default=None, description="数据")
    timestamp: datetime = Field(default_factory=datetime.now, description="时间戳")

    @classmethod
    def success(cls, data: Any = None, message: str = "success", user_friendly_message: str = "操作成功～"):
        return cls(
            code=200,
            message=message,
            user_friendly_message=user_friendly_message,
            data=data
        )

    @classmethod
    def error(cls, code: int = 400, message: str = "error", user_friendly_message: str = "操作失败～", data: Any = None):
        return cls(
            code=code,
            message=message,
            user_friendly_message=user_friendly_message,
            data=data
        )


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=10, ge=1, le=100, description="每页数量")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T] = Field(description="数据列表")
    total: int = Field(description="总数")
    page: int = Field(description="当前页码")
    page_size: int = Field(description="每页数量")
    total_pages: int = Field(description="总页数")
