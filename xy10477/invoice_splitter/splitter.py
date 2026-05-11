"""拆票规则引擎和异常检测"""

from typing import List, Dict, Tuple, Optional, Set
from decimal import Decimal
from datetime import datetime
import uuid

from .models import (
    Order, OrderItem, InvoiceHeader, ProductCategory, RefundRecord,
    InvoiceGroup, Issue, IssueType, InvoiceType, SplitResult, AdjustmentRecord
)


class IssueDetector:
    """异常检测器"""

    def __init__(
        self,
        orders: List[Order],
        headers: List[InvoiceHeader],
        categories: List[ProductCategory],
        refunds: List[RefundRecord],
    ):
        self.orders = orders
        self.headers_map = {h.header_id: h for h in headers}
        self.headers_by_name = {h.name: h for h in headers}
        self.categories_map = {c.category_id: c for c in categories}
        self.refunds_map: Dict[str, List[RefundRecord]] = {}
        for r in refunds:
            self.refunds_map.setdefault(r.order_id, []).append(r)
        self.orders_map = {o.order_id: o for o in orders}
        self.issues: List[Issue] = []

    def detect_all(self) -> List[Issue]:
        """执行所有检测"""
        self.issues = []
        self.detect_header_missing()
        self.detect_invalid_header()
        self.detect_tax_rate_issues()
        self.detect_refund_issues()
        self.detect_duplicate_invoice()
        self.detect_zero_amount()
        self.detect_full_refunded()
        return self.issues

    def detect_header_missing(self):
        """检测抬头缺失"""
        for order in self.orders:
            if not order.has_header and order.net_amount > 0:
                self.issues.append(Issue(
                    type=IssueType.HEADER_MISSING,
                    order_id=order.order_id,
                    message=f"订单 {order.order_id} 没有发票抬头信息",
                    severity="error",
                    details={"platform": order.platform, "net_amount": float(order.net_amount)},
                ))

    def detect_invalid_header(self):
        """检测无效抬头"""
        for order in self.orders:
            if order.header_id:
                header = self.headers_map.get(order.header_id)
                if header and not header.is_valid:
                    self.issues.append(Issue(
                        type=IssueType.INVALID_HEADER,
                        order_id=order.order_id,
                        header_id=order.header_id,
                        message=f"订单 {order.order_id} 使用的抬头 '{header.name}' 已标记为无效",
                        severity="error",
                        details={"header_name": header.name},
                    ))

    def detect_tax_rate_issues(self):
        """检测税率相关问题"""
        for order in self.orders:
            tax_rates_in_order: Set[Decimal] = set()
            for item in order.items:
                if item.net_amount <= 0:
                    continue

                if item.tax_rate is None:
                    category = self.categories_map.get(item.category_id)
                    if not category or category.tax_rate is None:
                        self.issues.append(Issue(
                            type=IssueType.CATEGORY_NO_TAX_RATE,
                            order_id=order.order_id,
                            item_id=item.item_id,
                            category_id=item.category_id,
                            message=f"商品 '{item.product_name}' 所属类目 '{item.category_name}' 没有定义税率",
                            severity="error",
                            details={"product_name": item.product_name, "category_name": item.category_name},
                        ))
                    continue

                tax_rates_in_order.add(item.tax_rate)

            if len(tax_rates_in_order) > 1:
                rates_str = ", ".join([f"{float(r) * 100}%" for r in tax_rates_in_order])
                self.issues.append(Issue(
                    type=IssueType.TAX_RATE_MIXED,
                    order_id=order.order_id,
                    message=f"订单 {order.order_id} 包含多种税率: {rates_str}，需要拆分开票",
                    severity="warning",
                    details={"tax_rates": [float(r) for r in tax_rates_in_order]},
                ))

    def detect_refund_issues(self):
        """检测退款相关问题"""
        for order_id, refunds in self.refunds_map.items():
            unprocessed = [r for r in refunds if not r.is_processed]
            if unprocessed:
                order = self.orders_map.get(order_id)
                total_unprocessed = sum(r.amount for r in unprocessed)
                self.issues.append(Issue(
                    type=IssueType.REFUND_NOT_PROCESSED,
                    order_id=order_id,
                    message=f"订单 {order_id} 有 {len(unprocessed)} 笔退款未处理，金额合计 {total_unprocessed}",
                    severity="warning",
                    details={"unprocessed_count": len(unprocessed), "total_unprocessed": float(total_unprocessed)},
                ))

    def detect_duplicate_invoice(self):
        """检测重复开票"""
        for order in self.orders:
            if order.has_invoiced and order.net_amount > 0:
                invoice_ids_str = ", ".join(order.invoice_ids) if order.invoice_ids else "未知"
                self.issues.append(Issue(
                    type=IssueType.DUPLICATE_INVOICE,
                    order_id=order.order_id,
                    message=f"订单 {order.order_id} 已开票（发票号: {invoice_ids_str}），但仍有净额 {order.net_amount} 待开票",
                    severity="warning",
                    details={
                        "invoice_ids": order.invoice_ids,
                        "net_amount": float(order.net_amount),
                        "total_amount": float(order.total_amount),
                    },
                ))

    def detect_zero_amount(self):
        """检测金额为零"""
        for order in self.orders:
            if order.net_amount == 0 and order.has_header:
                self.issues.append(Issue(
                    type=IssueType.ZERO_AMOUNT,
                    order_id=order.order_id,
                    message=f"订单 {order.order_id} 净金额为零，无需开票",
                    severity="info",
                    details={"total_amount": float(order.total_amount), "refunded": float(order.total_refunded_amount)},
                ))

    def detect_full_refunded(self):
        """检测已全额退款"""
        for order in self.orders:
            if order.status.value == "全额退款":
                self.issues.append(Issue(
                    type=IssueType.FULL_REFUNDED,
                    order_id=order.order_id,
                    message=f"订单 {order.order_id} 已全额退款，无需开票",
                    severity="info",
                    details={"total_amount": float(order.total_amount), "refunded": float(order.total_refunded_amount)},
                ))


