"""瞳距/瞳高相关规则"""

from ..models.validation import ValidationCategory, ValidationSeverity
from .base import BaseRule, RuleContext, RuleResult


class PDValidationRule(BaseRule):
    """瞳距校验规则
    
    校验瞳距是否在合理范围内，单眼瞳距与总瞳距是否一致
    """
    
    rule_id = "pd_validation"
    rule_name = "瞳距校验"
    rule_description = "校验瞳距是否在合理范围内，单眼瞳距与总瞳距是否一致"
    
    def execute(self, context: RuleContext) -> RuleResult:
        result = self.create_result()
        rules = context.rules
        rx = context.prescription
        
        pd_total = rx.get_pd_total()
        pd_right = rx.get_pd_right()
        pd_left = rx.get_pd_left()
        
        if pd_total is None and pd_right is None and pd_left is None:
            result.add_issue(
                category=ValidationCategory.PD_VALIDATION,
                severity=ValidationSeverity.ERROR,
                message="缺少瞳距数据",
                detail="瞳距是配镜的必要参数，缺少瞳距将导致加工错误",
                affected_field="瞳距",
                suggested_fix="请补充总瞳距或单眼瞳距数据",
            )
            return result
        
        if pd_total is not None:
            if pd_total < rules.min_pd:
                result.add_issue(
                    category=ValidationCategory.PD_VALIDATION,
                    severity=ValidationSeverity.ERROR,
                    message="总瞳距过小",
                    detail=f"总瞳距应不小于 {rules.min_pd}mm",
                    affected_field="总瞳距",
                    reference_value=f"≥ {rules.min_pd}mm",
                    actual_value=f"{pd_total}mm",
                    suggested_fix="请确认瞳距测量是否正确",
                )
            
            if pd_total > rules.max_pd:
                result.add_issue(
                    category=ValidationCategory.PD_VALIDATION,
                    severity=ValidationSeverity.ERROR,
                    message="总瞳距过大",
                    detail=f"总瞳距应不大于 {rules.max_pd}mm",
                    affected_field="总瞳距",
                    reference_value=f"≤ {rules.max_pd}mm",
                    actual_value=f"{pd_total}mm",
                    suggested_fix="请确认瞳距测量是否正确",
                )
        
        if rx.pd_right is not None and rx.pd_left is not None:
            calculated_total = rx.pd_right + rx.pd_left
            
            if pd_total is not None:
                diff = abs(calculated_total - pd_total)
                
                if diff > rules.pd_tolerance:
                    result.add_issue(
                        category=ValidationCategory.PD_VALIDATION,
                        severity=ValidationSeverity.ERROR,
                        message="单眼瞳距与总瞳距不一致",
                        detail=(
                            f"单眼瞳距之和({calculated_total}mm)与总瞳距({pd_total}mm)"
                            f"相差 {diff}mm，超出允许范围({rules.pd_tolerance}mm)"
                        ),
                        affected_field="瞳距",
                        reference_value=f"差异≤ {rules.pd_tolerance}mm",
                        actual_value=f"差异 {diff}mm",
                        suggested_fix="请核对瞳距数据，确认单眼瞳距或总瞳距是否正确",
                    )
            
            pd_diff = abs(rx.pd_right - rx.pd_left)
            
            if pd_diff > 4.0:
                result.add_issue(
                    category=ValidationCategory.PD_VALIDATION,
                    severity=ValidationSeverity.WARNING,
                    message="左右眼瞳距差异较大",
                    detail=(
                        f"右眼瞳距({rx.pd_right}mm)与左眼瞳距({rx.pd_left}mm)"
                        f"相差 {pd_diff}mm"
                    ),
                    affected_field="单眼瞳距",
                    actual_value=f"差异 {pd_diff}mm",
                    suggested_fix="请确认单眼瞳距测量是否正确，较大差异可能影响佩戴舒适度",
                )
        
        result.metadata["pd_total"] = pd_total
        result.metadata["pd_right"] = pd_right
        result.metadata["pd_left"] = pd_left
        
        return result


