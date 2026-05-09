from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field, ConfigDict


class MessageStatus(str, Enum):
    PENDING = "pending"
    RETRYING = "retrying"
    SUCCESS = "success"
    DEAD_LETTER = "dead_letter"
    ARCHIVED = "archived"


class ErrorCategory(str, Enum):
    NETWORK_ERROR = "network_error"
    TIMEOUT = "timeout"
    BUSINESS_ERROR = "business_error"
    VALIDATION_ERROR = "validation_error"
    PERMISSION_ERROR = "permission_error"
    DATA_ERROR = "data_error"
    SYSTEM_ERROR = "system_error"
    UNKNOWN = "unknown"


class RetryStrategy(str, Enum):
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    FIXED_INTERVAL = "fixed_interval"
    IMMEDIATE = "immediate"


class CompensationMessage(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str = Field(..., description="消息唯一标识")
    topic: str = Field(..., description="消息主题/队列名")
    payload: Dict[str, Any] = Field(default_factory=dict, description="消息负载")
    retry_count: int = Field(default=0, description="重试次数")
    max_retries: int = Field(default=3, description="最大重试次数")
    status: MessageStatus = Field(default=MessageStatus.PENDING, description="消息状态")
    first_failed_at: Optional[datetime] = Field(default=None, description="首次失败时间")
    last_failed_at: Optional[datetime] = Field(default=None, description="最后失败时间")
    next_retry_at: Optional[datetime] = Field(default=None, description="下次重试时间")
    last_error_message: Optional[str] = Field(default=None, description="最后错误信息")
    last_error_stack: Optional[str] = Field(default=None, description="最后错误堆栈")
    error_category: Optional[ErrorCategory] = Field(default=None, description="错误分类")
    idempotent_key: Optional[str] = Field(default=None, description="幂等键")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    processed_at: Optional[datetime] = Field(default=None, description="处理时间")
    
    def increment_retry(self, error_message: str, error_stack: Optional[str] = None, 
                       error_category: ErrorCategory = ErrorCategory.UNKNOWN) -> None:
        self.retry_count += 1
        self.last_failed_at = datetime.now()
        self.last_error_message = error_message
        self.last_error_stack = error_stack
        self.error_category = error_category
        self.updated_at = datetime.now()
        if self.first_failed_at is None:
            self.first_failed_at = datetime.now()
    
    def can_retry(self) -> bool:
        return self.retry_count < self.max_retries
    
    def is_permanently_failed(self) -> bool:
        return self.retry_count >= self.max_retries and self.status == MessageStatus.DEAD_LETTER


class RetryRecord(BaseModel):
    id: str = Field(..., description="重试记录ID")
    message_id: str = Field(..., description="关联的消息ID")
    attempt_number: int = Field(..., description="第几次重试")
    status: str = Field(..., description="重试状态")
    error_message: Optional[str] = Field(default=None, description="错误信息")
    error_stack: Optional[str] = Field(default=None, description="错误堆栈")
    started_at: datetime = Field(default_factory=datetime.now, description="开始时间")
    finished_at: Optional[datetime] = Field(default=None, description="完成时间")
    duration_ms: Optional[int] = Field(default=None, description="耗时(毫秒)")


class CleanupSuggestion(BaseModel):
    message_id: str = Field(..., description="消息ID")
    topic: str = Field(..., description="主题")
    reason: str = Field(..., description="清理原因")
    risk_level: str = Field(..., description="风险等级: low/medium/high")
    suggestion: str = Field(..., description="清理建议")
    safe_to_delete: bool = Field(default=False, description="是否安全删除")


class InspectionReport(BaseModel):
    generated_at: datetime = Field(default_factory=datetime.now)
    total_messages: int = 0
    by_status: Dict[MessageStatus, int] = Field(default_factory=dict)
    by_topic: Dict[str, int] = Field(default_factory=dict)
    by_error_category: Dict[ErrorCategory, int] = Field(default_factory=dict)
    permanent_failures: int = 0
    duplicate_keys: List[str] = Field(default_factory=list)
    cleanup_suggestions: List[CleanupSuggestion] = Field(default_factory=list)
    oldest_message_age_hours: Optional[float] = None
    avg_retry_count: Optional[float] = None
