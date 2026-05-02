"""报告生成器"""

from typing import List, Dict, Any
from datetime import datetime

from engine.rules_engine import RuleResult, Issue, Suggestion, IssueSeverity, IssueType
from storage.store import DataStore


class MarkdownReporter:
    """Markdown 报告生成器"""
    
    ISSUE_TYPE_NAMES = {
        IssueType.CONSECUTIVE_SEATS_BROKEN: "连座被拆",
        IssueType.ACCESSIBLE_SEAT_MISUSE: "无障碍座误换",
        IssueType.CROSS_CATEGORY_EXCHANGE: "跨票档换座",
        IssueType.CROSS_SECTION_EXCHANGE: "跨区域换座",
        IssueType.TOO_LATE_TO_REFUND: "临开演禁退",
        IssueType.REFUND_NOT_ALLOWED: "票档禁退",
        IssueType.DUPLICATE_ORDER: "重复订单号",
        IssueType.PRICE_DIFFERENCE: "价格差异",
        IssueType.SEAT_NOT_AVAILABLE: "座位不可用",
    }
    
    SEVERITY_NAMES = {
        IssueSeverity.CRITICAL: "严重",
        IssueSeverity.WARNING: "警告",
        IssueSeverity.INFO: "提示",
    }
    
    ACTION_NAMES = {
        "approve": "批准",
        "reject": "拒绝",
        "review": "人工审核",
    }
    
    def generate(self, results: List[RuleResult], store: DataStore) -> str:
        """生成 Markdown 报告"""
        lines = []
        
        # 标题
        lines.append("# 剧院演出换座与退票规则校验报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 统计概览
        lines.extend(self._generate_summary(results))
        
        # 订单详情
        lines.extend(self._generate_order_details(results))
        
        # 附录
        lines.extend(self._generate_appendix(store))
        
        return "\n".join(lines)
    
    def _generate_summary(self, results: List[RuleResult]) -> List[str]:
        """生成统计概览"""
        lines = []
        
        lines.append("## 统计概览")
        lines.append("")
        
        # 订单统计
        total = len(results)
        can_approve = sum(1 for r in results if r.can_approve)
        needs_review = sum(1 for r in results if r.requires_review)
        rejected = sum(1 for r in results if not r.can_approve)
        
        lines.append("### 订单处理状态")
        lines.append("")
        lines.append("| 状态 | 数量 | 比例 |")
        lines.append("|------|------|------|")
        lines.append(f"| 可批准 | {can_approve} | {can_approve/total*100:.1f}% |")
        lines.append(f"| 需人工审核 | {needs_review} | {needs_review/total*100:.1f}% |")
        lines.append(f"| 建议拒绝 | {rejected} | {rejected/total*100:.1f}% |")
        lines.append(f"| **总计** | **{total}** | **100%** |")
        lines.append("")
        
        # 问题统计
        total_issues = sum(len(r.issues) for r in results)
        if total_issues > 0:
            lines.append("### 问题类型分布")
            lines.append("")
            
            issue_counts: Dict[str, int] = {}
            severity_counts: Dict[str, int] = {}
            
            for result in results:
                for issue in result.issues:
                    issue_name = self.ISSUE_TYPE_NAMES.get(issue.issue_type, issue.issue_type.value)
                    issue_counts[issue_name] = issue_counts.get(issue_name, 0) + 1
                    
                    severity_name = self.SEVERITY_NAMES.get(issue.severity, issue.severity.value)
                    severity_counts[severity_name] = severity_counts.get(severity_name, 0) + 1
            
            lines.append("#### 按问题类型")
            lines.append("")
            lines.append("| 问题类型 | 数量 | 比例 |")
            lines.append("|----------|------|------|")
            for name, count in sorted(issue_counts.items(), key=lambda x: x[1], reverse=True):
                lines.append(f"| {name} | {count} | {count/total_issues*100:.1f}% |")
            lines.append("")
            
            lines.append("#### 按严重程度")
            lines.append("")
            lines.append("| 严重程度 | 数量 | 比例 |")
            lines.append("|----------|------|------|")
            for name in ["严重", "警告", "提示"]:
                count = severity_counts.get(name, 0)
                if count > 0:
                    lines.append(f"| {name} | {count} | {count/total_issues*100:.1f}% |")
            lines.append("")
        
        return lines
    
    def _generate_order_details(self, results: List[RuleResult]) -> List[str]:
        """生成订单详情"""
        lines = []
        
        lines.append("## 订单详情")
        lines.append("")
        
        # 按处理状态分组
        approved = [r for r in results if r.can_approve and not r.requires_review]
        review = [r for r in results if r.requires_review]
        rejected = [r for r in results if not r.can_approve]
        
        # 建议拒绝的订单
        if rejected:
            lines.append("### ❌ 建议拒绝的订单")
            lines.append("")
            for result in rejected:
                lines.extend(self._generate_single_order(result, "reject"))
            lines.append("")
        
        # 需要审核的订单
        if review:
            lines.append("### ⚠️ 需人工审核的订单")
            lines.append("")
            for result in review:
                lines.extend(self._generate_single_order(result, "review"))
            lines.append("")
        
        # 可批准的订单
        if approved:
            lines.append("### ✅ 可直接批准的订单")
            lines.append("")
            for result in approved:
                lines.extend(self._generate_single_order(result, "approve"))
            lines.append("")
        
        return lines
    
    def _generate_single_order(self, result: RuleResult, status: str) -> List[str]:
        """生成单个订单的详情"""
        lines = []
        order = result.order
        
        lines.append(f"#### 订单号: `{order.order_id}`")
        lines.append("")
        
        # 基本信息
        lines.append("**基本信息:**")
        lines.append("")
        lines.append(f"- 操作类型: **{'退票' if order.is_refund() else '换座'}**")
        lines.append(f"- 演出时间: {order.show_time.strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"- 申请时间: {order.request_time.strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"- 距离开演: {order.get_hours_before_show():.1f} 小时 ({order.get_minutes_before_show()} 分钟)")
        lines.append("")
        
        # 座位信息
        if order.original_seats:
            seats_str = ", ".join(str(s) for s in order.original_seats)
            lines.append(f"**原座位:** {seats_str}")
            lines.append("")
        
        if order.new_seats:
            seats_str = ", ".join(str(s) for s in order.new_seats)
            lines.append(f"**新座位:** {seats_str}")
            lines.append("")
        
        # 价格信息
        lines.append(f"**票价:** ¥{order.ticket_price:.2f}")
        lines.append("")
        
        # 问题列表
        if result.issues:
            lines.append("**检测到的问题:**")
            lines.append("")
            lines.append("| 严重程度 | 问题类型 | 描述 |")
            lines.append("|----------|----------|------|")
            for issue in result.issues:
                severity = self.SEVERITY_NAMES.get(issue.severity, issue.severity.value)
                issue_type = self.ISSUE_TYPE_NAMES.get(issue.issue_type, issue.issue_type.value)
                lines.append(f"| {severity} | {issue_type} | {issue.message} |")
            lines.append("")
        
        # 价格调整
        if result.price_adjustment:
            pa = result.price_adjustment
            lines.append("**价格调整详情:**")
            lines.append("")
            
            if pa["type"] == "refund":
                lines.append(f"- 原票价: ¥{pa['original_price']:.2f}")
                lines.append(f"- 手续费: ¥{pa['fee_amount']:.2f} ({pa['fee_rate']*100:.0f}%)")
                lines.append(f"- **应退金额: ¥{pa['refund_amount']:.2f}**")
            else:
                lines.append(f"- 原座位总价: ¥{pa['original_price']:.2f}")
                lines.append(f"- 新座位总价: ¥{pa['new_price']:.2f}")
                lines.append(f"- 差价: {'+' if pa['is_upgrade'] else ''}¥{pa['price_difference']:.2f}")
                if pa.get('customer_pays', 0) > 0:
                    lines.append(f"- **客户需补收: ¥{pa['customer_pays']:.2f}**")
                if pa.get('refund_to_customer', 0) > 0:
                    lines.append(f"- **需退还客户: ¥{pa['refund_to_customer']:.2f}**")
            lines.append("")
        
        # 处理建议
        if result.suggestions:
            lines.append("**处理建议:**")
            lines.append("")
            for idx, suggestion in enumerate(result.suggestions, 1):
                action = self.ACTION_NAMES.get(suggestion.action, suggestion.action)
                lines.append(f"{idx}. **[{action}]** {suggestion.message}")
                if suggestion.required_actions:
                    lines.append("")
                    lines.append("   操作步骤:")
                    for step in suggestion.required_actions:
                        lines.append(f"   - {step}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        
        return lines
    
    def _generate_appendix(self, store: DataStore) -> List[str]:
        """生成附录"""
        lines = []
        
        lines.append("## 附录")
        lines.append("")
        
        # 票档信息
        categories = store.get_all_categories()
        if categories:
            lines.append("### 票档配置")
            lines.append("")
            lines.append("| 票档ID | 名称 | 价格 | 可退票 | 可换座 | 适用区域 |")
            lines.append("|--------|------|------|--------|--------|----------|")
            for cat in categories:
                sections = ", ".join(cat.sections) if cat.sections else "全部"
                lines.append(
                    f"| {cat.id} | {cat.name} | ¥{cat.price:.2f} | "
                    f"{'是' if cat.refund_allowed else '否'} | "
                    f"{'是' if cat.exchange_allowed else '否'} | {sections} |"
                )
            lines.append("")
        
        # 区域信息
        sections = store.get_all_sections()
        if sections:
            lines.append("### 座位区域")
            lines.append("")
            lines.append("| 区域ID | 名称 | 行数 | 座位数 |")
            lines.append("|--------|------|------|--------|")
            for sec in sections:
                row_count = len(sec.rows)
                seat_count = sum(len(row) for row in sec.rows.values())
                lines.append(f"| {sec.id} | {sec.name} | {row_count} | {seat_count} |")
            lines.append("")
        
        # 规则说明
        lines.append("### 规则说明")
        lines.append("")
        
        refund_rules = store.get_refund_rules()
        exchange_rules = store.get_exchange_rules()
        
        lines.append("#### 退票规则")
        lines.append("")
        deadline = refund_rules.get("total_deadline_minutes", 0)
        if deadline > 0:
            lines.append(f"- 退票截止时间: 开演前 {deadline} 分钟 ({deadline/60:.1f} 小时)")
        
        tiered_fees = refund_rules.get("tiered_fees", [])
        if tiered_fees:
            lines.append("- 分级手续费:")
            for tier in tiered_fees:
                threshold = tier.get("total_threshold_minutes", 0)
                rate = tier.get("fee_rate", 0)
                amount = tier.get("fee_amount", 0)
                if amount > 0:
                    lines.append(f"  - 开演前 {threshold} 分钟以上: 手续费 ¥{amount:.2f}")
                else:
                    lines.append(f"  - 开演前 {threshold} 分钟以上: 手续费 {rate*100:.0f}%")
        lines.append("")
        
        lines.append("#### 换座规则")
        lines.append("")
        deadline = exchange_rules.get("total_deadline_minutes", 0)
        if deadline > 0:
            lines.append(f"- 换座截止时间: 开演前 {deadline} 分钟 ({deadline/60:.1f} 小时)")
        
        cross_section = exchange_rules.get("allow_cross_section", True)
        cross_category = exchange_rules.get("allow_cross_category", True)
        lines.append(f"- 允许跨区域换座: {'是' if cross_section else '否'}")
        lines.append(f"- 允许跨票档换座: {'是' if cross_category else '否'}")
        
        price_policy = exchange_rules.get("price_difference_policy", "customer_pays")
        policy_names = {
            "customer_pays": "客户补差价",
            "theatre_absorbs": "剧院承担",
            "split": "双方分担"
        }
        lines.append(f"- 价格差异处理: {policy_names.get(price_policy, price_policy)}")
        lines.append("")
        
        return lines


class CSVReporter:
    """CSV 报告生成器"""
    
    HEADERS = [
        "订单号",
        "操作类型",
        "演出时间",
        "申请时间",
        "原座位",
        "新座位",
        "票价",
        "处理建议",
        "问题数量",
        "严重问题",
        "警告",
        "提示",
        "价格调整类型",
        "原总价",
        "新总价",
        "差价",
        "应退金额",
        "应补金额",
        "问题详情",
    ]
    
    def generate(self, results: List[RuleResult]) -> str:
        """生成 CSV 报告"""
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # 写入表头
        writer.writerow(self.HEADERS)
        
        # 写入数据
        for result in results:
            row = self._result_to_row(result)
            writer.writerow(row)
        
        return output.getvalue()
    
    def _result_to_row(self, result: RuleResult) -> list:
        """将结果转换为 CSV 行"""
        order = result.order
        
        # 问题统计
        critical = sum(1 for i in result.issues if i.severity == IssueSeverity.CRITICAL)
        warning = sum(1 for i in result.issues if i.severity == IssueSeverity.WARNING)
        info = sum(1 for i in result.issues if i.severity == IssueSeverity.INFO)
        
        # 价格调整
        pa = result.price_adjustment
        price_type = ""
        original_total = ""
        new_total = ""
        difference = ""
        refund_amount = ""
        collect_amount = ""
        
        if pa:
            price_type = "退票" if pa.get("type") == "refund" else "换座"
            original_total = f"{pa.get('original_price', 0):.2f}"
            new_total = f"{pa.get('new_price', pa.get('original_price', 0)):.2f}"
            difference = f"{pa.get('price_difference', pa.get('fee_amount', 0)):.2f}"
            
            if pa.get("type") == "refund":
                refund_amount = f"{pa.get('refund_amount', 0):.2f}"
            else:
                refund_amount = f"{pa.get('refund_to_customer', 0):.2f}" if pa.get('refund_to_customer', 0) > 0 else ""
                collect_amount = f"{pa.get('customer_pays', 0):.2f}" if pa.get('customer_pays', 0) > 0 else ""
        
        # 处理建议
        suggestion_action = ""
        if result.suggestions:
            first_suggestion = result.suggestions[0]
            action_names = {
                "approve": "批准",
                "reject": "拒绝",
                "review": "人工审核"
            }
            suggestion_action = action_names.get(first_suggestion.action, first_suggestion.action)
        else:
            if not result.can_approve:
                suggestion_action = "拒绝"
            elif result.requires_review:
                suggestion_action = "人工审核"
            else:
                suggestion_action = "批准"
        
        # 问题详情
        issue_details = "; ".join(
            f"[{self._get_severity_name(i.severity)}] {i.message}"
            for i in result.issues
        )
        
        return [
            order.order_id,
            "退票" if order.is_refund() else "换座",
            order.show_time.strftime("%Y-%m-%d %H:%M:%S"),
            order.request_time.strftime("%Y-%m-%d %H:%M:%S"),
            ", ".join(str(s) for s in order.original_seats),
            ", ".join(str(s) for s in order.new_seats) if order.new_seats else "",
            f"{order.ticket_price:.2f}",
            suggestion_action,
            len(result.issues),
            critical,
            warning,
            info,
            price_type,
            original_total,
            new_total,
            difference,
            refund_amount,
            collect_amount,
            issue_details,
        ]
    
    def _get_severity_name(self, severity: IssueSeverity) -> str:
        """获取严重程度名称"""
        names = {
            IssueSeverity.CRITICAL: "严重",
            IssueSeverity.WARNING: "警告",
            IssueSeverity.INFO: "提示",
        }
        return names.get(severity, severity.value)