class PDFrameMatchRule(BaseRule):
    """瞳距与镜框匹配规则
    
    校验瞳距与镜框几何中心距是否匹配
    """
    
    rule_id = "pd_frame_match"
    rule_name = "瞳距镜架匹配"
    rule_description = "校验瞳距与镜框几何中心距是否匹配"
    
    def execute(self, context: RuleContext) -> RuleResult:
        result = self.create_result()
        rules = context.rules
        rx = context.prescription
        frame = context.frame
        
        if frame is None:
            result.add_issue(
                category=ValidationCategory.PD_FRAME_MATCH,
                severity=ValidationSeverity.INFO,
                message="未提供镜架数据，无法进行瞳距镜架匹配校验",
                detail="建议导入镜架数据以进行更完整的校验",
            )
            return result
        
        pd_total = rx.get_pd_total()
        if pd_total is None:
            result.add_issue(
                category=ValidationCategory.PD_FRAME_MATCH,
                severity=ValidationSeverity.WARNING,
                message="缺少瞳距数据，无法进行瞳距镜架匹配校验",
                affected_field="瞳距",
                suggested_fix="请补充瞳距数据",
            )
            return result
        
        bc = frame.get_box_center_distance()
        tolerance = rules.pd_frame_tolerance
        
        pd_deviation = pd_total - bc
        abs_deviation = abs(pd_deviation)
        
        if abs_deviation > tolerance:
            direction = "大" if pd_deviation > 0 else "小"
            result.add_issue(
                category=ValidationCategory.PD_FRAME_MATCH,
                severity=ValidationSeverity.ERROR,
                message=f"瞳距与镜框不匹配（瞳距过{direction}）",
                detail=(
                    f"镜框几何中心距(BC)为 {bc}mm，总瞳距为 {pd_total}mm，"
                    f"相差 {abs_deviation}mm，超出允许范围({tolerance}mm)"
                ),
                affected_field="瞳距/镜框",
                reference_value=f"差异≤ {tolerance}mm",
                actual_value=f"差异 {abs_deviation}mm",
                suggested_fix=(
                    "建议：1) 确认瞳距测量是否正确；"
                    f"2) 检查镜框尺寸是否合适；"
                    f"3) 瞳距{direction}于BC{direction}于{pd_deviation:.1f}mm，"
                    f"需要进行移心加工，移心量为 {abs(pd_deviation)/2:.1f}mm/眼"
                ),
            )
        else:
            result.add_issue(
                category=ValidationCategory.PD_FRAME_MATCH,
                severity=ValidationSeverity.INFO,
                message="瞳距与镜框匹配良好",
                detail=(
                    f"镜框几何中心距(BC): {bc}mm，"
                    f"总瞳距: {pd_total}mm，"
                    f"差异: {abs_deviation:.1f}mm"
                ),
            )
        
        pd_right = rx.get_pd_right()
        pd_left = rx.get_pd_left()
        
        if pd_right is not None and pd_left is not None:
            half_bc = bc / 2
            
            right_deviation = half_bc - pd_right
            left_deviation = pd_left - half_bc
            
            result.metadata["right_deviation"] = right_deviation
            result.metadata["left_deviation"] = left_deviation
            result.metadata["box_center_distance"] = bc
            result.metadata["pd_total"] = pd_total
        
        if frame.lens_height:
            min_pd_for_frame = bc - 10
            max_pd_for_frame = bc + 10
            
            result.metadata["min_pd_for_frame"] = min_pd_for_frame
            result.metadata["max_pd_for_frame"] = max_pd_for_frame
        
        return result


