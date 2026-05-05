from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from app.schemas.common import EnvironmentEnum


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="项目名称")
    description: Optional[str] = Field(None, description="项目描述")
    service_name: str = Field(..., min_length=1, max_length=100, description="服务名称")
    environment: EnvironmentEnum = Field(default=EnvironmentEnum.production, description="环境")
    is_active: Optional[bool] = Field(default=True, description="是否激活")


class ProjectCreate(ProjectBase):
    @validator('name')
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('项目名称不能为空')
        return v.strip()
    
    @validator('service_name')
    def service_name_valid(cls, v):
        if not v or not v.strip():
            raise ValueError('服务名称不能为空')
        if len(v) < 2:
            raise ValueError('服务名称至少需要2个字符')
        return v.strip()


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    service_name: Optional[str] = Field(None, min_length=1, max_length=100)
    environment: Optional[EnvironmentEnum] = None
    is_active: Optional[bool] = None


class ProjectInDBBase(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Project(ProjectInDBBase):
    pass


class ProjectDetail(ProjectInDBBase):
    interface_count: Optional[int] = None
    load_test_batch_count: Optional[int] = None
    latest_batch_status: Optional[str] = None


class ProjectList(BaseModel):
    total: int
    items: List[ProjectDetail]
    page: int
    page_size: int
