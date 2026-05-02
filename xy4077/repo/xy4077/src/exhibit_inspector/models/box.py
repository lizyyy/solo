"""展箱信息模型"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class BoxStatus(str, Enum):
    """展箱状态"""
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    ARRIVED = "arrived"
    OPENED = "opened"
    INSPECTED = "inspected"
    COMPLETED = "completed"


class BoxInfo(BaseModel):
    """展箱信息"""
    box_id: str = Field(..., description="展箱编号")
    shipment_id: str = Field(..., description="关联的运输批次编号")
    box_name: Optional[str] = Field(None, description="展箱名称")
    box_type: Optional[str] = Field(None, description="展箱类型")
    weight_kg: Optional[float] = Field(None, ge=0, description="重量，公斤")
    dimensions_cm: Optional[str] = Field(None, description="尺寸，格式: 长x宽x高")
    sensor_ids: list[str] = Field(default_factory=list, description="关联的传感器编号列表")
    contents: list[str] = Field(default_factory=list, description="箱内展品列表")
    special_requirements: Optional[str] = Field(None, description="特殊要求")
    status: BoxStatus = Field(BoxStatus.PENDING, description="当前状态")
    created_at: Optional[str] = Field(None, description="创建时间，ISO 格式")
    updated_at: Optional[str] = Field(None, description="更新时间，ISO 格式")
    notes: Optional[str] = Field(None, description="备注")
