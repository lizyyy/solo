"""加工计划服务 - 生成加工建议"""

import uuid
from datetime import datetime
from typing import Optional

from ..models.config import StoreConfig
from ..models.frame import Frame
from ..models.lens import LensInventory, LensStock, LensType
from ..models.order import ProcessingPlan
from ..models.prescription import Prescription


class ProcessingPlanResult:
    """加工计划结果"""
    
    def __init__(self, plan_id: str, prescription_id: str):
        self.plan_id = plan_id
        self.prescription_id = prescription_id
        self.created_at = datetime.now()
        
        self.right_eye: dict = {}
        self.left_eye: dict = {}
        
        self.pd_adjustment: Optional[dict] = None
        self.ph_adjustment: Optional[dict] = None
        
        self.estimated_lens_diameter: Optional[dict] = None
        
        self.warnings: list[str] = []
        self.suggestions: list[str] = []
        
        self.total_estimated_cost: Optional[float] = None
        self.estimated_processing_days: int = 3
    
    def to_dict(self) -> dict:
        return {
            "plan_id": self.plan_id,
            "prescription_id": self.prescription_id,
            "created_at": self.created_at.isoformat(),
            "right_eye": self.right_eye,
            "left_eye": self.left_eye,
            "pd_adjustment": self.pd_adjustment,
            "ph_adjustment": self.ph_adjustment,
            "estimated_lens_diameter": self.estimated_lens_diameter,
            "warnings": self.warnings,
            "suggestions": self.suggestions,
            "total_estimated_cost": self.total_estimated_cost,
            "estimated_processing_days": self.estimated_processing_days,
        }
    
    def to_processing_plan(self) -> ProcessingPlan:
        return ProcessingPlan(
            plan_id=self.plan_id,
            right_eye=self.right_eye,
            left_eye=self.left_eye,
            pd_adjustment=self.pd_adjustment,
            ph_adjustment=self.ph_adjustment,
            estimated_lens_diameter=self.estimated_lens_diameter,
            warnings=self.warnings,
            suggestions=self.suggestions,
            total_estimated_cost=self.total_estimated_cost,
            estimated_processing_days=self.estimated_processing_days,
        )


