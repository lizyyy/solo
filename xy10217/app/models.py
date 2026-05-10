from dataclasses import dataclass, field
from typing import List, Dict, Optional
import json
import os
from enum import Enum

class TeaGrade(Enum):
    SUPER = "特级"
    GRADE1 = "一级"
    GRADE2 = "二级"
    GRADE3 = "三级"

@dataclass
class TeaRawMaterial:
    id: str
    name: str
    grade: TeaGrade
    aroma_score: float
    cost_per_kg: float
    stock_kg: float
    description: str = ""

@dataclass
class BlendingComponent:
    material_id: str
    material_name: str
    grade: TeaGrade
    proportion: float
    quantity_kg: float
    cost: float

@dataclass
class BlendingPlan:
    batch_name: str
    target_weight_kg: float
    target_aroma_score: float
    max_cost_per_kg: float
    components: List[BlendingComponent] = field(default_factory=list)
    total_cost: float = 0.0
    avg_aroma_score: float = 0.0
    is_feasible: bool = False
    feasibility_reasons: List[str] = field(default_factory=list)
    violations: List[str] = field(default_factory=list)

@dataclass
class Inventory:
    materials: Dict[str, TeaRawMaterial] = field(default_factory=dict)
    
    def add_material(self, material: TeaRawMaterial):
        self.materials[material.id] = material
    
    def get_material(self, material_id: str) -> Optional[TeaRawMaterial]:
        return self.materials.get(material_id)
    
    def update_stock(self, material_id: str, quantity_kg: float):
        if material_id in self.materials:
            self.materials[material_id].stock_kg = quantity_kg
    
    def get_all_materials(self) -> List[TeaRawMaterial]:
        return list(self.materials.values())
    
    def to_dict(self) -> Dict:
        return {
            "materials": [
                {
                    "id": m.id,
                    "name": m.name,
                    "grade": m.grade.value,
                    "aroma_score": m.aroma_score,
                    "cost_per_kg": m.cost_per_kg,
                    "stock_kg": m.stock_kg,
                    "description": m.description
                }
                for m in self.materials.values()
            ]
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Inventory':
        inventory = cls()
        for m in data.get("materials", []):
            material = TeaRawMaterial(
                id=m["id"],
                name=m["name"],
                grade=TeaGrade(m["grade"]),
                aroma_score=m["aroma_score"],
                cost_per_kg=m["cost_per_kg"],
                stock_kg=m["stock_kg"],
                description=m.get("description", "")
            )
            inventory.add_material(material)
        return inventory

class BlendingCalculator:
    def __init__(self, inventory: Inventory):
        self.inventory = inventory
    
    def validate_proportions(self, components: List[Dict]) -> tuple[bool, List[str]]:
        total_proportion = sum(c["proportion"] for c in components)
        reasons = []
        
        if abs(total_proportion - 100) > 0.001:
            reasons.append(f"拼配比例合计应为100%，当前合计为 {total_proportion:.2f}%")
            return False, reasons
        
        for comp in components:
            material = self.inventory.get_material(comp["material_id"])
            if not material:
                reasons.append(f"原料ID {comp['material_id']} 不存在")
        
        return len(reasons) == 0, reasons
    
    def calculate_plan(self, 
                       batch_name: str,
                       target_weight_kg: float,
                       target_aroma_score: float,
                       max_cost_per_kg: float,
                       components: List[Dict]) -> BlendingPlan:
        
        plan = BlendingPlan(
            batch_name=batch_name,
            target_weight_kg=target_weight_kg,
            target_aroma_score=target_aroma_score,
            max_cost_per_kg=max_cost_per_kg
        )
        
        is_valid, validation_errors = self.validate_proportions(components)
        if not is_valid:
            plan.violations.extend(validation_errors)
            return plan
        
        plan.violations = []
        plan.feasibility_reasons = []
        
        total_cost = 0.0
        weighted_aroma = 0.0
        total_proportion = 0.0
        
        for comp in components:
            material = self.inventory.get_material(comp["material_id"])
            proportion = comp["proportion"]
            quantity_kg = (proportion / 100) * target_weight_kg
            cost = quantity_kg * material.cost_per_kg
            
            if quantity_kg > material.stock_kg:
                plan.violations.append(
                    f"原料 {material.name} ({material.grade.value}) 库存不足：需要 {quantity_kg:.2f}kg，实际库存 {material.stock_kg:.2f}kg"
                )
            
            component = BlendingComponent(
                material_id=material.id,
                material_name=material.name,
                grade=material.grade,
                proportion=proportion,
                quantity_kg=quantity_kg,
                cost=cost
            )
            plan.components.append(component)
            
            total_cost += cost
            weighted_aroma += material.aroma_score * (proportion / 100)
            total_proportion += proportion
        
        plan.total_cost = total_cost
        plan.avg_aroma_score = weighted_aroma
        
        avg_cost_per_kg = total_cost / target_weight_kg if target_weight_kg > 0 else 0
        
        if plan.avg_aroma_score < target_aroma_score:
            plan.violations.append(
                f"平均香气评分不足：目标 {target_aroma_score} 分，实际 {plan.avg_aroma_score:.2f} 分"
            )
        else:
            plan.feasibility_reasons.append(
                f"香气评分达标：目标 {target_aroma_score} 分，实际 {plan.avg_aroma_score:.2f} 分"
            )
        
        if avg_cost_per_kg > max_cost_per_kg:
            plan.violations.append(
                f"平均成本超标：目标 {max_cost_per_kg:.2f} 元/kg，实际 {avg_cost_per_kg:.2f} 元/kg"
            )
        else:
            plan.feasibility_reasons.append(
                f"成本控制达标：目标 {max_cost_per_kg:.2f} 元/kg，实际 {avg_cost_per_kg:.2f} 元/kg"
            )
        
        if not plan.violations:
            all_stocks_ok = all(
                c.quantity_kg <= self.inventory.get_material(c.material_id).stock_kg
                for c in plan.components
            )
            if all_stocks_ok:
                plan.feasibility_reasons.append("所有原料库存充足")
                plan.is_feasible = True
        
        return plan
    
    def generate_optimized_plans(self,
                                  target_weight_kg: float,
                                  target_aroma_score: float,
                                  max_cost_per_kg: float,
                                  exclude_material_ids: List[str] = None) -> List[BlendingPlan]:
        exclude_ids = set(exclude_material_ids or [])
        available_materials = [
            m for m in self.inventory.get_all_materials()
            if m.id not in exclude_ids and m.stock_kg > 0
        ]
        
        if not available_materials:
            return []
        
        plans = []
        high_score_materials = sorted(
            [m for m in available_materials if m.aroma_score >= target_aroma_score],
            key=lambda m: m.aroma_score, reverse=True
        )
        low_score_materials = sorted(
            [m for m in available_materials if m.aroma_score < target_aroma_score],
            key=lambda m: m.cost_per_kg
        )
        
        if high_score_materials:
            for i, high_mat in enumerate(high_score_materials[:2]):
                if low_score_materials:
                    for low_mat in low_score_materials[:2]:
                        for high_ratio in [70, 60, 50]:
                            low_ratio = 100 - high_ratio
                            if low_ratio <= 0:
                                continue
                            
                            components = [
                                {"material_id": high_mat.id, "proportion": high_ratio},
                                {"material_id": low_mat.id, "proportion": low_ratio}
                            ]
                            
                            plan = self.calculate_plan(
                                batch_name=f"优化方案{i+1}-高{high_ratio}%低{low_ratio}%",
                                target_weight_kg=target_weight_kg,
                                target_aroma_score=target_aroma_score,
                                max_cost_per_kg=max_cost_per_kg,
                                components=components
                            )
                            
                            if plan.is_feasible and len(plans) < 5:
                                plans.append(plan)
        
        all_possible_plans = []
        for mat1 in available_materials:
            for mat2 in available_materials:
                if mat1.id >= mat2.id:
                    continue
                for ratio in [30, 50, 70]:
                    components = [
                        {"material_id": mat1.id, "proportion": ratio},
                        {"material_id": mat2.id, "proportion": 100 - ratio}
                    ]
                    plan = self.calculate_plan(
                        batch_name=f"组合-{mat1.name}{ratio}%-{mat2.name}{100-ratio}%",
                        target_weight_kg=target_weight_kg,
                        target_aroma_score=target_aroma_score,
                        max_cost_per_kg=max_cost_per_kg,
                        components=components
                    )
                    all_possible_plans.append(plan)
        
        feasible_plans = [p for p in all_possible_plans if p.is_feasible]
        feasible_plans.sort(key=lambda p: p.total_cost)
        
        final_plans = plans + [p for p in feasible_plans if p.batch_name not in [pl.batch_name for pl in plans]]
        return final_plans[:10]

def load_sample_inventory() -> Inventory:
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    inventory_file = os.path.join(data_dir, 'sample_inventory.json')
    
    if os.path.exists(inventory_file):
        with open(inventory_file, 'r', encoding='utf-8') as f:
            return Inventory.from_dict(json.load(f))
    
    inventory = Inventory()
    inventory.add_material(TeaRawMaterial(
        id="M001",
        name="明前龙井",
        grade=TeaGrade.SUPER,
        aroma_score=95.0,
        cost_per_kg=680.0,
        stock_kg=50.0,
        description="特级明前龙井，豆香浓郁"
    ))
    inventory.add_material(TeaRawMaterial(
        id="M002",
        name="雨前龙井",
        grade=TeaGrade.GRADE1,
        aroma_score=88.0,
        cost_per_kg=420.0,
        stock_kg=120.0,
        description="一级雨前龙井，清香持久"
    ))
    inventory.add_material(TeaRawMaterial(
        id="M003",
        name="二级龙井",
        grade=TeaGrade.GRADE2,
        aroma_score=80.0,
        cost_per_kg=280.0,
        stock_kg=200.0,
        description="二级龙井，香气尚可"
    ))
    inventory.add_material(TeaRawMaterial(
        id="M004",
        name="三级龙井",
        grade=TeaGrade.GRADE3,
        aroma_score=72.0,
        cost_per_kg=150.0,
        stock_kg=350.0,
        description="三级龙井，香气较淡"
    ))
    inventory.add_material(TeaRawMaterial(
        id="M005",
        name="明前碧螺春",
        grade=TeaGrade.SUPER,
        aroma_score=92.0,
        cost_per_kg=580.0,
        stock_kg=30.0,
        description="特级明前碧螺春，花果香明显"
    ))
    inventory.add_material(TeaRawMaterial(
        id="M006",
        name="一级碧螺春",
        grade=TeaGrade.GRADE1,
        aroma_score=85.0,
        cost_per_kg=380.0,
        stock_kg=80.0,
        description="一级碧螺春，香气清雅"
    ))
    
    return inventory
