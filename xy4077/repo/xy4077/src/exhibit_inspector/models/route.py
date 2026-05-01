"""路书模型"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RoutePhase(str, Enum):
    """路书阶段类型"""
    DEPARTURE = "departure"
    TRANSIT = "transit"
    STOPOVER = "stopover"
    ARRIVAL = "arrival"
    CHECKPOINT = "checkpoint"


class RouteNode(BaseModel):
    """路书节点"""
    node_id: str = Field(..., description="节点唯一标识")
    node_order: int = Field(..., ge=1, description="节点顺序")
    location: str = Field(..., description="地点名称")
    phase: RoutePhase = Field(..., description="阶段类型")
    planned_start_time: str = Field(..., description="计划开始时间，ISO 格式")
    planned_end_time: str = Field(..., description="计划结束时间，ISO 格式")
    actual_start_time: Optional[str] = Field(None, description="实际开始时间，ISO 格式")
    actual_end_time: Optional[str] = Field(None, description="实际结束时间，ISO 格式")
    description: Optional[str] = Field(None, description="节点描述")
    contact_person: Optional[str] = Field(None, description="联系人")
    contact_phone: Optional[str] = Field(None, description="联系电话")
    notes: Optional[str] = Field(None, description="备注")
    required_photos: list[str] = Field(default_factory=list, description="该节点需要的照片类型列表")
    evidence_required: list[str] = Field(default_factory=list, description="该节点需要的交接证据类型")


class RouteBook(BaseModel):
    """路书"""
    route_id: str = Field(..., description="路书唯一标识")
    shipment_id: str = Field(..., description="关联的运输批次编号")
    origin: str = Field(..., description="始发地")
    destination: str = Field(..., description="目的地")
    nodes: list[RouteNode] = Field(..., description="路书节点列表")
    created_at: Optional[str] = Field(None, description="创建时间，ISO 格式")
    notes: Optional[str] = Field(None, description="总备注")
    
    @property
    def total_distance_km(self) -> Optional[float]:
        """总距离（如可用）"""
        return None
