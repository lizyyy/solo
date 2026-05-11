from typing import List, Dict
from models import (
    VerificationResult,
    VerificationIssue,
    VerificationStatus,
    ProcessSummary,
    FailureReason
)


class ReportGenerator:
    @staticmethod
    def generate_summary(
        orders: List,
        results: List[VerificationResult],
        data_loading_issues: List[VerificationIssue]
    ) -> ProcessSummary:
        total_records = len(orders)
        processed_records = 0
        passed_records = 0
        failed_records = 0
        manual_check_needed = 0
        
        all_issues = list(data_loading_issues)
        
        for result in results:
            if result.status == VerificationStatus.PASS:
                processed_records += 1
                passed_records += 1
            elif result.status == VerificationStatus.NEED_MANUAL_CHECK:
                processed_records += 1
                manual_check_needed += 1
                all_issues.extend(result.issues)
            elif result.status == VerificationStatus.FAIL:
                processed_records += 1
                failed_records += 1
                all_issues.extend(result.issues)
        
        skipped_records = 0
        
        return ProcessSummary(
            total_records=total_records,
            processed_records=processed_records,
            skipped_records=skipped_records,
            passed_records=passed_records,
            failed_records=failed_records,
            manual_check_needed=manual_check_needed,
            issues=all_issues
        )
    
    @staticmethod
    def generate_text_report(
        summary: ProcessSummary,
        results: List[VerificationResult],
        orders: List
    ) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("社区团餐过敏源核验器 - 核验报告")
        lines.append("=" * 80)
        lines.append("")
        
        lines.append("一、处理统计概览")
        lines.append("-" * 40)
        lines.append(f"  总记录数:           {summary.total_records}")
        lines.append(f"  已处理记录数:       {summary.processed_records}")
        lines.append(f"  跳过记录数:         {summary.skipped_records}")
        lines.append(f"  通过核验记录数:     {summary.passed_records}")
        lines.append(f"  核验失败记录数:     {summary.failed_records}")
        lines.append(f"  需要人工确认记录数: {summary.manual_check_needed}")
        lines.append("")
        
        lines.append("二、问题分类统计")
        lines.append("-" * 40)
        
        issue_counts = {}
        for issue in summary.issues:
            reason = issue.reason.value
            if reason not in issue_counts:
                issue_counts[reason] = 0
            issue_counts[reason] += 1
        
        for reason, count in issue_counts.items():
            lines.append(f"  {reason}: {count} 条")
        
        lines.append("")
        
        if summary.issues:
            lines.append("三、详细问题列表")
            lines.append("-" * 40)
            
            for i, issue in enumerate(summary.issues, 1):
                lines.append(f"")
                lines.append(f"  问题 #{i}")
                lines.append(f"    订单ID:     {issue.order_id}")
                lines.append(f"    老人:       {issue.elderly_name}")
                lines.append(f"    菜品:       {issue.dish_name}")
                lines.append(f"    问题类型:   {issue.reason.value}")
                lines.append(f"    详细原因:   {issue.details}")
                if issue.source_file:
                    lines.append(f"    数据来源:   {issue.source_file}")
                if issue.source_line:
                    lines.append(f"    来源行号:   {issue.source_line}")
        else:
            lines.append("三、详细问题列表")
            lines.append("-" * 40)
            lines.append("  暂无问题")
        lines.append("")
        
        substitution_count = sum(len(r.substituted_dishes) for r in results)
        if substitution_count > 0:
            lines.append("四、替换餐建议")
            lines.append("-" * 40)
            
            for result in results:
                for substitution in result.substituted_dishes:
                    order_id, elderly_name, original_dish, substitute_dish, rule_id = substitution
                    lines.append(f"  订单 {order_id} ({elderly_name}):")
                    lines.append(f"    原菜品:   {original_dish}")
                    lines.append(f"    替换为:   {substitute_dish}")
                    lines.append(f"    规则ID:   {rule_id}")
                    lines.append(f"")
        
        lines.append("")
        lines.append("五、逐订单核验详情")
        lines.append("-" * 40)
        
        for order, result in zip(orders, results):
            status_text = {
                VerificationStatus.PASS: "✅ 通过",
                VerificationStatus.FAIL: "❌ 失败",
                VerificationStatus.NEED_MANUAL_CHECK: "⚠️  需要人工确认"
            }.get(result.status, "未知")
            
            lines.append("")
            lines.append(f"  订单 {order.id}: {status_text}")
            lines.append(f"    老人ID:   {order.elderly_id}")
            lines.append(f"    配送日期: {order.delivery_date}")
            lines.append(f"    餐次:     {order.meal_type}")
            lines.append(f"    菜品:     {order.dish_ids}")
        
        lines.append("")
        lines.append("=" * 80)
        lines.append("核验结束")
        lines.append("=" * 80)
        
        return "\n".join(lines)
    
    @staticmethod
    def generate_json_report(
        summary: ProcessSummary,
        results: List[VerificationResult],
        orders: List
    ) -> dict:
        return {
            "summary": {
                "total_records": summary.total_records,
                "processed_records": summary.processed_records,
                "skipped_records": summary.skipped_records,
                "passed_records": summary.passed_records,
                "failed_records": summary.failed_records,
                "manual_check_needed": summary.manual_check_needed,
                "issue_summary": {
                    reason.value: sum(1 for i in summary.issues if i.reason.value == reason.value)
                    for reason in set(i.reason for i in summary.issues)
                }
            },
            "issues": [
                {
                    "order_id": issue.order_id,
                    "elderly_name": issue.elderly_name,
                    "dish_name": issue.dish_name,
                    "reason": issue.reason.value,
                    "details": issue.details,
                    "source_file": issue.source_file,
                    "source_line": issue.source_line
                }
                for issue in summary.issues
            ],
            "substitutions": [
                {
                    "order_id": sub[0],
                    "elderly_name": sub[1],
                    "original_dish": sub[2],
                    "substitute_dish": sub[3],
                    "rule_id": sub[4]
                }
                for result in results
                for sub in result.substituted_dishes
            ],
            "order_details": [
                {
                    "order_id": order.id,
                    "elderly_id": order.elderly_id,
                    "delivery_date": order.delivery_date,
                    "meal_type": order.meal_type,
                    "dish_ids": order.dish_ids,
                    "status": result.status.value,
                    "issues_count": len(result.issues),
                    "substitutions_count": len(result.substituted_dishes)
                }
                for order, result in zip(orders, results)
            ]
        }
