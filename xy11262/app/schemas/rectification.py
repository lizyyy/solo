from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from app.schemas.common import SensitiveBaseModel


class RectificationBase(SensitiveBaseModel):
    hazard_id: int = Field(..., description="关联隐患ID")
    rectifier: Optional[str] = Field(None, max_length=100, description="整改人")
    rectifier_phone: Optional[str] = Field(None, max_length=20, description="整改人电话")
    action_taken: Optional[str] = Field(None, max_length=2000, description="整改措施")
    measures: Optional[str] = Field(None, max_length=2000, description="预防措施")
    cost: int = Field(default=0, ge=0, description="整改费用")
    started_at: Optional[datetime] = Field(None, description="开始时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    remarks: Optional[str] = Field(None, max_length=2000, description="备注")

    @field_validator('rectifier_phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return v
        if not v.replace('-', '').replace(' ', '').isdigit():
            raise ValueError("电话号码只能包含数字、横线和空格")
        return v


class RectificationCreate(RectificationBase):
    pass


class RectificationUpdate(RectificationBase):
    hazard_id: Optional[int] = None


class RectificationInDB(RectificationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Rectification(RectificationInDB):
    pass