class InvoiceSplitter:
    """拆票规则引擎"""

    def __init__(
        self,
        orders: List[Order],
        headers: List[InvoiceHeader],
        categories: List[ProductCategory],
        refunds: List[RefundRecord],
    ):
        self.orders = orders
        self.headers = headers
        self.categories = categories
        self.refunds = refunds
        self.issues: List[Issue] = []
        self.groups: List[InvoiceGroup] = []
        self.group_counter = 0
        self.adjustments: List[AdjustmentRecord] = []

    def _generate_group_id(self) -> str:
        """生成分组ID"""
        self.group_counter += 1
        return f"INV-GRP-{self.group_counter:04d}"

    def split(self) -> SplitResult:
        """执行拆票"""
        detector = IssueDetector(self.orders, self.headers, self.categories, self.refunds)
        self.issues = detector.detect_all()
        self.groups = []
        self.group_counter = 0

        valid_orders = [o for o in self.orders if o.is_valid_for_invoice]

        items_with_order = []
        for order in valid_orders:
            for item in order.items:
                if item.net_amount > 0:
                    items_with_order.append((order, item))

        grouped_by_header_tax: Dict[Tuple[str, InvoiceType, Optional[Decimal]], List[Tuple[Order, OrderItem]]] = {}

        for order, item in items_with_order:
            header_name = order.header_name or f"未知抬头-{order.order_id}"
            header_type = order.header_type
            tax_rate = item.tax_rate

            if tax_rate is None:
                tax_rate = Decimal("0")

            key = (header_name, header_type, tax_rate)
            grouped_by_header_tax.setdefault(key, []).append((order, item))

        for (header_name, header_type, tax_rate), items_list in grouped_by_header_tax.items():
            order_ids: Set[str] = set()
            group_items: List[OrderItem] = []
            split_reasons = []

            for order, item in items_list:
                order_ids.add(order.order_id)
                group_items.append(item)

            if tax_rate == Decimal("0"):
                split_reasons.append("税率未定义（使用默认0%）")
            else:
                split_reasons.append(f"按税率 {float(tax_rate) * 100}% 分组")

            if header_type == InvoiceType.ENTERPRISE:
                split_reasons.append("企业抬头单独开票")
            elif header_type == InvoiceType.PERSONAL:
                split_reasons.append("个人抬头单独开票")

            refund_orders = [o for o in items_list if o[0].total_refunded_amount > 0]
            if refund_orders:
                split_reasons.append(f"包含 {len(refund_orders)} 笔退款订单，已冲抵退款金额")

            group = InvoiceGroup(
                group_id=self._generate_group_id(),
                header_name=header_name,
                header_type=header_type,
                tax_rate=tax_rate if tax_rate != Decimal("0") else Decimal("0"),
                order_ids=sorted(list(order_ids)),
                items=group_items,
                split_reason="；".join(split_reasons),
            )
            self.groups.append(group)

        self.groups.sort(key=lambda g: (g.header_name, g.tax_rate))

        return SplitResult(
            original_orders=self.orders,
            headers=self.headers,
            categories=self.categories,
            refunds=self.refunds,
            issues=self.issues,
            invoice_groups=self.groups,
            adjustments=self.adjustments,
        )

    def adjust_split(
        self,
        result: SplitResult,
        action: str,
        target_group_ids: List[str],
        operator: str,
        reason: str,
        notes: Optional[str] = None,
        custom_groups: Optional[List[InvoiceGroup]] = None,
    ) -> SplitResult:
        """
        人工调整拆票

        action: "split" (拆分), "merge" (合并), "custom" (自定义)
        """
        original_groups_map = {g.group_id: g for g in result.invoice_groups}
        original_groups = [original_groups_map[gid] for gid in target_group_ids if gid in original_groups_map]

        if not original_groups:
            return result

        new_groups: List[InvoiceGroup] = []

        if action == "merge" and len(original_groups) >= 2:
            all_items = []
            all_order_ids = set()
            header_name = original_groups[0].header_name
            header_type = original_groups[0].header_type
            tax_rate = original_groups[0].tax_rate

            for g in original_groups:
                all_items.extend(g.items)
                all_order_ids.update(g.order_ids)

            merged_group = InvoiceGroup(
                group_id=self._generate_group_id(),
                header_name=header_name,
                header_type=header_type,
                tax_rate=tax_rate,
                order_ids=sorted(list(all_order_ids)),
                items=all_items,
                split_reason=f"人工合并 {len(original_groups)} 个分组: {', '.join([g.group_id for g in original_groups])}",
                is_adjusted=True,
                adjustment_notes=notes,
                original_group_ids=[g.group_id for g in original_groups],
            )
            new_groups.append(merged_group)

        elif action == "split" and len(original_groups) == 1:
            group = original_groups[0]
            for order_id in group.order_ids:
                order_items = [item for item in group.items if any(o.order_id == order_id for o in self.orders)]
                if not order_items:
                    continue

                new_group = InvoiceGroup(
                    group_id=self._generate_group_id(),
                    header_name=group.header_name,
                    header_type=group.header_type,
                    tax_rate=group.tax_rate,
                    order_ids=[order_id],
                    items=order_items,
                    split_reason=f"人工拆分自 {group.group_id}，按订单单独开票",
                    is_adjusted=True,
                    adjustment_notes=notes,
                    original_group_ids=[group.group_id],
                )
                new_groups.append(new_group)

        elif action == "custom" and custom_groups:
            for idx, custom_group in enumerate(custom_groups):
                custom_group.group_id = self._generate_group_id()
                custom_group.is_adjusted = True
                custom_group.original_group_ids = [g.group_id for g in original_groups]
                if notes:
                    custom_group.adjustment_notes = notes
                new_groups.append(custom_group)

        else:
            return result

        remaining_groups = [g for g in result.invoice_groups if g.group_id not in target_group_ids]
        final_groups = remaining_groups + new_groups

        adjustment = AdjustmentRecord(
            adjustment_id=str(uuid.uuid4())[:8],
            timestamp=datetime.now(),
            operator=operator,
            action=action,
            original_groups=original_groups,
            new_groups=new_groups,
            reason=reason,
            notes=notes,
        )
        self.adjustments.append(adjustment)

        return SplitResult(
            original_orders=result.original_orders,
            headers=result.headers,
            categories=result.categories,
            refunds=result.refunds,
            issues=result.issues,
            invoice_groups=final_groups,
            adjustments=result.adjustments + [adjustment],
        )
