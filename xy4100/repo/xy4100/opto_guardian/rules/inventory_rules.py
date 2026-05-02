"""库存相关规则"""

from ..models.validation import ValidationCategory, ValidationSeverity
from .base import BaseRule, RuleContext, RuleResult


class InventoryAvailabilityRule(BaseRule):
    """库存可用性校验规则
    
    校验处方度数是否在库存镜片的可用范围内
    """
    
    rule_id = "inventory_availability"
    rule_name = "库存可用性校验"
    rule_description = "校验处方度数是否在库存镜片的可用范围内"
    
    def execute(self, context: RuleContext) -> RuleResult:
        result = self.create_result()
        rx = context.prescription
        inventory = context.inventory
        
        if inventory is None or len(inventory.items) == 0:
            result.add_issue(
                category=ValidationCategory.INVENTORY_AVAILABILITY,
                severity=ValidationSeverity.WARNING,
                message="未提供镜片库存数据",
                detail="无法进行库存可用性校验",
                suggested_fix="请导入镜片库存表以进行更完整的校验",
            )
            return result
        
        for side, eye in [("右眼", rx.right_eye), ("左眼", rx.left_eye)]:
            sphere = eye.sphere
            cylinder = eye.cylinder
            add = eye.add
            
            matching_lenses = inventory.find_matching_lenses(
                sphere=sphere,
                cylinder=cylinder,
                add=add,
            )
            
            if matching_lenses:
                lens_info = []
                for lens in matching_lenses[:3]:
                    info = f"{lens.lens_type.value}({lens.material.value})"
                    if lens.brand:
                        info += f" - {lens.brand}"
                    lens_info.append(info)
                
                result.add_issue(
                    category=ValidationCategory.INVENTORY_AVAILABILITY,
                    severity=ValidationSeverity.INFO,
                    message=f"{side}度数有库存匹配",
                    detail=(
                        f"球镜{sphere}D, 柱镜{cylinder}D"
                        + (f", 下加光{add}D" if add else "")
                        + f" - 匹配到 {len(matching_lenses)} 种镜片"
                    ),
                    location=side,
                    affected_field=f"{side}度数",
                    actual_value=", ".join(lens_info),
                )
                
                result.metadata[f"{side}_matching_count"] = len(matching_lenses)
            else:
                alternatives = inventory.find_alternative_lenses(
                    sphere=sphere,
                    cylinder=cylinder,
                    add=add,
                )
                
                if alternatives:
                    alt_info = []
                    for lens, sphere_diff, cyl_diff in alternatives[:3]:
                        closest_sphere = lens.get_closest_sphere(sphere)
                        closest_cyl = lens.get_closest_cylinder(cylinder)
                        info = (
                            f"{lens.lens_type.value}({lens.material.value}): "
                            f"球镜{closest_sphere}D(差{sphere_diff}D), "
                            f"柱镜{closest_cyl}D(差{cyl_diff}D)"
                        )
                        alt_info.append(info)
                    
                    result.add_issue(
                        category=ValidationCategory.INVENTORY_AVAILABILITY,
                        severity=ValidationSeverity.ERROR,
                        message=f"{side}度数无库存匹配",
                        detail=(
                            f"球镜{sphere}D, 柱镜{cylinder}D"
                            + (f", 下加光{add}D" if add else "")
                            + " 在当前库存中无完全匹配的镜片"
                        ),
                        location=side,
                        affected_field=f"{side}度数",
                        actual_value=f"球镜{sphere}D, 柱镜{cylinder}D",
                        suggested_fix="可选替代方案:\n" + "\n".join(alt_info),
                    )
                else:
                    result.add_issue(
                        category=ValidationCategory.INVENTORY_AVAILABILITY,
                        severity=ValidationSeverity.CRITICAL,
                        message=f"{side}度数无库存且无替代方案",
                        detail=(
                            f"球镜{sphere}D, 柱镜{cylinder}D"
                            + (f", 下加光{add}D" if add else "")
                            + " 在当前库存中完全无法匹配"
                        ),
                        location=side,
                        affected_field=f"{side}度数",
                        actual_value=f"球镜{sphere}D, 柱镜{cylinder}D",
                        suggested_fix="需要向供应商订购定制镜片，或与患者沟通调整处方",
                    )
        
        summary = inventory.get_summary()
        result.metadata["inventory_summary"] = summary
        
        return result
