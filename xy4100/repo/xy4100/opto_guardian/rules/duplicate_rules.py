"""重复订单检测规则"""

from datetime import datetime, timedelta
from typing import Optional

from ..models.validation import ValidationCategory, ValidationSeverity
from .base import BaseRule, RuleContext, RuleResult


class DuplicateOrderRule(BaseRule):
    """重复订单检测规则
    
    检测是否存在重复订单
    """
    
    rule_id = "duplicate_order"
    rule_name = "重复订单检测"
    rule_description = "检测是否存在重复订单"
    
    def execute(self, context: RuleContext) -> RuleResult:
        result = self.create_result()
        rx = context.prescription
        existing_orders = context.existing_orders
        rules = context.rules
        
        if not existing_orders:
            result.add_issue(
                category=ValidationCategory.DUPLICATE_ORDER,
                severity=ValidationSeverity.INFO,
                message="无历史订单数据，无法检测重复订单",
            )
            return result
        
        duplicate_candidates = self._find_duplicates(
            current_rx=rx,
            existing_orders=existing_orders,
            time_window_hours=rules.duplicate_order_hours,
        )
        
        if duplicate_candidates:
            for dup in duplicate_candidates:
                result.add_issue(
                    category=ValidationCategory.DUPLICATE_ORDER,
                    severity=ValidationSeverity.WARNING,
                    message=f"检测到潜在重复订单: {dup['order_id']}",
                    detail=(
                        f"与订单 {dup['order_id']} 高度相似。"
                        f"时间差异: {dup['time_diff_hours']:.1f}小时，"
                        f"相似度: {dup['similarity']*100:.0f}%"
                    ),
                    affected_field="订单",
                    reference_value=dup['order_id'],
                    actual_value=rx.prescription_id,
                    suggested_fix=(
                        "请确认是否为重复录入。"
                        "如确为重复订单，请删除其中一个；"
                        "如为不同患者但度数相似，请忽略此警告。"
                    ),
                )
            
            result.metadata["duplicate_count"] = len(duplicate_candidates)
            result.metadata["duplicates"] = duplicate_candidates
        else:
            result.add_issue(
                category=ValidationCategory.DUPLICATE_ORDER,
                severity=ValidationSeverity.INFO,
                message="未检测到重复订单",
                detail=f"在最近 {rules.duplicate_order_hours} 小时内无相似订单",
            )
        
        return result
    
    def _find_duplicates(
        self,
        current_rx,
        existing_orders: list[dict],
        time_window_hours: int = 24,
    ) -> list[dict]:
        """查找重复订单候选
        
        检测依据：
        1. 时间窗口内的订单
        2. 度数高度相似
        3. 患者姓名相似（可选）
        """
        duplicates = []
        now = datetime.now()
        time_cutoff = now - timedelta(hours=time_window_hours)
        
        for order in existing_orders:
            order_time = order.get("created_at")
            if order_time:
                if isinstance(order_time, str):
                    try:
                        order_time = datetime.fromisoformat(order_time)
                    except ValueError:
                        order_time = now
                if order_time < time_cutoff:
                    continue
            
            similarity = self._calculate_similarity(current_rx, order)
            
            if similarity >= 0.9:
                time_diff = (now - order_time).total_seconds() / 3600 if order_time else 0
                
                duplicates.append({
                    "order_id": order.get("order_id", "unknown"),
                    "patient_name": order.get("patient_name"),
                    "similarity": similarity,
                    "time_diff_hours": time_diff,
                    "order_data": order,
                })
        
        duplicates.sort(key=lambda x: x["similarity"], reverse=True)
        return duplicates
    
    def _calculate_similarity(self, current_rx, order: dict) -> float:
        """计算订单相似度"""
        score = 1.0
        total_weights = 0
        
        prescription_data = order.get("prescription", {})
        
        re_data = prescription_data.get("right_eye", {})
        le_data = prescription_data.get("left_eye", {})
        
        sphere_weight = 0.3
        cylinder_weight = 0.3
        axis_weight = 0.2
        pd_weight = 0.2
        
        re_sphere_current = current_rx.right_eye.sphere
        re_sphere_order = re_data.get("sphere", 0)
        if abs(re_sphere_current - re_sphere_order) > 0.25:
            score -= sphere_weight * 0.5
        if abs(re_sphere_current - re_sphere_order) > 0.5:
            score -= sphere_weight * 0.5
        total_weights += sphere_weight
        
        le_sphere_current = current_rx.left_eye.sphere
        le_sphere_order = le_data.get("sphere", 0)
        if abs(le_sphere_current - le_sphere_order) > 0.25:
            score -= sphere_weight * 0.5
        if abs(le_sphere_current - le_sphere_order) > 0.5:
            score -= sphere_weight * 0.5
        total_weights += sphere_weight
        
        re_cyl_current = current_rx.right_eye.cylinder
        re_cyl_order = re_data.get("cylinder", 0)
        if abs(re_cyl_current - re_cyl_order) > 0.25:
            score -= cylinder_weight * 0.5
        if abs(re_cyl_current - re_cyl_order) > 0.5:
            score -= cylinder_weight * 0.5
        total_weights += cylinder_weight
        
        le_cyl_current = current_rx.left_eye.cylinder
        le_cyl_order = le_data.get("cylinder", 0)
        if abs(le_cyl_current - le_cyl_order) > 0.25:
            score -= cylinder_weight * 0.5
        if abs(le_cyl_current - le_cyl_order) > 0.5:
            score -= cylinder_weight * 0.5
        total_weights += cylinder_weight
        
        re_axis_current = current_rx.right_eye.axis
        re_axis_order = re_data.get("axis")
        if re_axis_current is not None and re_axis_order is not None:
            axis_diff = abs(re_axis_current - re_axis_order)
            if axis_diff > 90:
                axis_diff = 180 - axis_diff
            if axis_diff > 5:
                score -= axis_weight * 0.3
            if axis_diff > 15:
                score -= axis_weight * 0.7
        total_weights += axis_weight
        
        le_axis_current = current_rx.left_eye.axis
        le_axis_order = le_data.get("axis")
        if le_axis_current is not None and le_axis_order is not None:
            axis_diff = abs(le_axis_current - le_axis_order)
            if axis_diff > 90:
                axis_diff = 180 - axis_diff
            if axis_diff > 5:
                score -= axis_weight * 0.3
            if axis_diff > 15:
                score -= axis_weight * 0.7
        total_weights += axis_weight
        
        pd_current = current_rx.get_pd_total()
        pd_order = prescription_data.get("pd_total")
        if pd_current is not None and pd_order is not None:
            if abs(pd_current - pd_order) > 1:
                score -= pd_weight * 0.3
            if abs(pd_current - pd_order) > 2:
                score -= pd_weight * 0.7
        total_weights += pd_weight
        
        current_name = current_rx.patient_name
        order_name = order.get("patient_name")
        if current_name and order_name:
            if current_name.strip().lower() == order_name.strip().lower():
                score = min(1.0, score + 0.1)
        
        return max(0.0, min(1.0, score))
