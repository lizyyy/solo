"""差异检测和问题识别模块"""

from decimal import Decimal, ROUND_HALF_UP, ROUND_DOWN
from typing import Dict, List, Optional, Tuple

from .models import (
    AuditContext,
    CalculatedMetric,
    Issue,
    IssueType,
    MetricRule,
    ReportMetric,
    ValidationResult,
)


class MetricValidator:
    """指标验证器"""
    
    CRITICAL_ISSUE_TYPES = {
        IssueType.TOLERANCE_EXCEEDED,
        IssueType.MISSING_REFUND_DEDUCTION,
        IssueType.STORE_AGGREGATION_ERROR,
    }
    
    WARNING_ISSUE_TYPES = {
        IssueType.ROUNDING_INCONSISTENCY,
        IssueType.MISSING_METRIC,
        IssueType.EXTRA_METRIC,
    }
    
    def __init__(self, context: AuditContext):
        self.context = context
    
    def validate(
        self, 
        calculated_metrics: List[CalculatedMetric],
        report_metrics: List[ReportMetric],
        report_store_metrics: Optional[Dict[str, Dict[str, ReportMetric]]] = None
    ) -> ValidationResult:
        """执行验证"""
        issues: List[Issue] = []
        
        calculated_dict = {m.metric_name: m for m in calculated_metrics}
        report_dict = {m.metric_name: m for m in report_metrics}
        
        all_metric_names = set(calculated_dict.keys()) | set(report_dict.keys())
        
        for metric_name in all_metric_names:
            calculated = calculated_dict.get(metric_name)
            reported = report_dict.get(metric_name)
            rule = self.context.metric_rules.get(metric_name)
            
            if calculated is None:
                if reported is not None:
                    issues.append(Issue(
                        issue_type=IssueType.EXTRA_METRIC,
                        metric_name=metric_name,
                        message=f"报告中包含额外的指标：{reported.display_name} = {reported.value}",
                        reported_value=reported.value,
                        context=f"行号: {reported.line_number}" if reported.line_number else None,
                    ))
                continue
            
            if reported is None:
                issues.append(Issue(
                    issue_type=IssueType.MISSING_METRIC,
                    metric_name=metric_name,
                    message=f"报告中缺失指标：{calculated.display_name}，正确值应为 {calculated.value}",
                    expected_value=calculated.value,
                ))
                continue
            
            tolerance = rule.tolerance if rule else 0.01
            
            value_issues = self._compare_values(
                calculated, reported, tolerance, rule
            )
            issues.extend(value_issues)
        
        if self.context.refunds:
            gmv_calc = calculated_dict.get('gmv')
            net_sales_calc = calculated_dict.get('net_sales')
            gmv_reported = report_dict.get('gmv')
            net_sales_reported = report_dict.get('net_sales')
            
            if gmv_reported and net_sales_reported:
                if abs(net_sales_reported.value - gmv_reported.value) < Decimal('0.01'):
                    issues.append(Issue(
                        issue_type=IssueType.MISSING_REFUND_DEDUCTION,
                        metric_name='net_sales',
                        message="净销售额可能漏扣退款，报告中的净销售额与GMV几乎相同",
                        expected_value=net_sales_calc.value if net_sales_calc else None,
                        reported_value=net_sales_reported.value,
                        context=f"报告GMV: {gmv_reported.value}, 报告净销售额: {net_sales_reported.value}, 正确净销售额: {net_sales_calc.value if net_sales_calc else 'N/A'}",
                    ))
        
        if report_store_metrics:
            store_issues = self._validate_store_aggregation(
                calculated_dict, report_store_metrics
            )
            issues.extend(store_issues)
        
        critical_count = sum(1 for i in issues if i.issue_type in self.CRITICAL_ISSUE_TYPES)
        warning_count = sum(1 for i in issues if i.issue_type in self.WARNING_ISSUE_TYPES)
        
        return ValidationResult(
            is_valid=critical_count == 0,
            total_issues=len(issues),
            critical_issues=critical_count,
            warning_issues=warning_count,
            issues=issues,
            calculated_metrics=calculated_metrics,
            report_metrics=report_metrics,
        )
    
    def _compare_values(
        self,
        calculated: CalculatedMetric,
        reported: ReportMetric,
        tolerance: float,
        rule: Optional[MetricRule]
    ) -> List[Issue]:
        """比较计算值和报告值"""
        issues: List[Issue] = []
        
        calc_value = calculated.value
        report_value = reported.value
        
        if calc_value == 0:
            relative_diff = 0 if report_value == 0 else 1
        else:
            relative_diff = float(abs(report_value - calc_value) / abs(calc_value))
        
        if relative_diff > tolerance:
            difference = abs(report_value - calc_value)
            issues.append(Issue(
                issue_type=IssueType.TOLERANCE_EXCEEDED,
                metric_name=calculated.metric_name,
                message=f"{calculated.display_name} 容差超出：计算值 {calc_value}，报告值 {report_value}，差异 {difference} ({relative_diff*100:.2f}%)",
                expected_value=calc_value,
                reported_value=report_value,
                difference=difference,
                context=f"容差阈值: {tolerance*100}%",
            ))
        
        if rule:
            rounding_issues = self._check_rounding_inconsistency(
                calculated, reported, rule
            )
            issues.extend(rounding_issues)
        
        return issues
    
    def _check_rounding_inconsistency(
        self,
        calculated: CalculatedMetric,
        reported: ReportMetric,
        rule: MetricRule
    ) -> List[Issue]:
        """检查四舍五入不一致
        
        只有当数值接近时才标记为四舍五入问题。
        如果数值差异很大，应该由容差超出来处理。
        """
        issues: List[Issue] = []
        
        decimal_places = rule.decimal_places
        
        max_rounding_diff = Decimal('1') / (Decimal('10') ** decimal_places) * Decimal('2')
        
        if abs(reported.value - calculated.value) > max_rounding_diff:
            return issues
        
        quantize_str = '1.' + '0' * decimal_places
        
        rounded_half_up = calculated.value.quantize(
            Decimal(quantize_str), rounding=ROUND_HALF_UP
        )
        rounded_down = calculated.value.quantize(
            Decimal(quantize_str), rounding=ROUND_DOWN
        )
        
        if reported.value != rounded_half_up:
            if reported.value == rounded_down:
                issues.append(Issue(
                    issue_type=IssueType.ROUNDING_INCONSISTENCY,
                    metric_name=calculated.metric_name,
                    message=f"{calculated.display_name} 四舍五入方式不一致：应使用 ROUND_HALF_UP，实际使用了 ROUND_DOWN",
                    expected_value=rounded_half_up,
                    reported_value=reported.value,
                    context=f"正确四舍五入值: {rounded_half_up}, 报告值: {reported.value}",
                ))
            elif abs(reported.value - rounded_half_up) > 0:
                issues.append(Issue(
                    issue_type=IssueType.ROUNDING_INCONSISTENCY,
                    metric_name=calculated.metric_name,
                    message=f"{calculated.display_name} 四舍五入结果不一致",
                    expected_value=rounded_half_up,
                    reported_value=reported.value,
                    context=f"正确四舍五入值: {rounded_half_up}, 报告值: {reported.value}",
                ))
        
        return issues
    
    def _validate_store_aggregation(
        self,
        calculated_dict: Dict[str, CalculatedMetric],
        report_store_metrics: Dict[str, Dict[str, ReportMetric]]
    ) -> List[Issue]:
        """验证门店汇总是否正确"""
        issues: List[Issue] = []
        
        SUM_AGGREGATION_METRICS = {
            'gmv',
            'net_sales',
            'total_orders',
            'total_refunds',
            'total_labor_cost',
        }
        
        for metric_name, calculated in calculated_dict.items():
            if not calculated.store_breakdown:
                continue
            
            report_store_values = {}
            for store_id, store_metrics in report_store_metrics.items():
                if metric_name in store_metrics:
                    report_store_values[store_id] = store_metrics[metric_name].value
            
            if not report_store_values:
                continue
            
            for store_id, calc_value in calculated.store_breakdown.items():
                report_value = report_store_values.get(store_id)
                if report_value is None:
                    continue
                
                rule = self.context.metric_rules.get(metric_name)
                tolerance = rule.tolerance if rule else 0.01
                
                if calc_value == 0:
                    relative_diff = 0 if report_value == 0 else 1
                else:
                    relative_diff = float(abs(report_value - calc_value) / abs(calc_value))
                
                if relative_diff > tolerance:
                    difference = abs(report_value - calc_value)
                    issues.append(Issue(
                        issue_type=IssueType.TOLERANCE_EXCEEDED,
                        metric_name=metric_name,
                        message=f"门店 {store_id} 的 {calculated.display_name} 容差超出：计算值 {calc_value}，报告值 {report_value}",
                        expected_value=calc_value,
                        reported_value=report_value,
                        difference=difference,
                        store_id=store_id,
                    ))
            
            all_report_stores = set(report_store_values.keys())
            all_calc_stores = set(calculated.store_breakdown.keys())
            
            for store_id in all_report_stores - all_calc_stores:
                issues.append(Issue(
                    issue_type=IssueType.STORE_AGGREGATION_ERROR,
                    metric_name=metric_name,
                    message=f"报告中包含不存在的门店数据：门店 {store_id} 的 {calculated.display_name}",
                    store_id=store_id,
                ))
            
            if metric_name in SUM_AGGREGATION_METRICS:
                reported_sum = sum(report_store_values.values())
                expected_sum = calculated.value
                
                if abs(reported_sum - expected_sum) > Decimal('0.01'):
                    issues.append(Issue(
                        issue_type=IssueType.STORE_AGGREGATION_ERROR,
                        metric_name=metric_name,
                        message=f"{calculated.display_name} 门店汇总方向可能错误：门店值之和 {reported_sum} 与汇总值 {expected_sum} 不一致",
                        expected_value=expected_sum,
                        reported_value=reported_sum,
                        context=f"门店值之和: {reported_sum}, 正确汇总值: {expected_sum}",
                    ))
        
        return issues
