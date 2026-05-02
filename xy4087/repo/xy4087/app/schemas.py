from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# 字段相关
class FieldBase(BaseModel):
    name: str = Field(..., description="字段名称")
    field_type: str = Field(..., description="字段类型: dimension, metric, sensitive")
    description: Optional[str] = Field(None, description="字段描述")


class FieldCreate(FieldBase):
    pass


class FieldResponse(FieldBase):
    id: int
    dataset_id: int
    sample_values: Optional[str] = None
    is_nullable: bool
    
    class Config:
        from_attributes = True


# 数据集相关
class DatasetBase(BaseModel):
    name: str = Field(..., description="数据集名称")
    description: Optional[str] = Field(None, description="数据集描述")


class DatasetCreate(DatasetBase):
    fields: List[FieldCreate] = Field(..., description="字段列表")
    total_epsilon: float = Field(1.0, description="总隐私预算")
    delta: float = Field(1e-5, description="delta值")
    suppression_threshold: int = Field(5, description="样本抑制阈值")


class DatasetResponse(DatasetBase):
    id: int
    created_at: datetime
    updated_at: datetime
    fields: List[FieldResponse]
    
    class Config:
        from_attributes = True


class DatasetListResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# 预算相关
class BudgetLedgerResponse(BaseModel):
    id: int
    dataset_id: int
    total_epsilon: float
    remaining_epsilon: float
    delta: float
    suppression_threshold: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class BudgetTransactionResponse(BaseModel):
    id: int
    ledger_id: int
    epsilon_used: float
    epsilon_before: float
    epsilon_after: float
    reason: str
    query_id: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


# 查询相关
class QueryRequest(BaseModel):
    group_by: List[str] = Field(..., description="分组维度字段列表")
    aggregations: List[Dict[str, Any]] = Field(..., description="聚合操作列表，如: [{'metric': 'conversion', 'type': 'sum'}, {'type': 'count'}]")
    filters: Optional[Dict[str, Any]] = Field(None, description="筛选条件")
    epsilon: float = Field(0.1, description="本次查询使用的隐私预算")
    use_cache: bool = Field(True, description="是否使用缓存")


class AggregationResult(BaseModel):
    group: Dict[str, Any]
    aggregations: Dict[str, Any]
    suppressed: bool = Field(False, description="是否被抑制")
    noise_scale: Optional[float] = None


class QueryResponse(BaseModel):
    dataset_id: int
    query_hash: str
    epsilon_used: float
    from_cache: bool
    results: List[AggregationResult]
    suppressed_count: int
    total_groups: int


# 审计相关
class AuditLogResponse(BaseModel):
    id: int
    dataset_id: int
    query_type: str
    query_parameters: str
    epsilon_used: float
    result_hash: Optional[str]
    client_info: Optional[str]
    status: str
    error_message: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# 报告相关
class ReportRequest(BaseModel):
    format: str = Field("markdown", description="报告格式: markdown, csv")
    include_transactions: bool = Field(True, description="包含预算交易记录")
    include_audit_logs: bool = Field(True, description="包含审计日志")


class ReportResponse(BaseModel):
    dataset_id: int
    dataset_name: str
    generated_at: datetime
    format: str
    content: str


# 通用响应
class MessageResponse(BaseModel):
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    detail: str
    success: bool = False
