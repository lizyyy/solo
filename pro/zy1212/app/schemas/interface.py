from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from app.schemas.common import HTTPMethodEnum, PriorityEnum


class InterfaceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="接口名称")
    method: HTTPMethodEnum = Field(..., description="HTTP方法")
    path: str = Field(..., min_length=1, max_length=500, description="接口路径")
    description: Optional[str] = Field(None, description="接口描述")
    request_headers: Optional[Dict[str, Any]] = Field(None, description="请求头")
    request_body: Optional[str] = Field(None, description="请求体模板")
    request_params: Optional[Dict[str, Any]] = Field(None, description="请求参数")
    response_schema: Optional[Dict[str, Any]] = Field(None, description="响应Schema")
    expected_response_time_ms: Optional[int] = Field(None, ge=0, description="期望响应时间(ms)")
    priority: PriorityEnum = Field(default=PriorityEnum.medium, description="优先级")
    tags: Optional[List[str]] = Field(None, description="标签")
    is_active: Optional[bool] = Field(default=True, description="是否激活")


class InterfaceCreate(InterfaceBase):
    project_id: int = Field(..., ge=1, description="项目ID")
    
    @validator('path')
    def path_valid(cls, v):
        if not v or not v.strip():
            raise ValueError('接口路径不能为空')
        if not v.startswith('/'):
            raise ValueError('接口路径必须以/开头')
        return v.strip()
    
    @validator('expected_response_time_ms')
    def response_time_positive(cls, v):
        if v is not None and v < 0:
            raise ValueError('期望响应时间不能为负数')
        return v


class InterfaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    method: Optional[HTTPMethodEnum] = None
    path: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    request_headers: Optional[Dict[str, Any]] = None
    request_body: Optional[str] = None
    request_params: Optional[Dict[str, Any]] = None
    response_schema: Optional[Dict[str, Any]] = None
    expected_response_time_ms: Optional[int] = Field(None, ge=0)
    priority: Optional[PriorityEnum] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class InterfaceInDBBase(InterfaceBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Interface(InterfaceInDBBase):
    pass


class InterfaceList(BaseModel):
    total: int
    items: List[Interface]
    page: int
    page_size: int


class InterfaceImportRequest(BaseModel):
    project_id: int
    interfaces: List[InterfaceCreate]
    overwrite_existing: bool = Field(default=False)


class InterfaceImportResult(BaseModel):
    success: bool
    total: int
    created: int
    updated: int
    skipped: int
    errors: List[str]
