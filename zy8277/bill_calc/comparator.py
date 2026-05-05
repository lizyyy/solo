# -*- coding: utf-8 -*-
from decimal import Decimal
from typing import List, Dict, Any, Optional
from .models import (
    CalculationResult, ComparisonResult, Bill, BillLineItem
)


class ResultComparator:
    """结果比较器，用于比较预期结果和实际结果"""
    
    @staticmethod
    def compare_results(
        expected: CalculationResult,
        actual: CalculationResult
    ) -> ComparisonResult:
        """
        比较两个计算结果
        
        Args:
            expected: 预期结果
            actual: 实际结果
        
        Returns:
            比较结果
        """
        differences = []
        
        # 比较账单基本信息
        if expected.bill.id != actual.bill.id:
            differences.append({
                "type": "bill_info",
                "field": "id",
                "expected": expected.bill.id,
                "actual": actual.bill.id,
                "description": "账单ID不一致"
            })
        
        if expected.bill.order_id != actual.bill.order_id:
            differences.append({
                "type": "bill_info",
                "field": "order_id",
                "expected": expected.bill.order_id,
                "actual": actual.bill.order_id,
                "description": "订单ID不一致"
            })
        
        # 比较整单汇总
        summary_fields = [
            ("total_subtotal", "总小计"),
            ("total_discount", "总折扣"),
            ("total_tax", "总税费"),
            ("total_service_fee", "总服务费"),
            ("grand_total", "最终总额")
        ]
        
        for field_name, field_desc in summary_fields:
            expected_value = getattr(expected.bill, field_name)
            actual_value = getattr(actual.bill, field_name)
            
            if expected_value != actual_value:
                difference = abs(expected_value - actual_value)
                
                differences.append({
                    "type": "summary",
                    "field": field_name,
                    "field_description": field_desc,
                    "expected": expected_value,
                    "actual": actual_value,
                    "difference": difference,
                    "description": f"{field_desc}不一致"
                })
        
        # 比较行项目
        expected_lines = {line.id: line for line in expected.bill.lines}
        actual_lines = {line.id: line for line in actual.bill.lines}
        
        # 检查缺失或多余的行
        expected_line_ids = set(expected_lines.keys())
        actual_line_ids = set(actual_lines.keys())
        
        for line_id in expected_line_ids - actual_line_ids:
            differences.append({
                "type": "line_missing",
                "line_id": line_id,
                "description": f"实际结果中缺少行项目: {line_id}"
            })
        
        for line_id in actual_line_ids - expected_line_ids:
            differences.append({
                "type": "line_extra",
                "line_id": line_id,
                "description": f"实际结果中多出意外行项目: {line_id}"
            })
        
        # 比较共同行项目的详细信息
        line_fields = [
            ("subtotal", "小计"),
            ("discount_amount", "折扣金额"),
            ("tax_amount", "税费金额"),
            ("service_fee_amount", "服务费金额"),
            ("line_total", "行总额")
        ]
        
        for line_id in expected_line_ids & actual_line_ids:
            expected_line = expected_lines[line_id]
            actual_line = actual_lines[line_id]
            
            for field_name, field_desc in line_fields:
                expected_value = getattr(expected_line, field_name)
                actual_value = getattr(actual_line, field_name)
                
                if expected_value != actual_value:
                    difference = abs(expected_value - actual_value)
                    
                    differences.append({
                        "type": "line_detail",
                        "line_id": line_id,
                        "line_name": expected_line.name,
                        "field": field_name,
                        "field_description": field_desc,
                        "expected": expected_value,
                        "actual": actual_value,
                        "difference": difference,
                        "description": f"行 {line_id}({expected_line.name}) 的 {field_desc} 不一致"
                    })
        
        # 比较验证错误
        expected_errors = set(expected.validation_errors)
        actual_errors = set(actual.validation_errors)
        
        for error in expected_errors - actual_errors:
            differences.append({
                "type": "error_missing",
                "expected_error": error,
                "description": f"预期的验证错误未出现: {error}"
            })
        
        for error in actual_errors - expected_errors:
            differences.append({
                "type": "error_extra",
                "actual_error": error,
                "description": f"出现意外的验证错误: {error}"
            })
        
        # 构建比较结果
        has_differences = len(differences) > 0
        
        result = ComparisonResult(
            bill_id=expected.bill.id,
            order_id=expected.bill.order_id,
            expected=expected,
            actual=actual,
            differences=differences,
            has_differences=has_differences
        )
        
        return result
    
    @staticmethod
    def compare_multiple_results(
        expected_results: List[CalculationResult],
        actual_results: List[CalculationResult]
    ) -> List[ComparisonResult]:
        """
        比较多个计算结果
        
        Args:
            expected_results: 预期结果列表
            actual_results: 实际结果列表
        
        Returns:
            比较结果列表
        """
        # 按账单ID分组
        expected_by_id = {r.bill.id: r for r in expected_results}
        actual_by_id = {r.bill.id: r for r in actual_results}
        
        comparison_results = []
        
        # 比较共同的账单
        common_ids = set(expected_by_id.keys()) & set(actual_by_id.keys())
        for bill_id in common_ids:
            comparison = ResultComparator.compare_results(
                expected_by_id[bill_id],
                actual_by_id[bill_id]
            )
            comparison_results.append(comparison)
        
        # 检查缺失的账单
        missing_ids = set(expected_by_id.keys()) - set(actual_by_id.keys())
        for bill_id in missing_ids:
            comparison_results.append(ComparisonResult(
                bill_id=bill_id,
                order_id=expected_by_id[bill_id].bill.order_id,
                expected=expected_by_id[bill_id],
                actual=None,
                differences=[{
                    "type": "bill_missing",
                    "description": f"实际结果中缺少账单: {bill_id}"
                }],
                has_differences=True
            ))
        
        # 检查多余的账单
        extra_ids = set(actual_by_id.keys()) - set(expected_by_id.keys())
        for bill_id in extra_ids:
            comparison_results.append(ComparisonResult(
                bill_id=bill_id,
                order_id=actual_by_id[bill_id].bill.order_id,
                expected=None,
                actual=actual_by_id[bill_id],
                differences=[{
                    "type": "bill_extra",
                    "description": f"实际结果中多出意外账单: {bill_id}"
                }],
                has_differences=True
            ))
        
        return comparison_results
    
    @staticmethod
    def get_summary_statistics(
        comparison_results: List[ComparisonResult]
    ) -> Dict[str, Any]:
        """
        获取比较结果的统计信息
        
        Args:
            comparison_results: 比较结果列表
        
        Returns:
            统计信息字典
        """
        total = len(comparison_results)
        passed = sum(1 for r in comparison_results if not r.has_differences)
        failed = total - passed
        
        # 统计差异类型
        difference_types = {}
        for result in comparison_results:
            for diff in result.differences:
                diff_type = diff.get("type", "unknown")
                if diff_type not in difference_types:
                    difference_types[diff_type] = 0
                difference_types[diff_type] += 1
        
        # 统计一分钱差异
        penny_differences = 0
        for result in comparison_results:
            for diff in result.differences:
                if "difference" in diff:
                    diff_value = diff["difference"]
                    if diff_value == Decimal("0.01"):
                        penny_differences += 1
        
        return {
            "total_bills": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": f"{(passed / total * 100) if total > 0 else 0:.2f}%",
            "difference_types": difference_types,
            "penny_differences": penny_differences
        }
