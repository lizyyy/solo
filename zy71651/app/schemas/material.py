from typing import Optional
from pydantic import Field

from .base import BaseSchema, TimestampMixin
from ..models.enums import MaterialType


class MaterialBase(BaseSchema):
    material_type: MaterialType = Field(..., description="材料类型")
    name: str = Field(..., max_length=100, description="材料名称")
    density: float = Field(..., gt=0, description="材料密度 g/cm³")
    filament_diameter: float = Field(1.75, gt=0, description="丝材直径 mm")
    color: Optional[str] = Field(None, max_length=50, description="颜色")
    supplier: Optional[str] = Field(None, max_length=100, description="供应商")
    is_active: bool = Field(True, description="是否启用")
    notes: Optional[str] = Field(None, max_length=500, description="备注")


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseSchema):
    material_type: Optional[MaterialType] = None
    name: Optional[str] = None
    density: Optional[float] = None
    filament_diameter: Optional[float] = None
    color: Optional[str] = None
    supplier: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class MaterialResponse(MaterialBase, TimestampMixin):
    id: int
