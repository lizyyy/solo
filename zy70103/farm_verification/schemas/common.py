from pydantic import BaseModel, Field
from typing import Optional, Generic, TypeVar, Any, List
from datetime import datetime


T = TypeVar('T')


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1, description="页码，从1开始")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量，最大100")


class PageResponse(BaseModel, Generic[T]):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    total_pages: int = Field(..., description="总页数")
    items: List[T] = Field(..., description="数据列表")


class StandardResponse(BaseModel, Generic[T]):
    success: bool = Field(default=True, description="是否成功")
    code: int = Field(default=200, description="业务状态码")
    message: str = Field(default="操作成功", description="业务消息")
    data: Optional[T] = Field(default=None, description="业务数据")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")


class BusinessErrorResponse(BaseModel):
    success: bool = Field(default=False, description="是否成功")
    code: int = Field(default=400, description="业务状态码")
    message: str = Field(..., description="错误消息")
    error_detail: Optional[str] = Field(default=None, description="错误详情")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")


class BusinessOperationLog(BaseModel):
    operation_type: str = Field(..., description="操作类型")
    operation_name: str = Field(..., description="操作名称")
    operator: str = Field(..., description="操作人")
    operation_time: datetime = Field(default_factory=datetime.now, description="操作时间")
    target_type: str = Field(..., description="目标类型")
    target_code: str = Field(..., description="目标编号")
    before_data: Optional[Any] = Field(default=None, description="操作前数据")
    after_data: Optional[Any] = Field(default=None, description="操作后数据")
    reason: Optional[str] = Field(default=None, description="操作原因")
    remark: Optional[str] = Field(default=None, description="备注")
