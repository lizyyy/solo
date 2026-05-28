"""
报告导出 - 取舍逻辑、可验证结果
"""
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
import os
import json
from .models import (
    SubscriptionOrder, ConfirmReport, SubscriptionStatus,
    CoolOffStatus, MaterialStatus
)
from .duplicate_guard import DuplicateSubscriptionGuard


class ReportExporter:
    """报告导出器 - 带取舍逻辑"""

    EXPORT_OPTIONS = {
        "include_payment": "打款流水信息",
        "include_warnings": "警告信息",
        "include_material_details": "材料明细",
        "include_visit_details": "回访明细",
        "include_cool_off_details": "冷静期明细",
        "include_error_details": "错误详情",
    }

    @classmethod
    def should_export(cls, order: SubscriptionOrder,
                      all_orders: Optional[List[SubscriptionOrder]] = None) -> Tuple[bool, List[str]]:
        """
        判断是否应该导出报告
        取舍逻辑：校验不通过的不导出，冷静期未满的不导出，重复认购的不导出
        all_orders: 同批订单列表，用于标记重复认购（非首单标记错误）
        """
        reasons: List[str] = []

        if all_orders:
            dup_guard = DuplicateSubscriptionGuard()
            dup_result = dup_guard.batch_check(all_orders)
            dup_order_ids = set()
            for group in dup_result["duplicate_groups"]:
                for idx, o_summary in enumerate(group["orders"]):
                    if idx > 0:
                        dup_order_ids.add(o_summary["subscription_id"])

            if order.subscription_id in dup_order_ids:
                reasons.append("存在重复认购（非首单），不予导出")

        dup_errors = [e for e in order.error_details if "重复认购" in e]
        if dup_errors and "存在重复认购（非首单），不予导出" not in reasons:
            reasons.append(f"存在重复认购，不予导出：{'; '.join(dup_errors)}")

        if order.status == SubscriptionStatus.REJECTED:
            reasons.append(f"订单状态为[{order.status.value}]，不予导出")

        if order.cool_off:
            cool_status = order.cool_off.check_status()
            if cool_status in [CoolOffStatus.EXPIRED, CoolOffStatus.PENDING]:
                reasons.append(f"冷静期状态为[{cool_status.value}]，不予导出")

        if order.materials:
            invalid_mats = [m for m in order.materials if m.status != MaterialStatus.VALID]
            if invalid_mats:
                mat_names = ", ".join([m.material_type.value for m in invalid_mats])
                reasons.append(f"存在无效材料[{mat_names}]，不予导出")

        if order.error_details:
            reasons.append(f"存在{len(order.error_details)}个错误，不予导出")

        return len(reasons) == 0, reasons

    @classmethod
    def generate_report(cls, order: SubscriptionOrder, operator: str,
                        export_dir: str = "./reports",
                        all_orders: Optional[List[SubscriptionOrder]] = None,
                        **options) -> Tuple[Optional[ConfirmReport], List[str]]:
        """
        生成确认报告
        可以通过options控制包含哪些内容
        all_orders: 同批订单列表，用于实时重复认购检查
        """
        messages: List[str] = []

        should_do, skip_reasons = cls.should_export(order, all_orders)
        if not should_do:
            messages.extend(skip_reasons)
            return None, messages

        included_items = []
        for opt_key, opt_desc in cls.EXPORT_OPTIONS.items():
            if options.get(opt_key, True):
                included_items.append(opt_desc)

        report = ConfirmReport(
            subscription_id=order.subscription_id,
            generate_time=datetime.now(),
            operator=operator,
            include_items=included_items,
        )

        os.makedirs(export_dir, exist_ok=True)
        filename = f"confirm_report_{order.order_no or order.subscription_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        report.file_path = os.path.join(export_dir, filename)

        report_content = cls._build_report_content(order, report, **options)

        with open(report.file_path, "w", encoding="utf-8") as f:
            json.dump(report_content, f, ensure_ascii=False, indent=2)

        report.is_exported = True
        order.report = report
        order.status = SubscriptionStatus.REPORTED

        messages.append(f"报告已生成：{report.file_path}")
        messages.append(f"包含内容：{', '.join(included_items)}")

        return report, messages

    @classmethod
    def _build_report_content(cls, order: SubscriptionOrder, report: ConfirmReport,
                              **options) -> Dict[str, Any]:
        """构建报告内容，根据options取舍"""
        content = {
            "报告基本信息": {
                "report_id": report.report_id,
                "generate_time": report.generate_time.strftime('%Y-%m-%d %H:%M:%S'),
                "operator": report.operator,
                "include_items": report.include_items,
            },
            "认购单信息": {
                "subscription_id": order.subscription_id,
                "order_no": order.order_no,
                "investor_id": order.investor_id,
                "investor_name": order.investor_name,
                "product_code": order.product_code,
                "product_name": order.product_name,
                "subscription_amount": order.subscription_amount,
                "submit_time": order.submit_time.strftime('%Y-%m-%d %H:%M:%S') if order.submit_time else None,
                "status": order.status.value,
            },
        }

        if options.get("include_material_details", True):
            content["材料信息"] = {
                "material_count": len(order.materials),
                "materials": [
                    {
                        "material_id": m.material_id,
                        "material_type": m.material_type.value,
                        "status": m.status.value,
                        "upload_date": m.upload_date.strftime('%Y-%m-%d'),
                        "expire_date": m.expire_date.strftime('%Y-%m-%d') if m.expire_date else "长期有效",
                        "file_path": m.file_path,
                    }
                    for m in order.materials
                ]
            }

        if options.get("include_cool_off_details", True) and order.cool_off:
            content["冷静期信息"] = {
                "cool_off_id": order.cool_off.cool_off_id,
                "status": order.cool_off.status.value,
                "is_locked": order.cool_off.is_locked,
                "lock_reason": order.cool_off.lock_reason,
                "start_time": order.cool_off.start_time.strftime('%Y-%m-%d %H:%M:%S') if order.cool_off.start_time else None,
                "end_time": order.cool_off.end_time.strftime('%Y-%m-%d %H:%M:%S') if order.cool_off.end_time else None,
            }

        if options.get("include_visit_details", True) and order.visit:
            content["回访信息"] = {
                "visit_id": order.visit.visit_id,
                "status": order.visit.status.value,
                "record_file": order.visit.record_file_path,
                "visit_time": order.visit.visit_time.strftime('%Y-%m-%d %H:%M:%S') if order.visit.visit_time else None,
                "operator": order.visit.operator,
                "confirm_result": order.visit.confirm_result,
                "confirm_time": order.visit.confirm_time.strftime('%Y-%m-%d %H:%M:%S') if order.visit.confirm_time else None,
            }

        if options.get("include_payment", True) and order.payment:
            content["打款流水"] = {
                "flow_id": order.payment.flow_id,
                "amount": order.payment.amount,
                "pay_time": order.payment.pay_time.strftime('%Y-%m-%d %H:%M:%S') if order.payment.pay_time else None,
                "pay_account": order.payment.pay_account,
                "is_matched": order.payment.is_matched,
            }

        if options.get("include_warnings", True) and order.warnings:
            content["警告信息"] = order.warnings

        if options.get("include_error_details", True) and order.error_details:
            content["错误信息"] = order.error_details

        return content

    @classmethod
    def batch_export(cls, orders: List[SubscriptionOrder], operator: str,
                     export_dir: str = "./reports",
                     **options) -> Dict[str, Any]:
        """批量导出报告，按结果分组便于复查，自动检测重复认购"""
        result = {
            "exported": [],
            "skipped": [],
            "skip_reasons": {},
        }

        for order in orders:
            report, messages = cls.generate_report(order, operator, export_dir,
                                                   all_orders=orders, **options)
            if report:
                result["exported"].append({
                    "order_no": order.order_no,
                    "subscription_id": order.subscription_id,
                    "report_file": report.file_path,
                })
            else:
                result["skipped"].append({
                    "order_no": order.order_no,
                    "subscription_id": order.subscription_id,
                    "reasons": messages,
                })

        return result

    @classmethod
    def verify_report(cls, report_path: str) -> Dict[str, Any]:
        """验证导出的报告，确保可复查"""
        if not os.path.exists(report_path):
            return {"valid": False, "error": "报告文件不存在"}

        try:
            with open(report_path, "r", encoding="utf-8") as f:
                content = json.load(f)

            required_sections = ["报告基本信息", "认购单信息"]
            missing = [s for s in required_sections if s not in content]

            return {
                "valid": len(missing) == 0,
                "missing_sections": missing,
                "content": content,
            }
        except Exception as e:
            return {"valid": False, "error": f"读取报告失败：{str(e)}"}