class PHValidationRule(BaseRule):
    """瞳高校验规则
    
    校验瞳高是否在合理范围内，与镜片高度是否匹配
    """
    
    rule_id = "ph_validation"
    rule_name = "瞳高校验"
    rule_description = "校验瞳高是否在合理范围内，与镜片高度是否匹配"
    
    def execute(self, context: RuleContext) -> RuleResult:
        result = self.create_result()
        rules = context.rules
        rx = context.prescription
        frame = context.frame
        
        ph_right = rx.ph_right
        ph_left = rx.ph_left
        
        if ph_right is None and ph_left is None:
            result.add_issue(
                category=ValidationCategory.PH_VALIDATION,
                severity=ValidationSeverity.INFO,
                message="未提供瞳高数据",
                detail="单光镜片通常不需要瞳高，但渐进/双光镜片需要瞳高",
            )
            return result
        
        min_ph = rules.min_ph
        max_ph = rules.max_ph
        
        for side, ph in [("右眼", ph_right), ("左眼", ph_left)]:
            if ph is None:
                continue
            
            if ph < min_ph:
                result.add_issue(
                    category=ValidationCategory.PH_VALIDATION,
                    severity=ValidationSeverity.ERROR,
                    message=f"{side}瞳高过小",
                    detail=f"瞳高应不小于 {min_ph}mm",
                    affected_field=f"{side}瞳高",
                    reference_value=f"≥ {min_ph}mm",
                    actual_value=f"{ph}mm",
                    suggested_fix="请确认瞳高测量是否正确",
                )
            
            if ph > max_ph:
                result.add_issue(
                    category=ValidationCategory.PH_VALIDATION,
                    severity=ValidationSeverity.ERROR,
                    message=f"{side}瞳高过大",
                    detail=f"瞳高应不大于 {max_ph}mm",
                    affected_field=f"{side}瞳高",
                    reference_value=f"≤ {max_ph}mm",
                    actual_value=f"{ph}mm",
                    suggested_fix="请确认瞳高测量是否正确",
                )
        
        if frame and frame.lens_height:
            lens_height = frame.lens_height
            
            for side, ph in [("右眼", ph_right), ("左眼", ph_left)]:
                if ph is None:
                    continue
                
                if ph > lens_height:
                    result.add_issue(
                        category=ValidationCategory.PH_VALIDATION,
                        severity=ValidationSeverity.ERROR,
                        message=f"{side}瞳高大于镜片高度",
                        detail=f"瞳高({ph}mm)不能大于镜片高度({lens_height}mm)",
                        affected_field=f"{side}瞳高",
                        reference_value=f"≤ {lens_height}mm",
                        actual_value=f"{ph}mm",
                        suggested_fix="请核对瞳高和镜片高度数据",
                    )
                else:
                    ph_ratio = ph / lens_height
                    
                    if ph_ratio < 0.4:
                        result.add_issue(
                            category=ValidationCategory.PH_VALIDATION,
                            severity=ValidationSeverity.WARNING,
                            message=f"{side}瞳高偏低",
                            detail=(
                                f"瞳高({ph}mm)占镜片高度({lens_height}mm)的比例为 "
                                f"{ph_ratio*100:.0f}%，通常建议在40%-60%之间"
                            ),
                            affected_field=f"{side}瞳高",
                            suggested_fix="请确认瞳高测量点是否正确",
                        )
                    elif ph_ratio > 0.6:
                        result.add_issue(
                            category=ValidationCategory.PH_VALIDATION,
                            severity=ValidationSeverity.WARNING,
                            message=f"{side}瞳高偏高",
                            detail=(
                                f"瞳高({ph}mm)占镜片高度({lens_height}mm)的比例为 "
                                f"{ph_ratio*100:.0f}%，通常建议在40%-60%之间"
                            ),
                            affected_field=f"{side}瞳高",
                            suggested_fix="请确认瞳高测量点是否正确",
                        )
        
        if ph_right is not None and ph_left is not None:
            ph_diff = abs(ph_right - ph_left)
            
            if ph_diff > 2.0:
                result.add_issue(
                    category=ValidationCategory.PH_VALIDATION,
                    severity=ValidationSeverity.WARNING,
                    message="左右眼瞳高差异较大",
                    detail=(
                        f"右眼瞳高({ph_right}mm)与左眼瞳高({ph_left}mm)相差 {ph_diff}mm"
                    ),
                    affected_field="瞳高",
                    actual_value=f"差异 {ph_diff}mm",
                    suggested_fix="请确认瞳高测量是否正确",
                )
        
        result.metadata["ph_right"] = ph_right
        result.metadata["ph_left"] = ph_left
        
        return result
