from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class GridStatusEnum(str, Enum):
    ACTIVE = "正常"
    SUSPENDED = "停用"
    MERGED = "已合并"
    SPLIT = "已拆分"


class CoordinatePoint(BaseModel):
    longitude: float = Field(..., description="经度")
    latitude: float = Field(..., description="纬度")


class FarmGridBase(BaseModel):
    grid_code: str = Field(..., description="地块编号")
    grid_name: str = Field(..., description="地块名称")
    parent_grid_code: Optional[str] = Field(default=None, description="上级地块编号")
    crop_type: Optional[str] = Field(default=None, description="作物类型")
    planting_date: Optional[datetime] = Field(default=None, description="种植日期")
    area_mu: Optional[float] = Field(default=0.0, description="面积(亩)")
    area_km2: Optional[float] = Field(default=0.0, description="面积(平方公里)")
    center_longitude: float = Field(..., description="中心点经度")
    center_latitude: float = Field(..., description="中心点纬度")
    boundary_coordinates: Optional[List[CoordinatePoint]] = Field(default=None, description="边界坐标点集合")
    grid_level: Optional[int] = Field(default=1, description="地块层级")
    grid_index_x: Optional[int] = Field(default=None, description="网格X索引")
    grid_index_y: Optional[int] = Field(default=None, description="网格Y索引")
    region: Optional[str] = Field(default=None, description="所属区域")
    village: Optional[str] = Field(default=None, description="所属村庄")
    farmer_name: Optional[str] = Field(default=None, description="农户姓名")
    farmer_phone: Optional[str] = Field(default=None, description="联系电话")
    status: Optional[GridStatusEnum] = Field(default=GridStatusEnum.ACTIVE, description="地块状态")
    remark: Optional[str] = Field(default=None, description="备注")


class FarmGridCreate(FarmGridBase):
    created_by: str = Field(..., description="创建人")


class FarmGridUpdate(BaseModel):
    grid_name: Optional[str] = Field(default=None, description="地块名称")
    parent_grid_code: Optional[str] = Field(default=None, description="上级地块编号")
    crop_type: Optional[str] = Field(default=None, description="作物类型")
    planting_date: Optional[datetime] = Field(default=None, description="种植日期")
    area_mu: Optional[float] = Field(default=None, description="面积(亩)")
    area_km2: Optional[float] = Field(default=None, description="面积(平方公里)")
    center_longitude: Optional[float] = Field(default=None, description="中心点经度")
    center_latitude: Optional[float] = Field(default=None, description="中心点纬度")
    boundary_coordinates: Optional[List[CoordinatePoint]] = Field(default=None, description="边界坐标点集合")
    grid_level: Optional[int] = Field(default=None, description="地块层级")
    grid_index_x: Optional[int] = Field(default=None, description="网格X索引")
    grid_index_y: Optional[int] = Field(default=None, description="网格Y索引")
    region: Optional[str] = Field(default=None, description="所属区域")
    village: Optional[str] = Field(default=None, description="所属村庄")
    farmer_name: Optional[str] = Field(default=None, description="农户姓名")
    farmer_phone: Optional[str] = Field(default=None, description="联系电话")
    status: Optional[GridStatusEnum] = Field(default=None, description="地块状态")
    remark: Optional[str] = Field(default=None, description="备注")


class FarmGridResponse(FarmGridBase):
    id: int = Field(..., description="主键ID")
    created_by: str = Field(..., description="创建人")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    lesion_count: Optional[int] = Field(default=0, description="关联病斑数量")
    
    class Config:
        from_attributes = True


class GridListResponse(BaseModel):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    total_pages: int = Field(..., description="总页数")
    items: list[FarmGridResponse] = Field(..., description="地块列表")


class CoordinateSearchResponse(BaseModel):
    found: bool = Field(..., description="是否找到匹配的地块")
    grid: Optional[FarmGridResponse] = Field(default=None, description="匹配的地块信息")
    distance_meters: Optional[float] = Field(default=None, description="到地块中心点的距离(米)")
    message: str = Field(..., description="业务消息")
