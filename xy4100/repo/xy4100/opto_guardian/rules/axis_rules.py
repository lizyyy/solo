"""轴位相关规则"""

from ..models.validation import ValidationCategory, ValidationSeverity
from .base import BaseRule, RuleContext, RuleResult


class AxisValidationRule(BaseRule):
    """轴位有效性校验规则
    
    校验轴位是否在有效范围内，以及是否有散光时轴位必填
    """
    
    rule_id = "axis_validation"
    rule_name = "轴位有效性校验"
    rule_description = "校验轴位是否在有效范围内，散光时轴位必填"
    
    def execute(self, context: RuleContext) -> RuleResult:
        result = self.create_result()
        rules = context.rules
        rx = context.prescription
        
        min_axis = rules.min_axis
        max_axis = rules.max_axis
        
        for side, eye in [("右眼", rx.right_eye), ("左眼", rx.left_eye)]:
            has_astigmatism = abs(eye.cylinder) > 0.001
            
            if has_astigmatism:
                if eye.axis is None:
                    result.add_issue(
                        category=ValidationCategory.AXIS_VALIDATION,
                        severity=ValidationSeverity.ERROR,
                        message=f"{side}有散光但轴位为空",
                        detail="柱镜度数不为0时必须填写轴位",
                        location=side,
                        affected_field=f"{side}轴位",
                        suggested_fix="请检查验光单并补充轴位信息",
                    )
                else:
                    axis = eye.axis
                    
                    if axis < min_axis or axis > max_axis:
                        result.add_issue(
                            category=ValidationCategory.AXIS_VALIDATION,
                            severity=ValidationSeverity.ERROR,
                            message=f"{side}轴位超出有效范围",
                            detail=f"轴位应在 {min_axis}° 到 {max_axis}° 之间",
                            location=side,
                            affected_field=f"{side}轴位",
                            reference_value=f"{min_axis}° ~ {max_axis}°",
                            actual_value=f"{axis}°",
                            suggested_fix="请确认轴位是否正确录入",
                        )
                    
                    if axis == 0:
                        result.add_issue(
                            category=ValidationCategory.AXIS_VALIDATION,
                            severity=ValidationSeverity.INFO,
                            message=f"{side}轴位为0°",
                            detail="轴位0°等同于180°，建议统一使用180°",
                            location=side,
                            affected_field=f"{side}轴位",
                            suggested_fix="可统一改为180°，不影响实际效果",
                        )
                    
                    if axis == 180:
                        result.add_issue(
                            category=ValidationCategory.AXIS_VALIDATION,
                            severity=ValidationSeverity.INFO,
                            message=f"{side}轴位为180°（标准格式）",
                            location=side,
                        )
                    
                    common_axes = rules.common_axis_values
                    if axis not in common_axes:
                        result.add_issue(
                            category=ValidationCategory.AXIS_VALIDATION,
                            severity=ValidationSeverity.WARNING,
                            message=f"{side}轴位{axis}°不常见",
                            detail="常见轴位为: " + ", ".join(str(a) + "°" for a in common_axes),
                            location=side,
                            affected_field=f"{side}轴位",
                            actual_value=f"{axis}°",
                            suggested_fix="请确认轴位是否正确，非常规轴位可能需要特殊定制",
                        )
            else:
                if eye.axis is not None:
                    result.add_issue(
                        category=ValidationCategory.AXIS_VALIDATION,
                        severity=ValidationSeverity.WARNING,
                        message=f"{side}无散光但填写了轴位",
                        detail="柱镜度数为0时轴位无意义",
                        location=side,
                        affected_field=f"{side}轴位",
                        actual_value=f"{eye.axis}°",
                        suggested_fix="可删除轴位，或确认是否遗漏了散光度数",
                    )
        
        return result


