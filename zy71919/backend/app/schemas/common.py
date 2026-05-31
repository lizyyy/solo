from datetime import datetime
from typing import Generic, List, Optional, TypeVar, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(from_attributes=True)

    code: int = Field(default=200, description="响应码")
    message: str = Field(default="success", description="响应消息")
    data: Optional[T] = Field(default=None, description="响应数据")
    request_id: str = Field(description="请求ID")
    timestamp: str = Field(description="时间戳")


class PaginatedResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(from_attributes=True)

    items: List[T] = Field(description="数据列表")
    total: int = Field(description="总数")
    page: int = Field(description="当前页码")
    page_size: int = Field(description="每页数量")
    total_pages: int = Field(description="总页数")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量")
    sort_by: Optional[str] = Field(default=None, description="排序字段")
    sort_order: Optional[str] = Field(default="desc", description="排序方向")


class MaterialFilterParams(PaginationParams):
    track_no: Optional[str] = Field(default=None, description="音轨编号")
    batch_no: Optional[str] = Field(default=None, description="广告批次")
    material_type: Optional[str] = Field(default=None, description="素材类型")
    status: Optional[str] = Field(default=None, description="状态")
    start_date: Optional[str] = Field(default=None, description="开始日期")
    end_date: Optional[str] = Field(default=None, description="结束日期")
    search_keyword: Optional[str] = Field(default=None, description="搜索关键词")


class ConsistencyCheckResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    passed: bool = Field(description="是否通过")
    screen_count: int = Field(description="屏幕显示数量")
    export_count: int = Field(description="导出数量")
    mismatch_details: List[str] = Field(default_factory=list, description="不一致详情")


class OperationHistoryBase(BaseModel):
    operation_type: str = Field(description="操作类型")
    target_type: str = Field(description="目标类型")
    target_id: int = Field(description="目标ID")
    operator: str = Field(description="操作人")
    remark: Optional[str] = Field(default=None, description="备注")


class OperationHistoryCreate(OperationHistoryBase):
    before_data: Optional[Dict[str, Any]] = Field(default=None, description="变更前数据")
    after_data: Optional[Dict[str, Any]] = Field(default=None, description="变更后数据")
    trace_id: Optional[str] = Field(default=None, description="溯源ID")


class OperationHistoryResponse(OperationHistoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    before_data: Optional[Dict[str, Any]] = None
    after_data: Optional[Dict[str, Any]] = None
    trace_id: Optional[str] = None
    created_at: datetime


class ImportBatchBase(BaseModel):
    import_type: str = Field(description="导入类型")
    filename: str = Field(description="文件名")
    imported_by: str = Field(default="system", description="导入人")


class ImportBatchResponse(ImportBatchBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_no: str
    total_count: int
    success_count: int
    failed_count: int
    skipped_count: int
    error_log: Optional[str]
    status: str
    created_at: datetime
    finished_at: Optional[datetime]


class HealthResponse(BaseModel):
    status: str = Field(default="healthy", description="状态")
    version: str = Field(description="版本")
    timestamp: str = Field(description="时间戳")