class PlanningService:
    """加工计划服务"""
    
    def __init__(self, store_config: StoreConfig):
        self.store_config = store_config
    
    def generate_plan(
        self,
        prescription: Prescription,
        frame: Optional[Frame] = None,
        inventory: Optional[LensInventory] = None,
        preferred_lens_type: Optional[LensType] = None,
    ) -> ProcessingPlanResult:
        """生成加工计划
        
        Args:
            prescription: 处方数据
            frame: 镜架数据
            inventory: 镜片库存
            preferred_lens_type: 首选镜片类型
            
        Returns:
            加工计划结果
        """
        plan_id = f"PLAN-{uuid.uuid4().hex[:8]}"
        result = ProcessingPlanResult(
            plan_id=plan_id,
            prescription_id=prescription.prescription_id,
        )
        
        rx_minus = prescription.to_minus_cylinder()
        
        result.right_eye = self._generate_eye_plan(
            "右眼",
            rx_minus.right_eye.sphere,
            rx_minus.right_eye.cylinder,
            rx_minus.right_eye.axis,
            rx_minus.right_eye.add,
            inventory,
            preferred_lens_type,
        )
        
        result.left_eye = self._generate_eye_plan(
            "左眼",
            rx_minus.left_eye.sphere,
            rx_minus.left_eye.cylinder,
            rx_minus.left_eye.axis,
            rx_minus.left_eye.add,
            inventory,
            preferred_lens_type,
        )
        
        if frame:
            pd_right = prescription.get_pd_right()
            pd_left = prescription.get_pd_left()
            pd_total = prescription.get_pd_total()
            
            bc = frame.get_box_center_distance()
            half_bc = bc / 2
            
            if pd_right and pd_left:
                right_deviation = half_bc - pd_right
                left_deviation = pd_left - half_bc
                
                result.pd_adjustment = {
                    "box_center_distance": bc,
                    "right_deviation": right_deviation,
                    "left_deviation": left_deviation,
                    "total_deviation": right_deviation + left_deviation,
                    "notes": self._calculate_pd_notes(right_deviation, left_deviation),
                }
                
                right_diam, left_diam = frame.estimate_lens_diameter(pd_right, pd_left)
                result.estimated_lens_diameter = {
                    "right_eye": right_diam,
                    "left_eye": left_diam,
                    "frame_eye_size": frame.eye_size,
                }
                
                if right_diam > 70 or left_diam > 70:
                    result.warnings.append(
                        f"估算镜片直径较大(右眼{right_diam:.1f}mm, 左眼{left_diam:.1f}mm)，"
                        f"请确认库存镜片直径是否足够"
                    )
            
            if prescription.ph_right and prescription.ph_left and frame.lens_height:
                result.ph_adjustment = {
                    "right_ph": prescription.ph_right,
                    "left_ph": prescription.ph_left,
                    "lens_height": frame.lens_height,
                    "right_ratio": prescription.ph_right / frame.lens_height,
                    "left_ratio": prescription.ph_left / frame.lens_height,
                }
        
        total_cost = 0.0
        has_cost = False
        
        for eye_plan in [result.right_eye, result.left_eye]:
            recommended = eye_plan.get("recommended_lens")
            if recommended and recommended.get("unit_price"):
                total_cost += recommended["unit_price"]
                has_cost = True
        
        if has_cost:
            result.total_estimated_cost = total_cost
        
        result.suggestions = self._generate_suggestions(prescription, frame, result)
        result.warnings.extend(self._generate_warnings(prescription, frame, result))
        
        return result
    
    def _generate_eye_plan(
        self,
        side: str,
        sphere: float,
        cylinder: float,
        axis: Optional[int],
        add: Optional[float],
        inventory: Optional[LensInventory],
        preferred_lens_type: Optional[LensType],
    ) -> dict:
        """生成单眼加工方案"""
        plan = {
            "side": side,
            "sphere": sphere,
            "cylinder": cylinder,
            "axis": axis,
            "add": add,
            "format": "负柱镜",
            "recommended_lens": None,
            "alternative_lenses": [],
        }
        
        if inventory:
            matching = inventory.find_matching_lenses(
                sphere=sphere,
                cylinder=cylinder,
                add=add,
                lens_type=preferred_lens_type,
            )
            
            if matching:
                recommended = self._select_best_lens(matching, sphere, cylinder)
                plan["recommended_lens"] = {
                    "stock_id": recommended.stock_id,
                    "lens_type": recommended.lens_type.value,
                    "material": recommended.material.value,
                    "brand": recommended.brand,
                    "diameter": recommended.diameter,
                    "quantity_available": recommended.quantity,
                    "unit_price": recommended.unit_price,
                    "supplier": recommended.supplier,
                }
                
                alternatives = [l for l in matching if l.stock_id != recommended.stock_id][:3]
                plan["alternative_lenses"] = [
                    {
                        "stock_id": alt.stock_id,
                        "lens_type": alt.lens_type.value,
                        "material": alt.material.value,
                        "brand": alt.brand,
                        "unit_price": alt.unit_price,
                    }
                    for alt in alternatives
                ]
            else:
                alternatives = inventory.find_alternative_lenses(
                    sphere=sphere,
                    cylinder=cylinder,
                    add=add,
                    lens_type=preferred_lens_type,
                )
                
                if alternatives:
                    plan["alternative_lenses"] = [
                        {
                            "stock_id": alt.stock_id,
                            "lens_type": alt.lens_type.value,
                            "material": alt.material.value,
                            "closest_sphere": alt.get_closest_sphere(sphere),
                            "closest_cylinder": alt.get_closest_cylinder(cylinder),
                            "sphere_diff": sphere_diff,
                            "cylinder_diff": cyl_diff,
                            "unit_price": alt.unit_price,
                        }
                        for alt, sphere_diff, cyl_diff in alternatives[:5]
                    ]
        
        return plan
    
    def _select_best_lens(
        self,
        lenses: list[LensStock],
        sphere: float,
        cylinder: float,
    ) -> LensStock:
        """选择最佳镜片"""
        if len(lenses) == 1:
            return lenses[0]
        
        scored = []
        for lens in lenses:
            score = 0
            
            if lens.unit_price:
                score -= lens.unit_price * 0.1
            
            score += lens.quantity * 0.5
            
            abs_sphere = abs(sphere)
            if abs_sphere > 6.0:
                if "1.74" in lens.material.value:
                    score += 50
                elif "1.67" in lens.material.value:
                    score += 30
                elif "1.61" in lens.material.value:
                    score += 10
            
            scored.append((score, lens))
        
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]
    
    def _calculate_pd_notes(self, right_dev: float, left_dev: float) -> list[str]:
        """计算瞳距调整说明"""
        notes = []
        
        total_dev = right_dev + left_dev
        
        if abs(total_dev) < 1:
            notes.append("瞳距与镜框匹配良好，无需特殊移心")
        else:
            direction = "内移" if total_dev > 0 else "外移"
            notes.append(f"需要进行{direction}加工，总移心量: {abs(total_dev):.1f}mm")
            notes.append(f"右眼移心: {right_dev:.1f}mm，左眼移心: {left_dev:.1f}mm")
        
        if abs(right_dev) > 4 or abs(left_dev) > 4:
            notes.append("⚠️ 移心量较大，请确认镜片直径是否足够")
        
        return notes
    
    def _generate_suggestions(
        self,
        prescription: Prescription,
        frame: Optional[Frame],
        plan: ProcessingPlanResult,
    ) -> list[str]:
        """生成加工建议"""
        suggestions = []
        
        re_sphere = abs(prescription.right_eye.sphere)
        le_sphere = abs(prescription.left_eye.sphere)
        max_sphere = max(re_sphere, le_sphere)
        
        if max_sphere > 4.0:
            suggestions.append(
                f"度数较高(最高{max_sphere}D)，建议选择高折射率镜片以改善外观"
            )
        
        if max_sphere > 6.0:
            suggestions.append(
                "高度数处方，建议确认镜片边缘厚度，可考虑美薄处理"
            )
        
        re_cyl = abs(prescription.right_eye.cylinder)
        le_cyl = abs(prescription.left_eye.cylinder)
        max_cyl = max(re_cyl, le_cyl)
        
        if max_cyl > 2.0:
            suggestions.append(
                f"散光度数较高(最高{max_cyl}D)，加工时请注意轴位准确性"
            )
        
        if prescription.right_eye.add or prescription.left_eye.add:
            suggestions.append(
                "下光处方(渐进/双光)，请确认瞳高数据准确"
            )
            if not prescription.ph_right or not prescription.ph_left:
                suggestions.append(
                    "⚠️ 下光处方但缺少瞳高数据，建议补充测量"
                )
        
        if frame:
            if frame.style.value in ["无框", "半框"]:
                suggestions.append(
                    f"{frame.style.value}镜架，加工时请注意镜片边缘处理"
                )
        
        return suggestions
    
    def _generate_warnings(
        self,
        prescription: Prescription,
        frame: Optional[Frame],
        plan: ProcessingPlanResult,
    ) -> list[str]:
        """生成警告信息"""
        warnings = []
        
        re_lens = plan.right_eye.get("recommended_lens")
        le_lens = plan.left_eye.get("recommended_lens")
        
        if not re_lens:
            warnings.append("⚠️ 右眼度数无匹配库存镜片，需考虑替代方案或定制")
        if not le_lens:
            warnings.append("⚠️ 左眼度数无匹配库存镜片，需考虑替代方案或定制")
        
        if re_lens and re_lens.get("quantity_available", 0) < 2:
            warnings.append(f"⚠️ 右眼推荐镜片库存不足(剩余{re_lens.get('quantity_available')}片)")
        if le_lens and le_lens.get("quantity_available", 0) < 2:
            warnings.append(f"⚠️ 左眼推荐镜片库存不足(剩余{le_lens.get('quantity_available')}片)")
        
        return warnings