class AxisSwapDetectionRule(BaseRule):
    """轴位互换检测规则
    
    检测左右眼轴位是否可能互换
    常见错误模式：
    1. 左右眼轴位写反
    2. 轴位相差90°（可能是正负柱镜转换错误）
    3. 常见轴位（0/90/180）混淆
    """
    
    rule_id = "axis_swap"
    rule_name = "轴位互换检测"
    rule_description = "检测左右眼轴位是否可能互换或录入错误"
    
    def execute(self, context: RuleContext) -> RuleResult:
        result = self.create_result()
        rx = context.prescription
        
        re_eye = rx.right_eye
        le_eye = rx.left_eye
        
        re_has_astig = abs(re_eye.cylinder) > 0.001
        le_has_astig = abs(le_eye.cylinder) > 0.001
        
        if not re_has_astig and not le_has_astig:
            result.add_issue(
                category=ValidationCategory.AXIS_SWAP,
                severity=ValidationSeverity.INFO,
                message="双眼均无散光，无需轴位检查",
            )
            return result
        
        if not re_has_astig or not le_has_astig:
            result.add_issue(
                category=ValidationCategory.AXIS_SWAP,
                severity=ValidationSeverity.INFO,
                message="单眼散光，无法检测轴位互换",
            )
            return result
        
        re_axis = re_eye.axis
        le_axis = le_eye.axis
        
        if re_axis is None or le_axis is None:
            result.add_issue(
                category=ValidationCategory.AXIS_SWAP,
                severity=ValidationSeverity.WARNING,
                message="轴位不完整，无法检测互换",
                detail="双眼散光但至少一只眼轴位为空",
                suggested_fix="请补充缺失的轴位信息",
            )
            return result
        
        re_axis_norm = 180 if re_axis == 0 else re_axis
        le_axis_norm = 180 if le_axis == 0 else le_axis
        
        if re_axis_norm == le_axis_norm:
            result.add_issue(
                category=ValidationCategory.AXIS_SWAP,
                severity=ValidationSeverity.INFO,
                message=f"双眼轴位相同（{re_axis_norm}°）",
                detail="这在对称散光中是正常的",
            )
            return result
        
        diff = abs(re_axis_norm - le_axis_norm)
        if diff > 90:
            diff = 180 - diff
        
        if diff == 90:
            result.add_issue(
                category=ValidationCategory.AXIS_SWAP,
                severity=ValidationSeverity.CRITICAL,
                message="⚠️ 轴位相差90°，高度怀疑正负柱镜格式转换错误",
                detail=(
                    f"右眼轴位{re_axis}°，左眼轴位{le_axis}°，相差正好90°。"
                    f"这通常是由于正负柱镜格式转换时轴位计算错误导致的。"
                ),
                location="双眼",
                affected_field="轴位",
                actual_value=f"右眼{re_axis}°，左眼{le_axis}°",
                suggested_fix=(
                    "请检查验光单原始记录，确认散光格式（正柱镜/负柱镜）。"
                    "正柱镜转负柱镜时，轴位需要加90°（超过180°则减180°）。"
                ),
            )
        
        common_axes = [0, 90, 180, 10, 20, 30, 45, 60, 70, 80, 100, 110, 120, 135, 150, 160, 170]
        
        if re_axis in common_axes and le_axis in common_axes:
            if (re_axis in [0, 180] and le_axis == 90) or (le_axis in [0, 180] and re_axis == 90):
                result.add_issue(
                    category=ValidationCategory.AXIS_SWAP,
                    severity=ValidationSeverity.WARNING,
                    message="⚠️ 轴位可能写反",
                    detail=(
                        f"右眼轴位{re_axis}°，左眼轴位{le_axis}°。"
                        f"水平轴位（0/180）和垂直轴位（90）在双眼中分别出现，可能存在录入错误。"
                    ),
                    location="双眼",
                    affected_field="轴位",
                    actual_value=f"右眼{re_axis}°，左眼{le_axis}°",
                    suggested_fix="请对照验光单确认左右眼轴位是否正确",
                )
        
        re_cyl = abs(re_eye.cylinder)
        le_cyl = abs(le_eye.cylinder)
        
        if abs(re_cyl - le_cyl) < 0.25:
            if diff > 30:
                result.add_issue(
                    category=ValidationCategory.AXIS_SWAP,
                    severity=ValidationSeverity.WARNING,
                    message=f"轴位差异较大（{diff}°），请确认",
                    detail=(
                        f"双眼散光度数相近（右眼{re_eye.cylinder}D，左眼{le_eye.cylinder}D）"
                        f"但轴位差异为{diff}°。请确认是否为录入错误。"
                    ),
                    location="双眼",
                    affected_field="轴位",
                    actual_value=f"右眼{re_axis}°，左眼{le_axis}°",
                    suggested_fix="请对照验光单确认轴位是否正确",
                )
        
        result.metadata["axis_difference"] = diff
        result.metadata["right_axis"] = re_axis
        result.metadata["left_axis"] = le_axis
        
        return result
