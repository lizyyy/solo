from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class WarmupTaskCreate(BaseModel):
    task_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    data_source_type: str = Field(..., min_length=1, max_length=50)
    data_source_config: str
    cache_key_pattern: str = Field(..., min_length=1, max_length=500)
    version_strategy: str = "timestamp"
    default_concurrency: int = 10
    default_qps_limit: int = 50
    ttl_seconds: Optional[int] = None


class WarmupTaskUpdate(BaseModel):
    description: Optional[str] = None
    data_source_config: Optional[str] = None
    cache_key_pattern: Optional[str] = None
    default_concurrency: Optional[int] = None
    default_qps_limit: Optional[int] = None
    ttl_seconds: Optional[int] = None


class WarmupTaskResponse(BaseModel):
    id: int
    task_name: str
    description: Optional[str] = None
    data_source_type: str
    cache_key_pattern: str
    version_strategy: str
    default_concurrency: int
    default_qps_limit: int
    ttl_seconds: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExecutionStartRequest(BaseModel):
    concurrency: Optional[int] = None
    qps_limit: Optional[int] = None
    force_version: Optional[str] = None


class ExecutionResponse(BaseModel):
    id: int
    task_id: int
    version: str
    status: str
    concurrency: int
    qps_limit: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_items: int
    success_count: int
    failed_count: int
    skipped_count: int
    hit_rate: float
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class ExecutionItemResponse(BaseModel):
    id: int
    execution_id: int
    cache_key: str
    status: str
    data_version: Optional[str] = None
    hit_expected: bool
    hit_actual: Optional[bool] = None
    retry_count: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExecutionHistoryResponse(BaseModel):
    id: int
    execution_id: int
    action_type: str
    action_details: str
    operator: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WarmupReport(BaseModel):
    execution_id: int
    task_name: str
    version: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    total_items: int
    success_count: int
    failed_count: int
    skipped_count: int
    hit_rate: float
    hit_mismatch_count: int
    concurrency: int
    qps_limit: int
    failed_items: List[Dict[str, Any]] = []
    mismatch_items: List[Dict[str, Any]] = []
    history: List[ExecutionHistoryResponse] = []


class PatchRequest(BaseModel):
    cache_keys: List[str]
    operator: Optional[str] = None


class RollbackRequest(BaseModel):
    target_execution_id: Optional[int] = None
    operator: Optional[str] = None


class PagedResponse(BaseModel):
    total: int
    items: List[Any]
    page: int
    page_size: int
