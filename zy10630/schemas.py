from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from models import AppealStatus, AppealSource


class AppealBase(BaseModel):
    image_url: str = Field(..., max_length=500, description="图片URL")
    image_hash: Optional[str] = Field(None, max_length=64, description="图片哈希")
    review_tags: str = Field(..., max_length=200, description="审核标签")
    model_version: str = Field(..., max_length=50, description="模型版本")
    appeal_material: Optional[str] = Field(None, description="申诉材料")
    source: AppealSource = Field(default=AppealSource.MANUAL, description="操作来源")
    operator: str = Field(..., max_length=100, description="操作者")


class AppealCreate(AppealBase):
    pass


class AppealUpdate(BaseModel):
    status: AppealStatus = Field(..., description="更新状态")
    operator: str = Field(..., max_length=100, description="操作者")
    source: AppealSource = Field(default=AppealSource.MANUAL, description="操作来源")
    remark: Optional[str] = Field(None, description="备注")


class AppealResponse(BaseModel):
    id: int
    image_url: str
    image_hash: Optional[str]
    review_tags: str
    model_version: str
    appeal_material: Optional[str]
    status: AppealStatus
    source: AppealSource
    operator: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AppealHistoryResponse(BaseModel):
    id: int
    appeal_id: int
    old_status: Optional[AppealStatus]
    new_status: AppealStatus
    source: AppealSource
    operator: str
    remark: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AppealDetailResponse(AppealResponse):
    history: List[AppealHistoryResponse]


class BatchImportItem(BaseModel):
    image_url: str
    image_hash: Optional[str] = None
    review_tags: str
    model_version: str
    appeal_material: Optional[str] = None


class BatchImportResult(BaseModel):
    success: int
    failed: int
    results: List[dict]


class AppealListResponse(BaseModel):
    total: int
    items: List[AppealResponse]
