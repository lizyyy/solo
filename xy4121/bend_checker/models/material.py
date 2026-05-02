import math
from dataclasses import dataclass, field
from typing import Dict, Optional, List


@dataclass
class Material:
    name: str
    grade: str
    thickness: float
    tensile_strength: float  
    k_factor: float
    min_bend_radius: float  
    description: Optional[str] = None
    
    def get_k_factor_for_radius(self, bend_radius: float) -> float:
        ratio = bend_radius / self.thickness
        if ratio < 1.0:
            return min(self.k_factor, 0.33)
        elif ratio < 2.0:
            return min(self.k_factor, 0.38)
        else:
            return self.k_factor
    
    def calculate_bend_deduction(self, 
                                   bend_angle: float, 
                                   bend_radius: float,
                                   k_factor: Optional[float] = None) -> float:
        if k_factor is None:
            k_factor = self.get_k_factor_for_radius(bend_radius)
        
        angle_rad = math.radians(bend_angle)
        inside_set_back = (bend_radius + self.thickness) * math.tan(angle_rad / 2)
        neutral_axis_length = math.pi * (bend_radius + k_factor * self.thickness) * bend_angle / 180
        bend_deduction = 2 * inside_set_back - neutral_axis_length
        
        return round(bend_deduction, 3)


@dataclass
class MaterialLibrary:
    materials: Dict[str, Material] = field(default_factory=dict)
    
    def add_material(self, material: Material) -> None:
        key = f"{material.grade}_{material.thickness}".lower()
        self.materials[key] = material
    
    def get_material(self, grade: str, thickness: float) -> Optional[Material]:
        key = f"{grade}_{thickness}".lower()
        return self.materials.get(key)
    
    def get_materials_by_grade(self, grade: str) -> List[Material]:
        grade_lower = grade.lower()
        return [m for m in self.materials.values() 
                if m.grade.lower() == grade_lower]
    
    def get_all_grades(self) -> List[str]:
        return list(set(m.grade for m in self.materials.values()))
    
    def get_all_thicknesses(self) -> List[float]:
        return list(set(m.thickness for m in self.materials.values()))
    
    @classmethod
    def create_default_library(cls) -> 'MaterialLibrary':
        library = cls()
        
        default_materials = [
            Material(
                name="冷轧钢板",
                grade="SPCC",
                thickness=1.0,
                tensile_strength=270.0,
                k_factor=0.33,
                min_bend_radius=0.8,
                description="常用冷轧钢板"
            ),
            Material(
                name="冷轧钢板",
                grade="SPCC",
                thickness=1.5,
                tensile_strength=270.0,
                k_factor=0.35,
                min_bend_radius=1.0,
                description="常用冷轧钢板"
            ),
            Material(
                name="冷轧钢板",
                grade="SPCC",
                thickness=2.0,
                tensile_strength=270.0,
                k_factor=0.38,
                min_bend_radius=1.5,
                description="常用冷轧钢板"
            ),
            Material(
                name="冷轧钢板",
                grade="SPCC",
                thickness=3.0,
                tensile_strength=270.0,
                k_factor=0.40,
                min_bend_radius=2.0,
                description="常用冷轧钢板"
            ),
            Material(
                name="不锈钢板",
                grade="SUS304",
                thickness=1.0,
                tensile_strength=520.0,
                k_factor=0.35,
                min_bend_radius=1.0,
                description="奥氏体不锈钢"
            ),
            Material(
                name="不锈钢板",
                grade="SUS304",
                thickness=1.5,
                tensile_strength=520.0,
                k_factor=0.38,
                min_bend_radius=1.5,
                description="奥氏体不锈钢"
            ),
            Material(
                name="不锈钢板",
                grade="SUS304",
                thickness=2.0,
                tensile_strength=520.0,
                k_factor=0.40,
                min_bend_radius=2.0,
                description="奥氏体不锈钢"
            ),
            Material(
                name="铝合金板",
                grade="AL1060",
                thickness=1.0,
                tensile_strength=110.0,
                k_factor=0.30,
                min_bend_radius=0.5,
                description="纯铝"
            ),
            Material(
                name="铝合金板",
                grade="AL1060",
                thickness=1.5,
                tensile_strength=110.0,
                k_factor=0.32,
                min_bend_radius=0.8,
                description="纯铝"
            ),
            Material(
                name="铝合金板",
                grade="AL5052",
                thickness=1.0,
                tensile_strength=195.0,
                k_factor=0.33,
                min_bend_radius=0.8,
                description="铝镁合金"
            ),
            Material(
                name="铝合金板",
                grade="AL5052",
                thickness=2.0,
                tensile_strength=195.0,
                k_factor=0.36,
                min_bend_radius=1.5,
                description="铝镁合金"
            ),
        ]
        
        for mat in default_materials:
            library.add_material(mat)
        
        return library
