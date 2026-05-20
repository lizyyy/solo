from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class RecallLevel(str, Enum):
    LEVEL_1 = "一级召回"
    LEVEL_2 = "二级召回"
    LEVEL_3 = "三级召回"


class RecallStatus(str, Enum):
    ACTIVE = "生效中"
    COMPLETED = "已完成"
    CANCELLED = "已取消"


class RecallBatch(BaseModel):
    batch_number: str = Field(..., description="召回批号")
    affected_quantity: int = Field(default=0, description="受影响数量")
    manufacture_date: Optional[date] = Field(None, description="生产日期")
    expiry_date: Optional[date] = Field(None, description="有效期")


class RecallNotice(BaseModel):
    id: Optional[str] = None
    notice_number: str = Field(..., description="公告编号")
    title: str = Field(..., description="公告标题")
    issuer: str = Field(..., description="发布机构")
    issue_date: date = Field(..., description="发布日期")
    effective_date: date = Field(..., description="生效日期")
    recall_level: RecallLevel = Field(..., description="召回级别")
    material_name: str = Field(..., description="涉及产品名称")
    batches: List[RecallBatch] = Field(default_factory=list, description="召回批号列表")
    reason: str = Field(..., description="召回原因")
    requirements: str = Field(..., description="召回要求")
    status: RecallStatus = RecallStatus.ACTIVE
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    source_file: Optional[str] = None
    remarks: Optional[str] = None

    class Config:
        use_enum_values = True
