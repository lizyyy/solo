from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, Field


class AreaType(str):
    ENTRANCE = "entrance"
    EXIT = "exit"
    SHELF = "shelf"
    CHECKOUT = "checkout"
    WAREHOUSE = "warehouse"
    PARKING = "parking"
    OTHER = "other"


class Area(BaseModel):
    id: str = Field(..., description="区域唯一标识")
    name: str = Field(..., description="区域名称")
    type: str = Field(default=AreaType.OTHER, description="区域类型")
    camera_id: str = Field(..., description="所属摄像头ID")
    description: Optional[str] = Field(None, description="区域描述")
    bounding_box: Optional[Tuple[int, int, int, int]] = Field(
        None, description="区域框坐标 (x1, y1, x2, y2)"
    )
    polygon: Optional[List[Tuple[int, int]]] = Field(
        None, description="多边形区域坐标点列表"
    )
    metadata: Dict[str, str] = Field(default_factory=dict, description="额外元数据")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "camera_id": self.camera_id,
            "description": self.description,
            "bounding_box": list(self.bounding_box) if self.bounding_box else None,
            "polygon": [list(p) for p in self.polygon] if self.polygon else None,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
