"""报告导出模块"""

import os
import json
from typing import Dict, List, Any
from datetime import datetime

import pandas as pd

from .models import SplitResult, InvoiceGroup, AdjustmentRecord, Issue, IssueType


class ReportGenerator:
    """报告生成器"""

    @staticmethod
    def _format_decimal(value) -> float:
        from decimal import Decimal
        if isinstance(value, Decimal):
            return float(value)
        return float(value) if value else 0.0

    @classmethod
    def generate_invoice_groups_df(cls, result: SplitResult) -> pd.DataFrame:
        """生成发票分组DataFrame"""
        rows = []
        for group in result.invoice_groups:
            for order_id in group.order_ids:
                order = next((o for o in result.original_orders if o.order_id == order_id), None)
                platform = order.platform if order else ""
                rows.append({
                    "分组ID": group.group_id,
                    "发票抬头": group.header_name,
                    "抬头类型": group.header_type.value,
                    "税率": f"{cls._format_decimal(group.tax_rate) * 100}%",
                    "税率数值": cls._format_decimal(group.tax_rate),
                    "订单ID": order_id,
                    "平台": platform,
                    "净金额": cls._format_decimal(group.net_amount),
                    "税额": cls._format_decimal(group.tax_amount),
                    "商品项数": len(group.items),
                    "拆票原因": group.split_reason,
                    "是否人工调整": "是" if group.is_adjusted else "否",
                    "调整说明": group.adjustment_notes or "",
                })
        return pd.DataFrame(rows)

    @classmethod
    def generate_invoice_items_df(cls, result: SplitResult) -> pd.DataFrame:
        """生成发票商品明细DataFrame"""
        rows = []
        for group in result.invoice_groups:
            for item in group.items:
                order = next(
                    (o for o in result.original_orders if any(oi.item_id == item.item_id for oi in o.items)),
                    None
                )
                rows.append({
                    "分组ID": group.group_id,
                    "发票抬头": group.header_name,
                    "税率": f"{cls._format_decimal(group.tax_rate) * 100}%",
                    "订单ID": order.order_id if order else "",
                    "商品项ID": item.item_id,
                    "商品名称": item.product_name,
                    "类目": item.category_name,
                    "数量": item.quantity,
                    "单价": cls._format_decimal(item.unit_price),
                    "原价金额": cls._format_decimal(item.amount),
                    "退款金额": cls._format_decimal(item.refunded_amount),
                    "净金额": cls._format_decimal(item.net_amount),
                    "商品税率": f"{cls._format_decimal(item.tax_rate) * 100}%" if item.tax_rate else "未定义",
                })
        return pd.DataFrame(rows)

    @classmethod
    def generate_issues_df(cls, result: SplitResult) -> pd.DataFrame:
        """生成异常记录DataFrame"""
        rows = []
        for issue in result.issues:
            rows.append({
                "异常ID": issue.issue_id,
                "异常类型": issue.type.value,
                "严重程度": issue.severity,
                "订单ID": issue.order_id or "",
                "商品项ID": issue.item_id or "",
                "类目ID": issue.category_id or "",
                "抬头ID": issue.header_id or "",
                "异常信息": issue.message,
                "是否已解决": "是" if issue.resolved else "否",
                "解决说明": issue.resolution_notes or "",
            })
        return pd.DataFrame(rows)

    @classmethod
    def generate_orders_df(cls, result: SplitResult) -> pd.DataFrame:
        """生成订单汇总DataFrame"""
        rows = []
        for order in result.original_orders:
            rows.append({
                "订单ID": order.order_id,
                "平台": order.platform,
                "订单日期": order.order_date.strftime("%Y-%m-%d %H:%M:%S"),
                "发票抬头": order.header_name or "未指定",
                "抬头类型": order.header_type.value,
                "订单金额": cls._format_decimal(order.total_amount),
                "退款金额": cls._format_decimal(order.total_refunded_amount),
                "净金额": cls._format_decimal(order.net_amount),
                "订单状态": order.status.value,
                "商品项数": len(order.items),
                "是否已开票": "是" if order.has_invoiced else "否",
                "已开发票号": ",".join(order.invoice_ids) if order.invoice_ids else "",
                "备注": order.notes or "",
            })
        return pd.DataFrame(rows)

    @classmethod
    def generate_refunds_df(cls, result: SplitResult) -> pd.DataFrame:
        """生成退款记录DataFrame"""
        rows = []
        for refund in result.refunds:
            rows.append({
                "退款ID": refund.refund_id,
                "订单ID": refund.order_id,
                "退款日期": refund.refund_date.strftime("%Y-%m-%d %H:%M:%S"),
                "退款类型": refund.refund_type,
                "退款金额": cls._format_decimal(refund.amount),
                "商品项ID": refund.item_id or "",
                "退款原因": refund.reason or "",
                "备注": refund.notes or "",
                "是否已处理": "是" if refund.is_processed else "否",
            })
        return pd.DataFrame(rows)

    @classmethod
    def generate_adjustments_df(cls, result: SplitResult) -> pd.DataFrame:
        """生成调整记录DataFrame"""
        rows = []
        for adj in result.adjustments:
            original_amount = sum(cls._format_decimal(g.net_amount) for g in adj.original_groups)
            new_amount = sum(cls._format_decimal(g.net_amount) for g in adj.new_groups)
            rows.append({
                "调整ID": adj.adjustment_id,
                "调整时间": adj.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "操作人": adj.operator,
                "操作类型": {
                    "split": "拆分",
                    "merge": "合并",
                    "custom": "自定义"
                }.get(adj.action, adj.action),
                "原分组数": len(adj.original_groups),
                "原分组ID": ",".join([g.group_id for g in adj.original_groups]),
                "原分组总金额": original_amount,
                "新分组数": len(adj.new_groups),
                "新分组ID": ",".join([g.group_id for g in adj.new_groups]),
                "新分组总金额": new_amount,
                "调整原因": adj.reason,
                "调整说明": adj.notes or "",
            })
        return pd.DataFrame(rows)

    @classmethod
    def generate_adjustment_comparison_df(cls, result: SplitResult) -> pd.DataFrame:
        """生成调整前后对比DataFrame"""
        rows = []
        for adj in result.adjustments:
            for g in adj.original_groups:
                rows.append({
                    "调整ID": adj.adjustment_id,
                    "调整时间": adj.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "类型": "调整前",
                    "分组ID": g.group_id,
                    "发票抬头": g.header_name,
                    "税率": f"{cls._format_decimal(g.tax_rate) * 100}%",
                    "订单数": len(g.order_ids),
                    "订单ID": ",".join(g.order_ids),
                    "净金额": cls._format_decimal(g.net_amount),
                    "拆票原因": g.split_reason,
                })
            for g in adj.new_groups:
                rows.append({
                    "调整ID": adj.adjustment_id,
                    "调整时间": adj.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "类型": "调整后",
                    "分组ID": g.group_id,
                    "发票抬头": g.header_name,
                    "税率": f"{cls._format_decimal(g.tax_rate) * 100}%",
                    "订单数": len(g.order_ids),
                    "订单ID": ",".join(g.order_ids),
                    "净金额": cls._format_decimal(g.net_amount),
                    "拆票原因": g.split_reason,
                })
        return pd.DataFrame(rows)

    @classmethod
    def generate_summary_df(cls, result: SplitResult) -> pd.DataFrame:
        """生成汇总统计DataFrame"""
        total_amount = sum(cls._format_decimal(g.net_amount) for g in result.invoice_groups)
        total_tax = sum(cls._format_decimal(g.tax_amount) for g in result.invoice_groups)

        issue_stats: Dict[str, int] = {}
        for issue in result.issues:
            key = issue.type.value
            issue_stats[key] = issue_stats.get(key, 0) + 1

        rows = [
            {"统计项": "总订单数", "数值": result.total_orders, "单位": "笔"},
            {"统计项": "有效订单数", "数值": result.valid_orders, "单位": "笔"},
            {"统计项": "发票分组数", "数值": result.total_invoice_groups, "单位": "组"},
            {"统计项": "异常总数", "数值": result.total_issues, "单位": "个"},
            {"统计项": "未解决异常", "数值": result.unresolved_issues, "单位": "个"},
            {"统计项": "开票总金额", "数值": total_amount, "单位": "元"},
            {"统计项": "税额合计", "数值": total_tax, "单位": "元"},
            {"统计项": "人工调整次数", "数值": len(result.adjustments), "单位": "次"},
        ]

        for issue_type, count in issue_stats.items():
            rows.append({"统计项": f"异常-{issue_type}", "数值": count, "单位": "个"})

        return pd.DataFrame(rows)

    @classmethod
    def export_to_excel(cls, result: SplitResult, file_path: str):
        """导出完整报告到Excel"""
        dataframes = {
            "汇总": cls.generate_summary_df(result),
            "发票分组": cls.generate_invoice_groups_df(result),
            "发票明细": cls.generate_invoice_items_df(result),
            "异常记录": cls.generate_issues_df(result),
            "订单汇总": cls.generate_orders_df(result),
            "退款记录": cls.generate_refunds_df(result),
        }

        if result.adjustments:
            dataframes["调整记录"] = cls.generate_adjustments_df(result)
            dataframes["调整对比"] = cls.generate_adjustment_comparison_df(result)

        from .importer import DataExporter
        DataExporter.export_to_excel(dataframes, file_path)

    @classmethod
    def export_to_csv(cls, result: SplitResult, output_dir: str, prefix: str = ""):
        """导出完整报告到CSV文件"""
        dataframes = {
            "summary": cls.generate_summary_df(result),
            "invoice_groups": cls.generate_invoice_groups_df(result),
            "invoice_items": cls.generate_invoice_items_df(result),
            "issues": cls.generate_issues_df(result),
            "orders": cls.generate_orders_df(result),
            "refunds": cls.generate_refunds_df(result),
        }

        if result.adjustments:
            dataframes["adjustments"] = cls.generate_adjustments_df(result)
            dataframes["adjustment_comparison"] = cls.generate_adjustment_comparison_df(result)

        from .importer import DataExporter
        DataExporter.export_to_csv(dataframes, output_dir, prefix)

    @classmethod
    def export_to_json(cls, result: SplitResult, file_path: str):
        """导出为JSON"""
        data = {
            "generated_at": result.generated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "total_orders": result.total_orders,
                "valid_orders": result.valid_orders,
                "total_invoice_groups": result.total_invoice_groups,
                "total_issues": result.total_issues,
                "unresolved_issues": result.unresolved_issues,
                "total_amount": cls._format_decimal(result.total_amount),
                "adjustment_count": len(result.adjustments),
            },
            "invoice_groups": [g.to_dict() for g in result.invoice_groups],
            "issues": [i.to_dict() for i in result.issues],
            "orders": [o.to_dict() for o in result.original_orders],
            "refunds": [r.to_dict() for r in result.refunds],
            "adjustments": [a.to_dict() for a in result.adjustments],
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @classmethod
    def generate_text_report(cls, result: SplitResult) -> str:
        """生成文本报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("多渠道订单拆票报告")
        lines.append(f"生成时间: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("【汇总统计】")
        lines.append(f"  总订单数: {result.total_orders} 笔")
        lines.append(f"  有效订单: {result.valid_orders} 笔")
        lines.append(f"  发票分组: {result.total_invoice_groups} 组")
        lines.append(f"  异常总数: {result.total_issues} 个 (未解决: {result.unresolved_issues})")
        lines.append(f"  开票总金额: {cls._format_decimal(result.total_amount):,.2f} 元")
        lines.append(f"  人工调整: {len(result.adjustments)} 次")
        lines.append("")

        if result.issues:
            lines.append("【异常记录】")
            for issue in result.issues:
                status = "✓" if issue.resolved else "✗"
                lines.append(f"  [{status}] {issue.type.value} ({issue.severity}): {issue.message}")
            lines.append("")

        lines.append("【发票分组详情】")
        for idx, group in enumerate(result.invoice_groups, 1):
            lines.append(f"")
            lines.append(f"  分组 #{idx}: {group.group_id}")
            lines.append(f"    抬头: {group.header_name} ({group.header_type.value})")
            lines.append(f"    税率: {cls._format_decimal(group.tax_rate) * 100}%")
            lines.append(f"    订单: {len(group.order_ids)} 笔 - {', '.join(group.order_ids[:3])}{'...' if len(group.order_ids) > 3 else ''}")
            lines.append(f"    金额: {cls._format_decimal(group.net_amount):,.2f} 元 (税额: {cls._format_decimal(group.tax_amount):,.2f} 元)")
            lines.append(f"    拆票原因: {group.split_reason}")
            if group.is_adjusted:
                lines.append(f"    ⚠ 人工调整: {group.adjustment_notes or '已调整'}")

        if result.adjustments:
            lines.append("")
            lines.append("【人工调整记录】")
            for adj in result.adjustments:
                lines.append(f"")
                lines.append(f"  调整ID: {adj.adjustment_id}")
                lines.append(f"    时间: {adj.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"    操作人: {adj.operator}")
                lines.append(f"    操作: {adj.action}")
                lines.append(f"    原因: {adj.reason}")
                lines.append(f"    调整前: {len(adj.original_groups)} 个分组 -> 调整后: {len(adj.new_groups)} 个分组")

        lines.append("")
        lines.append("=" * 80)

        return "\n".join(lines)
