"""门店配置和校验规则模型"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class LensType(str, Enum):
    """镜片类型"""
    SINGLE_VISION = "单光"
    BIFOCAL = "双光"
    PROGRESSIVE = "渐进"
    ANTI_BLUE = "防蓝光"


class FrameStyle(str, Enum):
    """镜架类型"""
    FULL_RIM = "全框"
    HALF_RIM = "半框"
    RIMLESS = "无框"


class ValidationRules(BaseModel):
    """校验规则配置"""
    
    min_sphere: float = Field(default=-20.0, description="最小球镜度数(D)")
    max_sphere: float = Field(default=+6.0, description="最大球镜度数(D)")
    min_cylinder: float = Field(default=-6.0, description="最小柱镜度数(D)")
    max_cylinder: float = Field(default=+4.0, description="最大柱镜度数(D)")
    
    min_axis: int = Field(default=0, description="最小轴位")
    max_axis: int = Field(default=180, description="最大轴位")
    
    min_pd: float = Field(default=50.0, description="最小瞳距(mm)")
    max_pd: float = Field(default=75.0, description="最大瞳距(mm)")
    pd_tolerance: float = Field(default=2.0, description="瞳距误差允许范围(mm)")
    
    min_ph: float = Field(default=18.0, description="最小瞳高(mm)")
    max_ph: float = Field(default=35.0, description="最大瞳高(mm)")
    
    min_frame_eye_size: float = Field(default=40.0, description="最小镜框尺寸(mm)")
    max_frame_eye_size: float = Field(default=62.0, description="最大镜框尺寸(mm)")
    
    pd_frame_tolerance: float = Field(default=4.0, description="瞳距与镜框尺寸差允许范围(mm)")
    sphere_step: float = Field(default=0.25, description="球镜度数步长")
    cylinder_step: float = Field(default=0.25, description="柱镜度数步长")
    axis_step: int = Field(default=1, description="轴位步长")
    
    allow_plus_cylinder: bool = Field(default=False, description="是否允许正柱镜格式")
    common_axis_values: list[int] = Field(
        default=[0, 10, 20, 30, 45, 60, 70, 80, 90, 100, 110, 120, 135, 150, 160, 170, 180],
        description="常见轴位值"
    )
    
    duplicate_order_hours: int = Field(default=24, description="重复订单判定时间范围(小时)")
    

class StoreConfig(BaseModel):
    """门店配置"""
    
    store_id: str = Field(description="门店唯一标识")
    store_name: str = Field(description="门店名称")
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    rules: ValidationRules = Field(default_factory=ValidationRules, description="校验规则")
    
    default_lens_type: LensType = Field(default=LensType.SINGLE_VISION, description="默认镜片类型")
    default_frame_style: FrameStyle = Field(default=FrameStyle.FULL_RIM, description="默认镜架类型")
    
    contact_person: Optional[str] = Field(default=None, description="联系人")
    contact_phone: Optional[str] = Field(default=None, description="联系电话")
    address: Optional[str] = Field(default=None, description="门店地址")
    notes: Optional[str] = Field(default=None, description="备注")
    
    def model_dump_json(self, **kwargs) -> str:
        """导出为JSON字符串"""
        kwargs.setdefault("indent", 2)
        kwargs.setdefault("default", str)
        return super().model_dump_json(**kwargs)
