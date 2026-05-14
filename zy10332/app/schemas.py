from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class DatasetBase(BaseModel):
    name: str = Field(..., description="数据集名称")
    description: Optional[str] = Field(None, description="数据集描述")
    expected_frequency_seconds: int = Field(..., gt=0, description="预期更新频率（秒）")
    owner: Optional[str] = Field(None, description="数据集负责人")
    tags: Optional[List[str]] = Field(None, description="标签列表")


class DatasetCreate(DatasetBase):
    pass


class DatasetUpdate(BaseModel):
    description: Optional[str] = None
    expected_frequency_seconds: Optional[int] = Field(None, gt=0)
    owner: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class Dataset(DatasetBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FreshnessRecordBase(BaseModel):
    dataset_id: str = Field(..., description="数据集ID")
    source_updated_at: datetime = Field(..., description="数据源更新时间")
    cache_updated_at: datetime = Field(..., description="缓存更新时间")
    sync_watermark: Optional[str] = Field(None, description="同步水位标识")
    query_consumer: Optional[str] = Field(None, description="查询方标识")
    record_metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")


class FreshnessRecordCreate(FreshnessRecordBase):
    request_id: Optional[str] = Field(None, description="请求ID，用于幂等性控制")

    @field_validator('cache_updated_at')
    @classmethod
    def cache_not_before_source(cls, v, info):
        values = info.data
        if 'source_updated_at' in values and v < values['source_updated_at']:
            raise ValueError('缓存更新时间不能早于数据源更新时间')
        return v


class FreshnessRecord(FreshnessRecordBase):
    id: str
    is_fresh: bool
    freshness_score: float
    is_expired: bool
    expiration_explanation: str
    recorded_at: datetime
    request_id: Optional[str]

    class Config:
        from_attributes = True


class FreshnessCheckRequest(BaseModel):
    dataset_id: str = Field(..., description="数据集ID")
    query_consumer: Optional[str] = Field(None, description="查询方标识")
    reference_time: Optional[datetime] = Field(None, description="参考时间，默认为当前时间")


class FreshnessCheckResult(BaseModel):
    dataset_id: str
    dataset_name: str
    is_fresh: bool
    freshness_score: float
    is_expired: bool
    expiration_explanation: str
    source_updated_at: datetime
    cache_updated_at: datetime
    sync_watermark: Optional[str]
    expected_frequency_seconds: int
    last_sync_age_seconds: float
    checked_at: datetime
    query_consumer: Optional[str]


class WatermarkAdvanceRequest(BaseModel):
    dataset_id: str = Field(..., description="数据集ID")
    new_watermark: str = Field(..., description="新的同步水位")
    source_updated_at: datetime = Field(..., description="数据源更新时间")
    operator: Optional[str] = Field(None, description="操作人")


class WatermarkAdvanceResult(BaseModel):
    dataset_id: str
    old_watermark: Optional[str]
    new_watermark: str
    is_advanced: bool
    message: str
    advanced_at: datetime


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime


class HistoryQueryParams(BaseModel):
    dataset_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    query_consumer: Optional[str] = None
    is_expired: Optional[bool] = None
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)


class PaginatedFreshnessRecords(BaseModel):
    total: int
    limit: int
    offset: int
    records: List[FreshnessRecord]


class SubscriptionCreate(BaseModel):
    dataset_id: str = Field(..., description="数据集ID")
    subscriber: str = Field(..., description="订阅者标识")
    notification_channel: str = Field("api", description="通知渠道")
    threshold_score: float = Field(0.5, ge=0, le=1, description="新鲜度阈值")
    notify_on_expired: bool = Field(True, description="过期时通知")
    is_active: bool = Field(True, description="是否激活")


class SubscriptionUpdate(BaseModel):
    threshold_score: Optional[float] = Field(None, ge=0, le=1)
    notify_on_expired: Optional[bool] = None
    is_active: Optional[bool] = None


class Subscription(BaseModel):
    id: str
    dataset_id: str
    subscriber: str
    notification_channel: str
    threshold_score: float
    notify_on_expired: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Notification(BaseModel):
    id: str
    subscription_id: str
    dataset_id: str
    subscriber: str
    notification_type: str
    message: str
    freshness_score: float
    is_expired: bool
    is_sent: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ExportFormat(BaseModel):
    format: str = Field("json", description="导出格式: json 或 csv")
    include_metadata: bool = Field(True, description="是否包含元数据")
