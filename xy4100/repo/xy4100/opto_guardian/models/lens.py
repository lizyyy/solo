"""镜片库存数据模型"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class LensType(str, Enum):
    """镜片类型"""
    SINGLE_VISION = "单光"
    BIFOCAL = "双光"
    PROGRESSIVE = "渐进"
    ANTI_BLUE = "防蓝光"
    PHOTOCHROMIC = "变色"
    POLARIZED = "偏光"


class LensMaterial(str, Enum):
    """镜片材质"""
    CR39 = "CR39"
    PC = "PC(太空片)"
    HIGH_INDEX_156 = "1.56"
    HIGH_INDEX_161 = "1.61"
    HIGH_INDEX_167 = "1.67"
    HIGH_INDEX_174 = "1.74"
    GLASS = "玻璃"


class LensCoating(str, Enum):
    """镜片膜层"""
    BASIC = "基础膜"
    ANTI_REFLECTION = "减反射膜"
    ANTI_SMUDGE = "防污膜"
    ANTI_STATIC = "防静电膜"
    HARD_COAT = "加硬膜"
    MULTI_COAT = "多层膜"


class LensStock(BaseModel):
    """镜片库存条目"""
    
    stock_id: str = Field(description="库存唯一标识")
    
    lens_type: LensType = Field(description="镜片类型")
    material: LensMaterial = Field(description="材质/折射率")
    
    min_sphere: float = Field(description="最小球镜度数")
    max_sphere: float = Field(description="最大球镜度数")
    sphere_step: float = Field(default=0.25, description="球镜度数步长")
    
    min_cylinder: float = Field(default=0.0, description="最小柱镜度数")
    max_cylinder: float = Field(default=0.0, description="最大柱镜度数")
    cylinder_step: float = Field(default=0.25, description="柱镜度数步长")
    
    min_add: Optional[float] = Field(default=None, description="最小下加光(渐进/双光)")
    max_add: Optional[float] = Field(default=None, description="最大下加光(渐进/双光)")
    add_step: Optional[float] = Field(default=0.25, description="下加光步长")
    
    diameter: float = Field(default=65.0, description="镜片直径(mm)")
    minimum_lens_height: Optional[float] = Field(default=None, description="最小瞳高要求(mm)")
    
    coating: Optional[LensCoating] = Field(default=None, description="膜层")
    brand: Optional[str] = Field(default=None, description="品牌")
    
    quantity: int = Field(default=0, description="库存数量")
    unit_price: Optional[float] = Field(default=None, description="单价")
    
    supplier: Optional[str] = Field(default=None, description="供应商")
    expiry_date: Optional[datetime] = Field(default=None, description="有效期")
    
    notes: Optional[str] = Field(default=None, description="备注")
    
    @field_validator("min_sphere", "max_sphere")
    @classmethod
    def validate_sphere_range(cls, v: float) -> float:
        """验证球镜范围"""
        if v < -30.0 or v > 20.0:
            raise ValueError(f"球镜度数超出合理范围: {v}")
        return v
    
    def supports_sphere(self, sphere: float) -> bool:
        """检查是否支持指定球镜度数"""
        if sphere < self.min_sphere or sphere > self.max_sphere:
            return False
        
        step = self.sphere_step
        relative = sphere - self.min_sphere
        if abs(relative % step) > 0.001:
            return False
        
        return True
    
    def supports_cylinder(self, cylinder: float) -> bool:
        """检查是否支持指定柱镜度数"""
        if abs(cylinder) < 0.001:
            return True
        
        if cylinder < self.min_cylinder or cylinder > self.max_cylinder:
            return False
        
        step = self.cylinder_step
        relative = cylinder - self.min_cylinder
        if abs(relative % step) > 0.001:
            return False
        
        return True
    
    def supports_add(self, add: Optional[float]) -> bool:
        """检查是否支持指定下加光"""
        if add is None:
            return True
        
        if self.min_add is None or self.max_add is None:
            return False
        
        if add < self.min_add or add > self.max_add:
            return False
        
        if self.add_step:
            relative = add - self.min_add
            if abs(relative % self.add_step) > 0.001:
                return False
        
        return True
    
    def can_process(self, sphere: float, cylinder: float = 0.0, add: Optional[float] = None) -> bool:
        """检查是否可加工指定度数
        
        Args:
            sphere: 球镜度数
            cylinder: 柱镜度数
            add: 下加光度数(可选)
            
        Returns:
            是否可加工
        """
        if not self.supports_sphere(sphere):
            return False
        
        if not self.supports_cylinder(cylinder):
            return False
        
        if not self.supports_add(add):
            return False
        
        if self.quantity <= 0:
            return False
        
        return True
    
    def get_closest_sphere(self, sphere: float) -> float:
        """获取最接近的可用球镜度数"""
        if self.supports_sphere(sphere):
            return sphere
        
        step = self.sphere_step
        
        lower = self.min_sphere + ((sphere - self.min_sphere) // step) * step
        upper = lower + step
        
        if lower < self.min_sphere:
            return self.min_sphere
        if upper > self.max_sphere:
            return self.max_sphere
        
        if sphere - lower < upper - sphere:
            return lower
        return upper
    
    def get_closest_cylinder(self, cylinder: float) -> float:
        """获取最接近的可用柱镜度数"""
        if self.supports_cylinder(cylinder):
            return cylinder
        
        step = self.cylinder_step
        
        lower = self.min_cylinder + ((cylinder - self.min_cylinder) // step) * step
        upper = lower + step
        
        if lower < self.min_cylinder:
            return self.min_cylinder
        if upper > self.max_cylinder:
            return self.max_cylinder
        
        if cylinder - lower < upper - cylinder:
            return lower
        return upper


class LensInventory(BaseModel):
    """镜片库存管理"""
    
    items: list[LensStock] = Field(default_factory=list, description="库存条目列表")
    
    def add_item(self, item: LensStock) -> None:
        """添加库存条目"""
        self.items.append(item)
    
    def find_matching_lenses(
        self,
        sphere: float,
        cylinder: float = 0.0,
        add: Optional[float] = None,
        lens_type: Optional[LensType] = None,
        material: Optional[LensMaterial] = None,
    ) -> list[LensStock]:
        """查找匹配的镜片
        
        Args:
            sphere: 球镜度数
            cylinder: 柱镜度数
            add: 下加光
            lens_type: 镜片类型筛选
            material: 材质筛选
            
        Returns:
            匹配的镜片列表
        """
        results = []
        
        for item in self.items:
            if lens_type and item.lens_type != lens_type:
                continue
            
            if material and item.material != material:
                continue
            
            if item.can_process(sphere, cylinder, add):
                results.append(item)
        
        return results
    
    def find_alternative_lenses(
        self,
        sphere: float,
        cylinder: float = 0.0,
        add: Optional[float] = None,
        lens_type: Optional[LensType] = None,
    ) -> list[tuple[LensStock, float, float]]:
        """查找替代镜片（度数最接近的）
        
        Returns:
            [(镜片, 球镜差值, 柱镜差值)] 列表
        """
        alternatives = []
        
        for item in self.items:
            if lens_type and item.lens_type != lens_type:
                continue
            
            if item.quantity <= 0:
                continue
            
            closest_sphere = item.get_closest_sphere(sphere)
            closest_cylinder = item.get_closest_cylinder(cylinder)
            
            sphere_diff = abs(closest_sphere - sphere)
            cylinder_diff = abs(closest_cylinder - cylinder)
            
            if item.supports_add(add):
                alternatives.append((item, sphere_diff, cylinder_diff))
        
        alternatives.sort(key=lambda x: (x[1] + x[2]))
        return alternatives
    
    def get_summary(self) -> dict:
        """获取库存摘要"""
        type_counts = {}
        material_counts = {}
        total_quantity = 0
        
        for item in self.items:
            type_name = item.lens_type.value
            type_counts[type_name] = type_counts.get(type_name, 0) + item.quantity
            
            material_name = item.material.value
            material_counts[material_name] = material_counts.get(material_name, 0) + item.quantity
            
            total_quantity += item.quantity
        
        return {
            "total_items": len(self.items),
            "total_quantity": total_quantity,
            "by_type": type_counts,
            "by_material": material_counts,
        }


class LensEntry(BaseModel):
    """镜片CSV导入条目"""
    
    stock_id: str = Field(description="库存ID")
    
    lens_type: str = Field(description="类型: 单光/双光/渐进/防蓝光/变色/偏光")
    material: str = Field(description="材质: CR39/PC/1.56/1.61/1.67/1.74/玻璃")
    
    min_sphere: float = Field(description="最小球镜")
    max_sphere: float = Field(description="最大球镜")
    sphere_step: float = Field(default=0.25, description="球镜步长")
    
    min_cylinder: float = Field(default=0.0, description="最小柱镜")
    max_cylinder: float = Field(default=0.0, description="最大柱镜")
    cylinder_step: float = Field(default=0.25, description="柱镜步长")
    
    min_add: Optional[float] = Field(default=None, description="最小下加光")
    max_add: Optional[float] = Field(default=None, description="最大下加光")
    add_step: Optional[float] = Field(default=0.25, description="下加光步长")
    
    diameter: float = Field(default=65.0, description="镜片直径")
    minimum_lens_height: Optional[float] = Field(default=None, description="最小瞳高要求")
    
    coating: Optional[str] = Field(default=None, description="膜层")
    brand: Optional[str] = Field(default=None, description="品牌")
    
    quantity: int = Field(default=1, description="库存数量")
    unit_price: Optional[float] = Field(default=None, description="单价")
    
    supplier: Optional[str] = Field(default=None, description="供应商")
    notes: Optional[str] = Field(default=None, description="备注")
    
    def to_lens_stock(self) -> LensStock:
        """转换为LensStock对象"""
        type_map = {
            "单光": LensType.SINGLE_VISION,
            "双光": LensType.BIFOCAL,
            "渐进": LensType.PROGRESSIVE,
            "防蓝光": LensType.ANTI_BLUE,
            "变色": LensType.PHOTOCHROMIC,
            "偏光": LensType.POLARIZED,
        }
        
        material_map = {
            "CR39": LensMaterial.CR39,
            "PC": LensMaterial.PC,
            "太空片": LensMaterial.PC,
            "1.56": LensMaterial.HIGH_INDEX_156,
            "1.61": LensMaterial.HIGH_INDEX_161,
            "1.67": LensMaterial.HIGH_INDEX_167,
            "1.74": LensMaterial.HIGH_INDEX_174,
            "玻璃": LensMaterial.GLASS,
        }
        
        coating_map = {
            "基础膜": LensCoating.BASIC,
            "减反射膜": LensCoating.ANTI_REFLECTION,
            "防污膜": LensCoating.ANTI_SMUDGE,
            "防静电膜": LensCoating.ANTI_STATIC,
            "加硬膜": LensCoating.HARD_COAT,
            "多层膜": LensCoating.MULTI_COAT,
        }
        
        lens_type = type_map.get(self.lens_type, LensType.SINGLE_VISION)
        material = material_map.get(self.material, LensMaterial.CR39)
        coating = coating_map.get(self.coating) if self.coating else None
        
        return LensStock(
            stock_id=self.stock_id,
            lens_type=lens_type,
            material=material,
            min_sphere=self.min_sphere,
            max_sphere=self.max_sphere,
            sphere_step=self.sphere_step,
            min_cylinder=self.min_cylinder,
            max_cylinder=self.max_cylinder,
            cylinder_step=self.cylinder_step,
            min_add=self.min_add,
            max_add=self.max_add,
            add_step=self.add_step,
            diameter=self.diameter,
            minimum_lens_height=self.minimum_lens_height,
            coating=coating,
            brand=self.brand,
            quantity=self.quantity,
            unit_price=self.unit_price,
            supplier=self.supplier,
            notes=self.notes,
        )
