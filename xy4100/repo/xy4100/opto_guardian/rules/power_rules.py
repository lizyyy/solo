"""度数相关规则"""

from ..models.validation import ValidationCategory, ValidationSeverity
from .base import BaseRule, RuleContext, RuleResult


class PowerRangeRule(BaseRule):
    """度数范围校验规则
    
    校验球镜和柱镜度数是否在合理范围内
    """
    
    rule_id = "power_range"
    rule_name = "度数范围校验"
    rule_description = "校验球镜和柱镜度数是否在门店配置的合理范围内"
    
    def execute(self, context: RuleContext) -> RuleResult:
        result = self.create_result()
        rules = context.rules
        rx = context.prescription
        
        for side, eye in [("右眼", rx.right_eye), ("左眼", rx.left_eye)]:
            sphere = eye.sphere
            if sphere < rules.min_sphere or sphere > rules.max_sphere:
                result.add_issue(
                    category=ValidationCategory.POWER_RANGE,
                    severity=ValidationSeverity.ERROR,
                    message=f"{side}球镜度数超出范围",
                    detail=f"球镜度数应在 {rules.min_sphere}D 到 {rules.max_sphere}D 之间",
                    location=side,
                    affected_field=f"{side}球镜",
                    reference_value=f"{rules.min_sphere}D ~ {rules.max_sphere}D",
                    actual_value=f"{sphere}D",
                    suggested_fix="请确认验光单上的度数是否正确录入",
                )
            
            cylinder = eye.cylinder
            if abs(cylinder) > 0.001:
                if cylinder < rules.min_cylinder or cylinder > rules.max_cylinder:
                    result.add_issue(
                        category=ValidationCategory.POWER_RANGE,
                        severity=ValidationSeverity.ERROR,
                        message=f"{side}柱镜度数超出范围",
                        detail=f"柱镜度数应在 {rules.min_cylinder}D 到 {rules.max_cylinder}D 之间",
                        location=side,
                        affected_field=f"{side}柱镜",
                        reference_value=f"{rules.min_cylinder}D ~ {rules.max_cylinder}D",
                        actual_value=f"{cylinder}D",
                        suggested_fix="请确认散光度数是否正确录入",
                    )
        
        return result


class PowerStepRule(BaseRule):
    """度数步长校验规则
    
    校验度数是否符合标准步长（通常为0.25D）
    """
    
    rule_id = "power_step"
    rule_name = "度数步长校验"
    rule_description = "校验度数是否符合标准步长（0.25D）"
    
    def execute(self, context: RuleContext) -> RuleResult:
        result = self.create_result()
        rules = context.rules
        rx = context.prescription
        
        sphere_step = rules.sphere_step
        cylinder_step = rules.cylinder_step
        
        for side, eye in [("右眼", rx.right_eye), ("左眼", rx.left_eye)]:
            sphere = eye.sphere
            if abs(sphere) > 0.001:
                relative = abs(sphere)
                remainder = relative % sphere_step
                
                if remainder > 0.01 and (sphere_step - remainder) > 0.01:
                    expected = round(sphere / sphere_step) * sphere_step
                    result.add_issue(
                        category=ValidationCategory.POWER_RANGE,
                        severity=ValidationSeverity.WARNING,
                        message=f"{side}球镜度数不符合步长要求",
                        detail=f"球镜度数应以 {sphere_step}D 为步长",
                        location=side,
                        affected_field=f"{side}球镜",
                        reference_value=f"步长 {sphere_step}D",
                        actual_value=f"{sphere}D",
                        suggested_fix=f"建议调整为 {expected}D，请确认验光单",
                    )
            
            cylinder = eye.cylinder
            if abs(cylinder) > 0.001:
                relative = abs(cylinder)
                remainder = relative % cylinder_step
                
                if remainder > 0.01 and (cylinder_step - remainder) > 0.01:
                    expected = round(cylinder / cylinder_step) * cylinder_step
                    result.add_issue(
                        category=ValidationCategory.POWER_RANGE,
                        severity=ValidationSeverity.WARNING,
                        message=f"{side}柱镜度数不符合步长要求",
                        detail=f"柱镜度数应以 {cylinder_step}D 为步长",
                        location=side,
                        affected_field=f"{side}柱镜",
                        reference_value=f"步长 {cylinder_step}D",
                        actual_value=f"{cylinder}D",
                        suggested_fix=f"建议调整为 {expected}D，请确认验光单",
                    )
            
            add = eye.add
            if add is not None and abs(add) > 0.001:
                add_step = rules.sphere_step
                relative = abs(add)
                remainder = relative % add_step
                
                if remainder > 0.01 and (add_step - remainder) > 0.01:
                    expected = round(add / add_step) * add_step
                    result.add_issue(
                        category=ValidationCategory.POWER_RANGE,
                        severity=ValidationSeverity.WARNING,
                        message=f"{side}下加光度数不符合步长要求",
                        detail=f"下加光度数应以 {add_step}D 为步长",
                        location=side,
                        affected_field=f"{side}下加光",
                        reference_value=f"步长 {add_step}D",
                        actual_value=f"{add}D",
                        suggested_fix=f"建议调整为 {expected}D",
                    )
        
        return result


class CylinderFormatRule(BaseRule):
    """柱镜格式校验规则
    
    检测正柱镜格式，门店通常使用负柱镜格式
    """
    
    rule_id = "cylinder_format"
    rule_name = "柱镜格式校验"
    rule_description = "检测是否使用正柱镜格式，门店通常使用负柱镜格式"
    
    def execute(self, context: RuleContext) -> RuleResult:
        result = self.create_result()
        rules = context.rules
        rx = context.prescription
        
        allow_plus = rules.allow_plus_cylinder
        
        for side, eye in [("右眼", rx.right_eye), ("左眼", rx.left_eye)]:
            cylinder = eye.cylinder
            
            if cylinder > 0.001:
                if not allow_plus:
                    converted = eye.to_minus_cylinder()
                    result.add_issue(
                        category=ValidationCategory.CYLINDER_FORMAT,
                        severity=ValidationSeverity.WARNING,
                        message=f"{side}使用正柱镜格式",
                        detail="门店通常使用负柱镜格式，正柱镜格式可能导致加工错误",
                        location=side,
                        affected_field=f"{side}柱镜",
                        actual_value=f"球镜{eye.sphere}D 柱镜{eye.cylinder}D 轴位{eye.axis}°",
                        suggested_fix=(
                            f"转换为负柱镜格式: 球镜{converted.sphere}D "
                            f"柱镜{converted.cylinder}D 轴位{converted.axis}°"
                        ),
                    )
                else:
                    converted = eye.to_plus_cylinder()
                    result.add_issue(
                        category=ValidationCategory.CYLINDER_FORMAT,
                        severity=ValidationSeverity.INFO,
                        message=f"{side}使用正柱镜格式",
                        detail="门店已配置允许正柱镜格式",
                        location=side,
                    )
            
            elif cylinder < -0.001:
                result.add_issue(
                    category=ValidationCategory.CYLINDER_FORMAT,
                    severity=ValidationSeverity.INFO,
                    message=f"{side}使用负柱镜格式（标准格式）",
                    location=side,
                )
        
        return result
