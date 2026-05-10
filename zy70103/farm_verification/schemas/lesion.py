from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class LesionStatusEnum(str, Enum):
    PENDING = "待核验"
    VERIFYING = "核验中"
    CONFIRMED = "确认为病斑"
    FALSE_POSITIVE = "误报"
    REVERTED = "已回滚"


class LesionSourceEnum(str, Enum):
    AI_DETECTION = "AI识别"
    MANUAL_MARK = "人工标注"
    SECONDARY_CHECK = "二次复核"


class LesionRecordBase(BaseModel):
    batch_code: str = Field(..., description="批次编号")
    longitude: float = Field(..., description="经度")
    latitude: float = Field(..., description="纬度")
    pixel_x: Optional[int] = Field(default=None, description="影像像素X坐标")
    pixel_y: Optional[int] = Field(default=None, description="影像像素Y坐标")
    image_path: Optional[str] = Field(default=None, description="影像路径")
    image_name: Optional[str] = Field(default=None, description="影像文件名")
    lesion_type: Optional[str] = Field(default=None, description="病斑类型")
    confidence_score: Optional[float] = Field(default=0.0, description="AI置信度")
    estimated_area_m2: Optional[float] = Field(default=0.0, description="预估面积(平方米)")
    severity_level: Optional[str] = Field(default=None, description="严重程度")
    source: Optional[LesionSourceEnum] = Field(default=LesionSourceEnum.AI_DETECTION, description="来源")
    remark: Optional[str] = Field(default=None, description="备注")


class LesionRecordCreate(LesionRecordBase):
    created_by: str = Field(..., description="创建人")


class LesionRecordUpdate(BaseModel):
    lesion_type: Optional[str] = Field(default=None, description="病斑类型")
    estimated_area_m2: Optional[float] = Field(default=None, description="预估面积(平方米)")
    severity_level: Optional[str] = Field(default=None, description="严重程度")
    remark: Optional[str] = Field(default=None, description="备注")


class LesionRecordResponse(LesionRecordBase):
    id: int = Field(..., description="主键ID")
    lesion_code: str = Field(..., description="病斑编号")
    grid_id: Optional[int] = Field(default=None, description="地块ID")
    grid_code: Optional[str] = Field(default=None, description="地块编号")
    grid_name: Optional[str] = Field(default=None, description="地块名称")
    status: Optional[LesionStatusEnum] = Field(default=None, description="状态")
    is_false_positive: Optional[bool] = Field(default=None, description="是否误报")
    is_reverted: Optional[bool] = Field(default=None, description="是否已回滚")
    match_rule_id: Optional[int] = Field(default=None, description="匹配的规则ID")
    match_rule_name: Optional[str] = Field(default=None, description="匹配的规则名称")
    match_reason: Optional[str] = Field(default=None, description="匹配原因")
    revert_reason: Optional[str] = Field(default=None, description="回滚原因")
    reverted_by: Optional[str] = Field(default=None, description="回滚人")
    reverted_at: Optional[datetime] = Field(default=None, description="回滚时间")
    created_by: str = Field(..., description="创建人")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


class LesionListResponse(BaseModel):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    total_pages: int = Field(..., description="总页数")
    items: list[LesionRecordResponse] = Field(..., description="病斑列表")
