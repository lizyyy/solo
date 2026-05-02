"""规则引擎 - 核心业务逻辑"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from enum import Enum
from collections import defaultdict

from storage.store import DataStore, Order, Seat, TicketCategory


class IssueSeverity(Enum):
    """问题严重程度"""
    CRITICAL = "critical"    # 严重错误，必须处理
    WARNING = "warning"       # 需要关注
    INFO = "info"             # 提示信息


class IssueType(Enum):
    """问题类型"""
    # 换座相关
    CONSECUTIVE_SEATS_BROKEN = "consecutive_seats_broken"      # 连座被拆
    ACCESSIBLE_SEAT_MISUSE = "accessible_seat_misuse"            # 无障碍座误换
    CROSS_CATEGORY_EXCHANGE = "cross_category_exchange"          # 跨票档换座
    CROSS_SECTION_EXCHANGE = "cross_section_exchange"            # 跨区域换座
    
    # 退票相关
    TOO_LATE_TO_REFUND = "too_late_to_refund"                    # 临开演禁退
    REFUND_NOT_ALLOWED = "refund_not_allowed"                    # 票档禁退
    
    # 其他
    DUPLICATE_ORDER = "duplicate_order"                           # 重复订单号
    PRICE_DIFFERENCE = "price_difference"                         # 价格差异
    SEAT_NOT_AVAILABLE = "seat_not_available"                     # 座位不可用


@dataclass
class Issue:
    """问题描述"""
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    affected_seats: List[Seat] = field(default_factory=list)


@dataclass
class Suggestion:
    """处理建议"""
    action: str          # 建议的操作: approve, reject, review, adjust_price
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    required_actions: List[str] = field(default_factory=list)


@dataclass
class RuleResult:
    """规则执行结果"""
    order_id: str
    order: Order
    issues: List[Issue] = field(default_factory=list)
    suggestions: List[Suggestion] = field(default_factory=list)
    can_approve: bool = True
    requires_review: bool = False
    price_adjustment: Dict[str, Any] = field(default_factory=dict)
    
    def has_critical_issues(self) -> bool:
        """是否有严重问题"""
        return any(issue.severity == IssueSeverity.CRITICAL for issue in self.issues)
    
    def has_warnings(self) -> bool:
        """是否有警告"""
        return any(issue.severity == IssueSeverity.WARNING for issue in self.issues)


class RulesEngine:
    """规则引擎"""
    
    def __init__(self, store: DataStore):
        self.store = store
    
    def process_all_orders(self) -> List[RuleResult]:
        """处理所有订单"""
        results = []
        
        # 首先检查重复订单号
        duplicate_ids = self.store.get_duplicate_order_ids()
        duplicate_orders_set = set()
        for dup_id in duplicate_ids:
            for order in self.store.get_orders_by_id(dup_id):
                duplicate_orders_set.add(id(order))
        
        # 处理每个订单
        for order in self.store.get_all_orders():
            result = self.process_order(order)
            
            # 添加重复订单标记
            if id(order) in duplicate_orders_set:
                result.issues.append(Issue(
                    issue_type=IssueType.DUPLICATE_ORDER,
                    severity=IssueSeverity.WARNING,
                    message=f"订单号 '{order.order_id}' 存在重复记录",
                    details={
                        "order_id": order.order_id,
                        "total_records": len(self.store.get_orders_by_id(order.order_id))
                    }
                ))
                result.requires_review = True
            
            results.append(result)
        
        return results
    
    def process_order(self, order: Order) -> RuleResult:
        """处理单个订单"""
        result = RuleResult(
            order_id=order.order_id,
            order=order
        )
        
        if order.is_refund():
            self._check_refund_rules(order, result)
        elif order.is_exchange():
            self._check_exchange_rules(order, result)
        
        # 确定最终建议
        self._generate_suggestions(result)
        
        return result
    
    def _check_refund_rules(self, order: Order, result: RuleResult):
        """检查退票规则"""
        refund_rules = self.store.get_refund_rules()
        
        # 1. 检查是否超过退票截止时间
        minutes_before = order.get_minutes_before_show()
        deadline = refund_rules.get("total_deadline_minutes", 0)
        
        if minutes_before < deadline:
            result.issues.append(Issue(
                issue_type=IssueType.TOO_LATE_TO_REFUND,
                severity=IssueSeverity.CRITICAL,
                message=f"距离开演仅 {minutes_before} 分钟，已超过退票截止时间（{deadline} 分钟）",
                details={
                    "minutes_before_show": minutes_before,
                    "deadline_minutes": deadline,
                    "show_time": order.show_time.strftime("%Y-%m-%d %H:%M"),
                    "request_time": order.request_time.strftime("%Y-%m-%d %H:%M")
                }
            ))
            result.can_approve = False
        
        # 2. 检查票档是否允许退票
        category = self._get_ticket_category(order)
        if category and not category.refund_allowed:
            result.issues.append(Issue(
                issue_type=IssueType.REFUND_NOT_ALLOWED,
                severity=IssueSeverity.CRITICAL,
                message=f"票档 '{category.name}' 不允许退票",
                details={
                    "category_id": category.id,
                    "category_name": category.name
                }
            ))
            result.can_approve = False
        
        # 3. 计算退票手续费
        if result.can_approve:
            fee_info = self._calculate_refund_fee(order, refund_rules)
            result.price_adjustment = {
                "type": "refund",
                "original_price": order.ticket_price,
                "fee_amount": fee_info.get("fee", 0),
                "fee_rate": fee_info.get("fee_rate", 0),
                "refund_amount": fee_info.get("refund_amount", order.ticket_price),
                "details": fee_info
            }
    
    def _check_exchange_rules(self, order: Order, result: RuleResult):
        """检查换座规则"""
        exchange_rules = self.store.get_exchange_rules()
        
        # 1. 检查是否超过换座截止时间
        minutes_before = order.get_minutes_before_show()
        deadline = exchange_rules.get("total_deadline_minutes", 0)
        
        if minutes_before < deadline:
            result.issues.append(Issue(
                issue_type=IssueType.TOO_LATE_TO_REFUND,
                severity=IssueSeverity.CRITICAL,
                message=f"距离开演仅 {minutes_before} 分钟，已超过换座截止时间（{deadline} 分钟）",
                details={
                    "minutes_before_show": minutes_before,
                    "deadline_minutes": deadline
                }
            ))
            result.can_approve = False
        
        # 2. 检查连座是否被拆
        consecutive_issue = self._check_consecutive_seats(order)
        if consecutive_issue:
            result.issues.append(consecutive_issue)
            result.requires_review = True
        
        # 3. 检查无障碍座位误换
        accessible_issue = self._check_accessible_seats(order)
        if accessible_issue:
            result.issues.append(accessible_issue)
            result.requires_review = True
        
        # 4. 检查跨票档/跨区域换座及价格差异
        cross_issues, price_diff = self._check_cross_category_and_price(order)
        result.issues.extend(cross_issues)
        
        if price_diff:
            result.price_adjustment = {
                "type": "exchange",
                "original_price": price_diff["original_total"],
                "new_price": price_diff["new_total"],
                "price_difference": price_diff["difference"],
                "is_upgrade": price_diff["is_upgrade"],
                "customer_pays": max(price_diff["difference"], 0) if price_diff["is_upgrade"] else 0,
                "refund_to_customer": abs(price_diff["difference"]) if not price_diff["is_upgrade"] else 0,
                "details": price_diff
            }
            result.requires_review = True
        
        # 5. 检查票档是否允许换座
        category = self._get_ticket_category(order)
        if category and not category.exchange_allowed:
            result.issues.append(Issue(
                issue_type=IssueType.REFUND_NOT_ALLOWED,
                severity=IssueSeverity.WARNING,
                message=f"票档 '{category.name}' 可能不允许换座，请确认",
                details={
                    "category_id": category.id,
                    "category_name": category.name
                }
            ))
            result.requires_review = True
    
    def _check_consecutive_seats(self, order: Order) -> Optional[Issue]:
        """检查连座是否被拆"""
        original_seats = order.original_seats
        new_seats = order.new_seats
        
        if len(original_seats) <= 1:
            return None
        
        # 检查原座位是否为连座
        original_consecutive = self._are_consecutive_seats(original_seats)
        
        if not original_consecutive:
            return None
        
        # 检查新座位是否为连座
        new_consecutive = self._are_consecutive_seats(new_seats)
        
        if not new_consecutive:
            original_seat_str = ", ".join(str(s) for s in original_seats)
            new_seat_str = ", ".join(str(s) for s in new_seats)
            
            return Issue(
                issue_type=IssueType.CONSECUTIVE_SEATS_BROKEN,
                severity=IssueSeverity.WARNING,
                message=f"原座位为连座 ({original_seat_str})，但新座位 ({new_seat_str}) 不是连座",
                details={
                    "original_seats": [str(s) for s in original_seats],
                    "new_seats": [str(s) for s in new_seats],
                    "original_consecutive": original_consecutive,
                    "new_consecutive": new_consecutive
                },
                affected_seats=new_seats
            )
        
        return None
    
    def _are_consecutive_seats(self, seats: List[Seat]) -> bool:
        """检查一组座位是否为连座"""
        if len(seats) <= 1:
            return True
        
        # 按区域和行分组
        groups = defaultdict(list)
        for seat in seats:
            key = (seat.section, seat.row)
            groups[key].append(seat)
        
        # 如果座位分布在不同区域或行，不是连座
        if len(groups) > 1:
            return False
        
        # 获取同一区域同一行的所有座位号
        for key, group in groups.items():
            numbers = []
            for seat in group:
                try:
                    num = int(seat.number)
                    numbers.append(num)
                except ValueError:
                    # 如果座位号不是纯数字，尝试提取数字部分
                    import re
                    match = re.search(r'(\d+)', seat.number)
                    if match:
                        numbers.append(int(match.group(1)))
                    else:
                        # 无法解析为数字，认为不是连座
                        return False
            
            if not numbers:
                return False
            
            numbers.sort()
            
            # 检查是否连续
            for i in range(1, len(numbers)):
                if numbers[i] - numbers[i-1] != 1:
                    return False
        
        return True
    
    def _check_accessible_seats(self, order: Order) -> Optional[Issue]:
        """检查无障碍座位误换"""
        original_seats = order.original_seats
        new_seats = order.new_seats
        
        # 检查原座位是否为无障碍座位
        original_accessible = []
        for seat in original_seats:
            if self.store.is_accessible_seat(seat):
                original_accessible.append(seat)
        
        # 检查新座位是否为无障碍座位
        new_accessible = []
        for seat in new_seats:
            seat_info = self.store.get_seat(seat.section, seat.row, seat.number)
            if seat_info and seat_info.is_accessible:
                new_accessible.append(seat)
        
        issues = []
        
        # 情况1：从无障碍座位换到普通座位
        if original_accessible and not new_accessible:
            seats_str = ", ".join(str(s) for s in original_accessible)
            return Issue(
                issue_type=IssueType.ACCESSIBLE_SEAT_MISUSE,
                severity=IssueSeverity.WARNING,
                message=f"原座位 ({seats_str}) 为无障碍座位，换至普通座位需确认客户需求",
                details={
                    "original_accessible": [str(s) for s in original_accessible],
                    "new_accessible": [str(s) for s in new_accessible],
                    "situation": "accessible_to_regular"
                },
                affected_seats=original_accessible + new_seats
            )
        
        # 情况2：从普通座位换到无障碍座位
        if not original_accessible and new_accessible:
            seats_str = ", ".join(str(s) for s in new_accessible)
            return Issue(
                issue_type=IssueType.ACCESSIBLE_SEAT_MISUSE,
                severity=IssueSeverity.WARNING,
                message=f"新座位 ({seats_str}) 为无障碍座位，从普通座位换至无障碍座位需确认客户是否有特殊需求",
                details={
                    "original_accessible": [str(s) for s in original_accessible],
                    "new_accessible": [str(s) for s in new_accessible],
                    "situation": "regular_to_accessible"
                },
                affected_seats=original_accessible + new_accessible
            )
        
        return None
    
    def _check_cross_category_and_price(
        self, 
        order: Order
    ) -> Tuple[List[Issue], Optional[Dict[str, Any]]]:
        """检查跨票档换座和价格差异"""
        issues = []
        original_seats = order.original_seats
        new_seats = order.new_seats
        
        exchange_rules = self.store.get_exchange_rules()
        allow_cross_section = exchange_rules.get("allow_cross_section", True)
        allow_cross_category = exchange_rules.get("allow_cross_category", True)
        
        # 获取原座位和新座位的区域和票档信息
        original_sections = set(s.section for s in original_seats if s.section)
        new_sections = set(s.section for s in new_seats if s.section)
        
        # 检查是否跨区域
        if original_sections and new_sections and original_sections != new_sections:
            cross_section = new_sections - original_sections
            if cross_section:
                issue = Issue(
                    issue_type=IssueType.CROSS_SECTION_EXCHANGE,
                    severity=IssueSeverity.INFO if allow_cross_section else IssueSeverity.WARNING,
                    message=f"跨区域换座：从 {', '.join(original_sections)} 到 {', '.join(new_sections)}",
                    details={
                        "original_sections": list(original_sections),
                        "new_sections": list(new_sections),
                        "allowed": allow_cross_section
                    }
                )
                issues.append(issue)
        
        # 计算价格差异
        original_total = 0.0
        new_total = 0.0
        
        for seat in original_seats:
            original_total += self.store.get_seat_price(seat) or order.ticket_price
        
        for seat in new_seats:
            new_total += self.store.get_seat_price(seat) or order.ticket_price
        
        # 如果从订单价格计算更准确
        if original_total == 0:
            original_total = order.ticket_price * len(original_seats)
        if new_total == 0:
            new_total = order.ticket_price * len(new_seats)
        
        # 检查票档变化
        original_categories = set()
        new_categories = set()
        
        for seat in original_seats:
            cat = self.store.get_category_by_section(seat.section)
            if cat:
                original_categories.add(cat.id)
        
        for seat in new_seats:
            cat = self.store.get_category_by_section(seat.section)
            if cat:
                new_categories.add(cat.id)
        
        if original_categories and new_categories and original_categories != new_categories:
            cross_cats = new_categories - original_categories
            if cross_cats:
                issue = Issue(
                    issue_type=IssueType.CROSS_CATEGORY_EXCHANGE,
                    severity=IssueSeverity.INFO if allow_cross_category else IssueSeverity.WARNING,
                    message=f"跨票档换座：票档发生变化",
                    details={
                        "original_categories": list(original_categories),
                        "new_categories": list(new_categories),
                        "allowed": allow_cross_category
                    }
                )
                issues.append(issue)
        
        # 计算价格差异
        difference = new_total - original_total
        is_upgrade = difference > 0
        
        if abs(difference) > 0.01:  # 考虑浮点精度
            price_diff = {
                "original_total": original_total,
                "new_total": new_total,
                "difference": difference,
                "is_upgrade": is_upgrade,
                "original_seats_count": len(original_seats),
                "new_seats_count": len(new_seats)
            }
            
            issues.append(Issue(
                issue_type=IssueType.PRICE_DIFFERENCE,
                severity=IssueSeverity.INFO if is_upgrade else IssueSeverity.WARNING,
                message=f"价格差异：{'需补收' if is_upgrade else '需退还'} ¥{abs(difference):.2f}",
                details=price_diff
            ))
            
            return issues, price_diff
        
        return issues, None
    
    def _get_ticket_category(self, order: Order) -> Optional[TicketCategory]:
        """获取订单对应的票档"""
        # 首先尝试从订单的票档字段获取
        if order.ticket_category:
            cat = self.store.get_category(order.ticket_category)
            if cat:
                return cat
        
        # 然后尝试从价格获取
        cat = self.store.get_category_by_price(order.ticket_price)
        if cat:
            return cat
        
        # 最后尝试从座位区域获取
        if order.original_seats:
            first_seat = order.original_seats[0]
            cat = self.store.get_category_by_section(first_seat.section)
            if cat:
                return cat
        
        return None
    
    def _calculate_refund_fee(self, order: Order, refund_rules: Dict) -> Dict[str, Any]:
        """计算退票手续费"""
        minutes_before = order.get_minutes_before_show()
        price = order.ticket_price
        
        # 检查分级手续费
        tiered_fees = refund_rules.get("tiered_fees", [])
        
        for tier in tiered_fees:
            if minutes_before >= tier.get("total_threshold_minutes", 0):
                fee_rate = tier.get("fee_rate", 0.0)
                fee_amount = tier.get("fee_amount", 0.0)
                
                fee = max(price * fee_rate, fee_amount)
                refund_amount = price - fee
                
                return {
                    "can_refund": True,
                    "fee_rate": fee_rate,
                    "fee_amount": fee_amount,
                    "fee": fee,
                    "refund_amount": refund_amount,
                    "threshold_minutes": tier.get("total_threshold_minutes", 0)
                }
        
        # 默认手续费
        category = self._get_ticket_category(order)
        default_rate = category.refund_fee_rate if category else 0.0
        
        fee = price * default_rate
        refund_amount = price - fee
        
        return {
            "can_refund": True,
            "fee_rate": default_rate,
            "fee": fee,
            "refund_amount": refund_amount
        }
    
    def _generate_suggestions(self, result: RuleResult):
        """生成处理建议"""
        suggestions = []
        
        # 根据问题生成建议
        if not result.can_approve:
            # 有严重问题，建议拒绝
            critical_issues = [i for i in result.issues if i.severity == IssueSeverity.CRITICAL]
            reasons = "; ".join(i.message for i in critical_issues)
            
            suggestions.append(Suggestion(
                action="reject",
                message=f"建议拒绝此申请，原因：{reasons}",
                details={
                    "reasons": [i.message for i in critical_issues]
                },
                required_actions=["拒绝申请并告知客户原因"]
            ))
        
        elif result.requires_review:
            # 需要人工审核
            warnings = [i for i in result.issues if i.severity in (IssueSeverity.WARNING, IssueSeverity.INFO)]
            
            if result.price_adjustment:
                # 有价格调整
                pa = result.price_adjustment
                if pa.get("is_upgrade"):
                    suggestions.append(Suggestion(
                        action="review",
                        message=f"需人工审核：跨票档换座需补收 ¥{pa.get('customer_pays', 0):.2f}",
                        details=result.price_adjustment,
                        required_actions=[
                            "确认新座位信息",
                            "向客户收取差价 ¥{:.2f}".format(pa.get('customer_pays', 0)),
                            "完成换座操作"
                        ]
                    ))
                else:
                    suggestions.append(Suggestion(
                        action="review",
                        message=f"需人工审核：换座后需退还客户 ¥{pa.get('refund_to_customer', 0):.2f}",
                        details=result.price_adjustment,
                        required_actions=[
                            "确认新座位信息",
                            "办理退款 ¥{:.2f}".format(pa.get('refund_to_customer', 0)),
                            "完成换座操作"
                        ]
                    ))
            else:
                # 其他需要审核的情况
                messages = [i.message for i in warnings]
                suggestions.append(Suggestion(
                    action="review",
                    message=f"需人工审核：{'; '.join(messages)}",
                    details={"issues": [i.message for i in warnings]},
                    required_actions=[
                        "核实相关情况",
                        "与客户确认需求",
                        "根据实际情况决定是否批准"
                    ]
                ))
        
        else:
            # 可以自动通过
            if result.order.is_refund() and result.price_adjustment:
                pa = result.price_adjustment
                suggestions.append(Suggestion(
                    action="approve",
                    message=f"建议批准：退票金额 ¥{pa.get('refund_amount', 0):.2f}（手续费 ¥{pa.get('fee_amount', 0):.2f}）",
                    details=result.price_adjustment,
                    required_actions=[
                        "办理退款 ¥{:.2f}".format(pa.get('refund_amount', 0))
                    ]
                ))
            else:
                suggestions.append(Suggestion(
                    action="approve",
                    message="建议批准：未发现违规问题",
                    required_actions=[
                        "确认无误后执行操作"
                    ]
                ))
        
        result.suggestions = suggestions
