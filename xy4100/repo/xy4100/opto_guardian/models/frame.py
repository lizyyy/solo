"""镜架数据模型"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class FrameMaterial(str, Enum):
    """镜架材质"""
    METAL = "金属"
    PLASTIC = "塑料"
    TR90 = "TR90"
    TITANIUM = "钛"
    ALLOY = "合金"
    WOOD = "木质"
    MIXED = "混合"


class FrameStyle(str, Enum):
    """镜架类型"""
    FULL_RIM = "全框"
    HALF_RIM = "半框"
    RIMLESS = "无框"
    SEMI_RIMLESS = "半无框"


class Frame(BaseModel):
    """镜架数据模型"""
    
    frame_id: str = Field(description="镜架唯一标识")
    model: str = Field(description="镜架型号")
    brand: Optional[str] = Field(default=None, description="品牌")
    
    style: FrameStyle = Field(default=FrameStyle.FULL_RIM, description="镜架类型")
    material: Optional[FrameMaterial] = Field(default=None, description="材质")
    
    eye_size: float = Field(description="镜框宽度(mm)")
    bridge_size: float = Field(description="鼻梁宽度(mm)")
    temple_length: Optional[float] = Field(default=None, description="镜腿长度(mm)")
    
    lens_height: Optional[float] = Field(default=None, description="镜片高度(mm)")
    lens_width: Optional[float] = Field(default=None, description="镜片宽度(mm)")
    
    box_center_distance: Optional[float] = Field(default=None, description="几何中心距(mm)")
    
    color: Optional[str] = Field(default=None, description="颜色")
    quantity: int = Field(default=1, description="库存数量")
    price: Optional[float] = Field(default=None, description="价格")
    
    notes: Optional[str] = Field(default=None, description="备注")
    
    @field_validator("eye_size")
    @classmethod
    def validate_eye_size(cls, v: float) -> float:
        """验证镜框宽度"""
        if v < 40 or v > 65:
            raise ValueError(f"镜框宽度应在40-65mm之间，当前值: {v}")
        return v
    
    @field_validator("bridge_size")
    @classmethod
    def validate_bridge_size(cls, v: float) -> float:
        """验证鼻梁宽度"""
        if v < 12 or v > 26:
            raise ValueError(f"鼻梁宽度应在12-26mm之间，当前值: {v}")
        return v
    
    def get_box_center_distance(self) -> float:
        """获取几何中心距(BC)"""
        if self.box_center_distance is not None:
            return self.box_center_distance
        return self.eye_size + self.bridge_size
    
    def calculate_minimum_pd(self) -> float:
        """计算最小适配瞳距"""
        return self.get_box_center_distance() - 10
    
    def calculate_maximum_pd(self) -> float:
        """计算最大适配瞳距"""
        return self.get_box_center_distance() + 10
    
    def is_pd_compatible(self, pd: float, tolerance: float = 4.0) -> bool:
        """检查瞳距是否适配
        
        Args:
            pd: 总瞳距
            tolerance: 允许误差范围(mm)
            
        Returns:
            是否适配
        """
        bc = self.get_box_center_distance()
        return abs(pd - bc) <= tolerance
    
    def get_pd_deviation(self, pd: float) -> float:
        """计算瞳距与几何中心距的偏差
        
        Args:
            pd: 总瞳距
            
        Returns:
            偏差值(mm)，正数表示瞳距大于BC
        """
        bc = self.get_box_center_distance()
        return pd - bc
    
    def estimate_lens_diameter(self, pd_right: float, pd_left: float) -> tuple[float, float]:
        """估算所需镜片直径
        
        使用瞳距和镜框尺寸估算所需镜片最小直径
        
        Args:
            pd_right: 右眼瞳距
            pd_left: 左眼瞳距
            
        Returns:
            (右眼所需最小直径, 左眼所需最小直径)
        """
        bc = self.get_box_center_distance()
        half_bc = bc / 2
        
        right_deviation = half_bc - pd_right
        left_deviation = pd_left - half_bc
        
        eye_radius = self.eye_size / 2
        
        right_diameter = (eye_radius + abs(right_deviation)) * 2
        left_diameter = (eye_radius + abs(left_deviation)) * 2
        
        return right_diameter, left_diameter


class FrameEntry(BaseModel):
    """镜架CSV导入条目"""
    
    frame_id: str = Field(description="镜架ID")
    model: str = Field(description="型号")
    brand: Optional[str] = Field(default=None, description="品牌")
    
    style: Optional[str] = Field(default=None, description="类型: 全框/半框/无框")
    material: Optional[str] = Field(default=None, description="材质")
    
    eye_size: float = Field(description="镜框宽度")
    bridge_size: float = Field(description="鼻梁宽度")
    temple_length: Optional[float] = Field(default=None, description="镜腿长度")
    
    lens_height: Optional[float] = Field(default=None, description="镜片高度")
    box_center_distance: Optional[float] = Field(default=None, description="几何中心距")
    
    color: Optional[str] = Field(default=None, description="颜色")
    quantity: int = Field(default=1, description="库存数量")
    price: Optional[float] = Field(default=None, description="价格")
    
    notes: Optional[str] = Field(default=None, description="备注")
    
    def to_frame(self) -> Frame:
        """转换为Frame对象"""
        style_map = {
            "全框": FrameStyle.FULL_RIM,
            "半框": FrameStyle.HALF_RIM,
            "无框": FrameStyle.RIMLESS,
            "半无框": FrameStyle.SEMI_RIMLESS,
        }
        
        material_map = {
            "金属": FrameMaterial.METAL,
            "塑料": FrameMaterial.PLASTIC,
            "TR90": FrameMaterial.TR90,
            "钛": FrameMaterial.TITANIUM,
            "合金": FrameMaterial.ALLOY,
            "木质": FrameMaterial.WOOD,
            "混合": FrameMaterial.MIXED,
        }
        
        style = style_map.get(self.style, FrameStyle.FULL_RIM) if self.style else FrameStyle.FULL_RIM
        material = material_map.get(self.material) if self.material else None
        
        return Frame(
            frame_id=self.frame_id,
            model=self.model,
            brand=self.brand,
            style=style,
            material=material,
            eye_size=self.eye_size,
            bridge_size=self.bridge_size,
            temple_length=self.temple_length,
            lens_height=self.lens_height,
            box_center_distance=self.box_center_distance,
            color=self.color,
            quantity=self.quantity,
            price=self.price,
            notes=self.notes,
        )
