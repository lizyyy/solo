"""照片记录模型"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PhotoType(str, Enum):
    """照片类型"""
    LOADING_START = "loading_start"
    LOADING_END = "loading_end"
    BOX_CLOSED = "box_closed"
    SEAL_INTACT = "seal_intact"
    TRANSIT = "transit"
    UNLOADING_START = "unloading_start"
    UNLOADING_END = "unloading_end"
    ARRIVAL = "arrival"
    OPENING_START = "opening_start"
    OPENING_END = "opening_end"
    CONDITION_CHECK = "condition_check"
    DAMAGE = "damage"
    SEAL_BROKEN = "seal_broken"
    SIGNATURE = "signature"
    HANDOVER = "handover"
    OTHER = "other"


class PhotoRecord(BaseModel):
    """照片记录"""
    photo_id: str = Field(..., description="照片唯一标识")
    box_id: Optional[str] = Field(None, description="关联的展箱编号")
    route_node_id: Optional[str] = Field(None, description="关联的路书节点编号")
    filename: str = Field(..., description="文件名")
    file_path: Optional[str] = Field(None, description="文件路径")
    photo_type: PhotoType = Field(..., description="照片类型")
    timestamp: Optional[str] = Field(None, description="拍摄时间，ISO 格式")
    location: Optional[str] = Field(None, description="拍摄地点")
    photographer: Optional[str] = Field(None, description="拍摄人")
    description: Optional[str] = Field(None, description="描述")
    tags: list[str] = Field(default_factory=list, description="标签列表")
    source_list: Optional[str] = Field(None, description="来源的照片清单文件名")
    line_number: Optional[int] = Field(None, description="源文件行号")
