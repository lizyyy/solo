from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from app.schemas.common import DistributionPatternEnum


class TrafficModelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="流量模型名称")
    description: Optional[str] = Field(None, description="描述")
    model_type: str = Field(..., min_length=1, max_length=50, description="模型类型")
    virtual_users: int = Field(..., ge=1, description="虚拟用户数")
    ramp_up_seconds: int = Field(default=0, ge=0, description="爬坡时间(秒)")
    duration_seconds: int = Field(..., ge=1, description="持续时间(秒)")
    think_time_min_ms: Optional[int] = Field(None, ge=0, description="最小思考时间(ms)")
    think_time_max_ms: Optional[int] = Field(None, ge=0, description="最大思考时间(ms)")
    distribution_pattern: DistributionPatternEnum = Field(
        default=DistributionPatternEnum.uniform, 
        description="分布模式"
    )
    interface_distribution: Optional[Dict[str, float]] = Field(
        None, 
        description="接口流量分布"
    )
    is_active: Optional[bool] = Field(default=True, description="是否激活")


class TrafficModelCreate(TrafficModelBase):
    project_id: int = Field(..., ge=1, description="项目ID")
    
    @validator('virtual_users')
    def virtual_users_valid(cls, v):
        if v < 1:
            raise ValueError('虚拟用户数必须大于0')
        if v > 100000:
            raise ValueError('虚拟用户数不能超过100000')
        return v
    
    @validator('duration_seconds')
    def duration_valid(cls, v):
        if v < 1:
            raise ValueError('持续时间必须大于0秒')
        if v > 86400 * 7:
            raise ValueError('持续时间不能超过7天')
        return v
    
    @validator('think_time_max_ms')
    def think_time_range(cls, v, values):
        if v is not None and 'think_time_min_ms' in values:
            min_time = values.get('think_time_min_ms')
            if min_time is not None and v < min_time:
                raise ValueError('最大思考时间不能小于最小思考时间')
        return v
    
    @validator('interface_distribution')
    def distribution_sum_valid(cls, v):
        if v is not None:
            total = sum(v.values())
            if abs(total - 1.0) > 0.01:
                raise ValueError(f'接口流量分布总和应为1.0，当前为{total}')
        return v


class TrafficModelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    model_type: Optional[str] = Field(None, min_length=1, max_length=50)
    virtual_users: Optional[int] = Field(None, ge=1)
    ramp_up_seconds: Optional[int] = Field(None, ge=0)
    duration_seconds: Optional[int] = Field(None, ge=1)
    think_time_min_ms: Optional[int] = Field(None, ge=0)
    think_time_max_ms: Optional[int] = Field(None, ge=0)
    distribution_pattern: Optional[DistributionPatternEnum] = None
    interface_distribution: Optional[Dict[str, float]] = None
    is_active: Optional[bool] = None


class TrafficModelInDBBase(TrafficModelBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TrafficModel(TrafficModelInDBBase):
    pass


class TrafficModelList(BaseModel):
    total: int
    items: List[TrafficModel]
    page: int
    page_size: int
