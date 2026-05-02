"""命令行展示模块"""

from typing import List, Dict, Any
from datetime import datetime

from engine.rules_engine import RuleResult, Issue, Suggestion, IssueSeverity, IssueType


class CLICommand:
    """命令行交互类"""
    
    SEVERITY_COLORS = {
        IssueSeverity.CRITICAL: "\033[91m",  # 红色
        IssueSeverity.WARNING: "\033[93m",   # 黄色
        IssueSeverity.INFO: "\033[94m",       # 蓝色
    }
    
    SEVERITY_LABELS = {
        IssueSeverity.CRITICAL: "严重",
        IssueSeverity.WARNING: "警告",
        IssueSeverity.INFO: "提示",
    }
    
    ACTION_COLORS = {
        "approve": "\033[92m",   # 绿色
        "reject": "\033[91m",    # 红色
        "review": "\033[93m",    # 黄色
    }
    
    ACTION_LABELS = {
        "approve": "批准",
        "reject": "拒绝",
        "review": "审核",
    }
    
    def display_results(self, results: List[RuleResult], verbose: bool = False):
        """显示处理结果"""
        if not results:
            print("没有订单需要处理")
            return
        
        # 统计信息
        total = len(results)
        can_approve = sum(1 for r in results if r.can_approve)
        needs_review = sum(1 for r in results if r.requires_review)
        rejected = sum(1 for r in results if not r.can_approve)
        
        total_issues = sum(len(r.issues) for r in results)
        critical_issues = sum(
            1 for r in results 
            for i in r.issues 
            if i.severity == IssueSeverity.CRITICAL
        )
        warning_issues = sum(
            1 for r in results 
            for i in r.issues 
            if i.severity == IssueSeverity.WARNING
        )
        
        # 显示统计
        self._display_statistics(
            total, can_approve, needs_review, rejected,
            total_issues, critical_issues, warning_issues
        )
        
        # 显示每个订单的详细信息
        if verbose:
            print("\n" + "=" * 60)
            print("订单详情")
            print("=" * 60)
            
            for result in results:
                self._display_order_detail(result)
    
    def _display_statistics(
        self,
        total: int,
        can_approve: int,
        needs_review: int,
        rejected: int,
        total_issues: int,
        critical_issues: int,
        warning_issues: int
    ):
        """显示统计信息"""
        print("\n" + "=" * 60)
        print("处理结果统计")
        print("=" * 60)
        
        print(f"\n订单总数: {total}")
        print(f"  可批准: {can_approve}")
        print(f"  需审核: {needs_review}")
        print(f"  建议拒绝: {rejected}")
        
        if total_issues > 0:
            print(f"\n问题总数: {total_issues}")
            if critical_issues > 0:
                print(f"  \033[91m严重问题: {critical_issues}\033[0m")
            if warning_issues > 0:
                print(f"  \033[93m警告: {warning_issues}\033[0m")
            info_issues = total_issues - critical_issues - warning_issues
            if info_issues > 0:
                print(f"  \033[94m提示: {info_issues}\033[0m")
        
        print("\n" + "-" * 60)
    
    def _display_order_detail(self, result: RuleResult):
        """显示订单详情"""
        order = result.order
        
        print(f"\n--- 订单 {order.order_id} ---")
        print(f"  操作类型: {'退票' if order.is_refund() else '换座'}")
        print(f"  演出时间: {order.show_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"  申请时间: {order.request_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"  票价: ¥{order.ticket_price:.2f}")
        
        if order.original_seats:
            seats_str = ", ".join(str(s) for s in order.original_seats)
            print(f"  原座位: {seats_str}")
        
        if order.new_seats:
            seats_str = ", ".join(str(s) for s in order.new_seats)
            print(f"  新座位: {seats_str}")
        
        # 处理状态
        status_color = self.ACTION_COLORS.get("approve", "")
        if not result.can_approve:
            status_color = self.ACTION_COLORS.get("reject", "")
        elif result.requires_review:
            status_color = self.ACTION_COLORS.get("review", "")
        
        status = "建议批准" if result.can_approve else "建议拒绝"
        if result.requires_review and result.can_approve:
            status = "需人工审核"
        
        print(f"\n  处理建议: {status_color}{status}\033[0m")
        
        # 显示问题
        if result.issues:
            print(f"\n  检测到的问题:")
            for issue in result.issues:
                color = self.SEVERITY_COLORS.get(issue.severity, "")
                severity_label = self.SEVERITY_LABELS.get(issue.severity, issue.severity.value)
                print(f"    {color}[{severity_label}] {issue.message}\033[0m")
        
        # 显示价格调整
        if result.price_adjustment:
            pa = result.price_adjustment
            print(f"\n  价格调整:")
            if pa["type"] == "refund":
                print(f"    原票价: ¥{pa['original_price']:.2f}")
                print(f"    手续费: ¥{pa['fee_amount']:.2f} ({pa['fee_rate']*100:.0f}%)")
                print(f"    退款金额: ¥{pa['refund_amount']:.2f}")
            else:
                print(f"    原总价: ¥{pa['original_price']:.2f}")
                print(f"    新总价: ¥{pa['new_price']:.2f}")
                print(f"    差价: {'+' if pa['is_upgrade'] else ''}¥{pa['price_difference']:.2f}")
                if pa.get('customer_pays', 0) > 0:
                    print(f"    客户需补: ¥{pa['customer_pays']:.2f}")
                if pa.get('refund_to_customer', 0) > 0:
                    print(f"    需退客户: ¥{pa['refund_to_customer']:.2f}")
        
        # 显示建议
        if result.suggestions:
            print(f"\n  详细建议:")
            for idx, suggestion in enumerate(result.suggestions, 1):
                action_color = self.ACTION_COLORS.get(suggestion.action, "")
                action_label = self.ACTION_LABELS.get(suggestion.action, suggestion.action)
                print(f"    {idx}. {action_color}[{action_label}]\033[0m {suggestion.message}")
                if suggestion.required_actions:
                    print(f"       操作步骤:")
                    for step in suggestion.required_actions:
                        print(f"        - {step}")
        
        print()
    
    def display_validation_errors(self, errors: List[Any]):
        """显示验证错误"""
        if not errors:
            return
        
        print("\n数据验证问题:")
        for error in errors:
            severity = getattr(error, 'severity', 'error')
            msg = getattr(error, 'message', str(error))
            
            if severity == 'error':
                print(f"  \033[91m[错误] {msg}\033[0m")
            else:
                print(f"  \033[93m[警告] {msg}\033[0m")
