from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.hazard import HazardStatus, HazardLevel
from app.schemas.common import SensitiveBaseModel


class HazardBase(SensitiveBaseModel):
    hazard_code: str = Field(..., min_length=3, max_length=50, description="隐患编号")
    title: str = Field(..., min_length=2, max_length=200, description="隐患标题")
    description: Optional[str] = Field(None, max_length=2000, description="隐患描述")
    location: Optional[str] = Field(None, max_length=500, description="隐患位置")
    level: HazardLevel = Field(default=HazardLevel.MEDIUM, description="隐患等级")
    
    discovered_by: Optional[str] = Field(None, max_length=100, description="发现人")
    discovered_at: Optional[datetime] = Field(None, description="发现时间")
    
    department: Optional[str] = Field(None, max_length=100, description="所属部门")
    category: Optional[str] = Field(None, max_length=100, description="隐患分类")
    
    responsible_person: Optional[str] = Field(None, max_length=100, description="整改责任人")
    responsible_phone: Optional[str] = Field(None, max_length=20, description="责任人电话")
    deadline: Optional[datetime] = Field(None, description="整改期限")
    
    remarks: Optional[str] = Field(None, max_length=2000, description="备注")

    @field_validator('responsible_phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return v
        if not v.replace('-', '').replace(' ', '').isdigit():
            raise ValueError("电话号码只能包含数字、横线和空格")
        if len(v) < 7 or len(v) > 20:
            raise ValueError("电话号码长度应在7-20位之间")
        return v

    @field_validator('hazard_code')
    @classmethod
    def validate_hazard_code(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("隐患编号不能为空")
        return v

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("隐患标题不能为空")
        return v

    @model_validator(mode='after')
    def validate_deadline(self) -> 'HazardBase':
        if self.deadline and self.discovered_at:
            if self.deadline < self.discovered_at:
                raise ValueError("整改期限不能早于发现时间")
        return self


class HazardCreate(HazardBase):
    pass


class HazardUpdate(HazardBase):
    hazard_code: Optional[str] = Field(None, min_length=3, max_length=50)
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    status: Optional[HazardStatus] = None


class HazardInDB(HazardBase):
    id: int
    status: HazardStatus
    closed_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Hazard(HazardInDB):
    pass


class HazardListResponse(BaseModel):
    items: List[Hazard]
    total: int
    page: int
    page_size: int
