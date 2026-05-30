from typing import Optional, Dict, Any, List
from pydantic import Field

from .base import BaseSchema, TimestampMixin


class SliceParamsBase(BaseSchema):
    layer_height: Optional[float] = Field(None, gt=0, description="层高 mm")
    nozzle_diameter: Optional[float] = Field(None, gt=0, description="喷嘴直径 mm")
    print_speed: Optional[float] = Field(None, gt=0, description="打印速度 mm/s")
    infill_density: Optional[float] = Field(None, ge=0, le=100, description="填充密度 %")
    infill_pattern: Optional[str] = Field(None, max_length=50, description="填充图案")
    wall_thickness: Optional[float] = Field(None, gt=0, description="壁厚 mm")
    top_bottom_layers: Optional[int] = Field(None, ge=0, description="顶底层数")

    support_enabled: Optional[bool] = Field(None, description="是否启用支撑")
    support_type: Optional[str] = Field(None, max_length=50, description="支撑类型")
    support_density: Optional[float] = Field(None, ge=0, le=100, description="支撑密度 %")
    support_angle: Optional[float] = Field(None, ge=0, le=90, description="支撑临界角 °")

    bed_temperature: Optional[float] = Field(None, description="热床温度 °C")
    nozzle_temperature: Optional[float] = Field(None, description="喷嘴温度 °C")
    cooling_enabled: Optional[bool] = Field(None, description="是否启用冷却")

    material_id: Optional[int] = Field(None, description="材料ID")
    extra_params: Optional[Dict[str, Any]] = Field(default_factory=dict, description="额外参数")
    source: Optional[str] = Field(None, max_length=50, description="参数来源")
    notes: Optional[str] = Field(None, max_length=500, description="备注")


class SliceParamsCreate(SliceParamsBase):
    task_id: int = Field(..., description="任务ID")


class SliceParamsUpdate(SliceParamsBase):
    pass


class SliceParamsResponse(SliceParamsBase, TimestampMixin):
    id: int
    task_id: int
    version: int
    material_name: Optional[str] = None
    material_type: Optional[str] = None


class ParamsMergeRequest(BaseSchema):
    task_id: int
    params: Dict[str, Any]
    source: str = "manual"
    create_new_version: bool = True
    notes: Optional[str] = None


class ParamsMergeResponse(BaseSchema):
    task_id: int
    version: int
    is_new_version: bool
    updated_fields: List[str]
    preserved_fields: List[str]
    conflicts: List[Dict[str, Any]]
