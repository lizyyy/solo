from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class BatchStatusEnum(str, Enum):
    CREATED = "已创建"
    PROCESSING = "处理中"
    COMPLETED = "已完成"
    ERROR = "异常"
    ARCHIVED = "已归档"


class ImageBatchBase(BaseModel):
    batch_code: str = Field(..., description="批次编号")
    batch_name: str = Field(..., description="批次名称")
    flight_date: datetime = Field(..., description="无人机飞行日期")
    flight_area: str = Field(..., description="飞行区域")
    drone_id: Optional[str] = Field(default=None, description="无人机ID")
    image_count: Optional[int] = Field(default=0, description="影像数量")
    total_area_km2: Optional[float] = Field(default=0.0, description="总面积(平方公里)")
    status: Optional[BatchStatusEnum] = Field(default=BatchStatusEnum.CREATED, description="批次状态")
    remark: Optional[str] = Field(default=None, description="备注")


class ImageBatchCreate(ImageBatchBase):
    created_by: str = Field(..., description="创建人")


class ImageBatchUpdate(BaseModel):
    batch_name: Optional[str] = Field(default=None, description="批次名称")
    flight_date: Optional[datetime] = Field(default=None, description="无人机飞行日期")
    flight_area: Optional[str] = Field(default=None, description="飞行区域")
    drone_id: Optional[str] = Field(default=None, description="无人机ID")
    image_count: Optional[int] = Field(default=None, description="影像数量")
    total_area_km2: Optional[float] = Field(default=None, description="总面积(平方公里)")
    status: Optional[BatchStatusEnum] = Field(default=None, description="批次状态")
    remark: Optional[str] = Field(default=None, description="备注")


class ImageBatchResponse(ImageBatchBase):
    id: int = Field(..., description="主键ID")
    created_by: str = Field(..., description="创建人")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    lesion_count: Optional[int] = Field(default=0, description="病斑记录数量")
    confirmed_lesion_count: Optional[int] = Field(default=0, description="已确认病斑数量")
    false_positive_count: Optional[int] = Field(default=0, description="误报数量")
    pending_count: Optional[int] = Field(default=0, description="待核验数量")
    
    class Config:
        from_attributes = True


class BatchListResponse(BaseModel):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    total_pages: int = Field(..., description="总页数")
    items: list[ImageBatchResponse] = Field(..., description="批次列表")
