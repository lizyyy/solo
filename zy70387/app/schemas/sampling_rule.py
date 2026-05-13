from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class SamplingRuleCreate(BaseModel):
    name: str = Field(..., description="规则名称，唯一")
    description: Optional[str] = None
    
    task_type: Optional[str] = Field(default=None, description="任务类型，None表示匹配所有")
    tenant_id: Optional[str] = Field(default=None, description="租户ID，None表示匹配所有")
    
    is_vip_tenant: bool = Field(default=False, description="是否VIP租户规则")
    sample_rate: float = Field(default=0.1, description="采样率 0.0-1.0")
    
    dedup_enabled: bool = Field(default=True, description="是否启用去重")
    dedup_window_seconds: int = Field(default=300, description="去重窗口秒数")
    
    context_window_before: int = Field(default=3, description="失败前上下文日志数")
    context_window_after: int = Field(default=1, description="失败后上下文日志数")
    
    retention_days: int = Field(default=7, description="保留天数")
    
    priority: int = Field(default=0, description="优先级，数字越大优先级越高")
    is_active: bool = Field(default=True, description="是否激活")
    
    @validator('sample_rate')
    def validate_sample_rate(cls, v):
        if v < 0.0 or v > 1.0:
            raise ValueError('采样率必须在 0.0 到 1.0 之间')
        return v
    
    @validator('dedup_window_seconds')
    def validate_dedup_window(cls, v):
        if v < 1:
            raise ValueError('去重窗口必须大于0')
        return v
    
    @validator('retention_days')
    def validate_retention_days(cls, v):
        if v < 1:
            raise ValueError('保留天数必须大于0')
        return v


class SamplingRuleUpdate(BaseModel):
    description: Optional[str] = None
    task_type: Optional[str] = None
    tenant_id: Optional[str] = None
    is_vip_tenant: Optional[bool] = None
    sample_rate: Optional[float] = None
    dedup_enabled: Optional[bool] = None
    dedup_window_seconds: Optional[int] = None
    context_window_before: Optional[int] = None
    context_window_after: Optional[int] = None
    retention_days: Optional[int] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class SamplingRuleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    task_type: Optional[str]
    tenant_id: Optional[str]
    is_vip_tenant: bool
    sample_rate: float
    dedup_enabled: bool
    dedup_window_seconds: int
    context_window_before: int
    context_window_after: int
    retention_days: int
    priority: int
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
